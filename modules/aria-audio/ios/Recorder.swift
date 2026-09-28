import AVFoundation

/// One take: `AVAudioEngine` input tap → `CAFWriter` (16-bit PCM, flushed continuously) + `LevelMeter`,
/// with optional count-in clicks on an `AVAudioPlayerNode` (headphones only).
///
/// Uses its own engine so the mic (and the orange privacy dot) is only live while recording — playback runs
/// on `Player`'s engine.
final class Recorder {
  struct Result {
    let cafURL: URL
    let durationSec: Double
    let countInEndSec: Double
    let sampleRate: Double
    let interrupted: Bool
  }

  // Callbacks (called on the tap thread or `callbackQueue`)
  var onLevel: ((_ rmsDb: Float, _ peakDb: Float) -> Void)?
  var onWarning: ((_ kind: String?) -> Void)?
  var onCountInBeat: ((_ beat: Int, _ beats: Int, _ audible: Bool) -> Void)?
  var onStatus: ((_ state: String, _ elapsedSec: Double) -> Void)?
  /// Hit the 10-minute limit: the take is finalized; the owner should report it and call `finish()`.
  var onAutoStop: (() -> Void)?

  let projectDir: URL
  let cafURL: URL
  private let engine = AVAudioEngine()
  private let clickNode = AVAudioPlayerNode()
  private var writer: CAFWriter?
  private var meter: LevelMeter?
  private let callbackQueue: DispatchQueue
  private var beatWorkItems: [DispatchWorkItem] = []
  private let maxDurationSec: Double
  private var limitWarned = false
  private var autoStopFired = false
  private var stopped = false
  private(set) var interrupted = false
  private(set) var countInEndSec: Double = 0
  private(set) var sampleRate: Double = 48000
  private let lock = NSLock()

  init(projectDir: URL, maxDurationSec: Double, callbackQueue: DispatchQueue) {
    self.projectDir = projectDir
    self.cafURL = projectDir.appendingPathComponent("audio.caf")
    self.maxDurationSec = maxDurationSec
    self.callbackQueue = callbackQueue
  }

  /// The session must already be active for `.recording`.
  func start(countIn: CountInRecord?, clicksAudible: Bool) throws {
    try FileManager.default.createDirectory(at: projectDir, withIntermediateDirectories: true)

    let input = engine.inputNode
    let hwFormat = input.outputFormat(forBus: 0)
    guard hwFormat.sampleRate > 0, hwFormat.channelCount > 0 else { throw AriaAudioException.noInput }
    sampleRate = hwFormat.sampleRate

    let writer = try CAFWriter(url: cafURL, sampleRate: sampleRate, channels: 1)
    let meter = LevelMeter(sampleRate: sampleRate)
    self.writer = writer
    self.meter = meter

    // Count-in: clicks start 0.1 s in so the first one isn't clipped by engine start-up.
    let lead = 0.1
    if let countIn, countIn.bpm > 0 {
      let beats = max(1, countIn.beats)
      let beatSec = 60 / countIn.bpm
      countInEndSec = lead + Double(beats) * beatSec
      meter.armedAfterSec = countInEndSec
      let audible = clicksAudible || !countIn.clickOnlyInHeadphones
      if audible {
        attachClicks(beats: beats, beatSec: beatSec, lead: lead)
      }
      for b in 0..<beats {
        let item = DispatchWorkItem { [weak self] in self?.onCountInBeat?(b + 1, beats, audible) }
        beatWorkItems.append(item)
        callbackQueue.asyncAfter(deadline: .now() + lead + Double(b) * beatSec, execute: item)
      }
    }

    // Mono float scratch buffer for downmixing multi-channel inputs.
    var mono = [Float](repeating: 0, count: 8192)
    input.installTap(onBus: 0, bufferSize: 2048, format: hwFormat) { [weak self] buffer, _ in
      guard let self, let data = buffer.floatChannelData else { return }
      let n = Int(buffer.frameLength)
      let channels = Int(buffer.format.channelCount)
      if mono.count < n { mono = [Float](repeating: 0, count: n) }
      mono.withUnsafeMutableBufferPointer { out in
        if channels == 1 {
          out.baseAddress!.update(from: data[0], count: n)
        } else {
          let scale = 1 / Float(channels)
          for i in 0..<n {
            var sum: Float = 0
            for c in 0..<channels { sum += data[c][i] }
            out[i] = sum * scale
          }
        }
        self.consume(out.baseAddress!, count: n)
      }
    }

    engine.prepare()
    try engine.start()
    if engine.attachedNodes.contains(clickNode) {
      clickNode.play()
    }
    onStatus?("recording", 0)
  }

  private func consume(_ samples: UnsafePointer<Float>, count: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard !stopped, let writer, let meter else { return }
    do {
      try writer.append(samples, count: count)
    } catch {
      // Disk full or similar: stop the take cleanly rather than lose it.
      if !autoStopFired {
        autoStopFired = true
        interrupted = true
        callbackQueue.async { [weak self] in self?.onAutoStop?() }
      }
      return
    }
    meter.process(samples, count: count, onReport: { r in
      onLevel?(r.rmsDb, r.peakDb)
    }, onWarning: { w in
      onWarning?(w?.rawValue)
    })
    let elapsed = writer.durationSec
    if !limitWarned && elapsed >= maxDurationSec - 30 {
      limitWarned = true
      let cb = onStatus
      callbackQueue.async { cb?("limitWarning", elapsed) }
    }
    if elapsed >= maxDurationSec && !autoStopFired {
      autoStopFired = true
      interrupted = true
      let cb = onStatus
      callbackQueue.async { [weak self] in
        cb?("autoStopped", elapsed)
        self?.onAutoStop?()
      }
    }
  }

  /// Stops the engine and finalizes the CAF (idempotent). `interrupted` marks calls/Siri/limit.
  @discardableResult
  func finish(interrupted: Bool = false) -> Result {
    lock.lock()
    let alreadyStopped = stopped
    stopped = true
    if interrupted { self.interrupted = true }
    lock.unlock()

    if !alreadyStopped {
      beatWorkItems.forEach { $0.cancel() }
      engine.inputNode.removeTap(onBus: 0)
      clickNode.stop()
      engine.stop()
      try? writer?.close()
      if meter?.warning != nil { onWarning?(nil) }
    }
    let duration = writer?.durationSec ?? 0
    onStatus?(self.interrupted ? "interrupted" : "stopped", duration)
    return Result(
      cafURL: cafURL,
      durationSec: duration,
      countInEndSec: min(countInEndSec, duration),
      sampleRate: sampleRate,
      interrupted: self.interrupted
    )
  }

  // MARK: - Count-in clicks

  private func attachClicks(beats: Int, beatSec: Double, lead: Double) {
    let output = engine.mainMixerNode.outputFormat(forBus: 0)
    let sr = output.sampleRate > 0 ? output.sampleRate : 48000
    guard let format = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1) else { return }
    engine.attach(clickNode)
    engine.connect(clickNode, to: engine.mainMixerNode, format: format)
    for b in 0..<beats {
      guard let click = Self.makeClick(format: format, accent: b == 0) else { continue }
      let when = AVAudioTime(sampleTime: AVAudioFramePosition((lead + Double(b) * beatSec) * sr), atRate: sr)
      clickNode.scheduleBuffer(click, at: when, options: [], completionHandler: nil)
    }
  }

  /// 30 ms decaying sine blip; accented first beat is higher.
  static func makeClick(format: AVAudioFormat, accent: Bool) -> AVAudioPCMBuffer? {
    let frames = AVAudioFrameCount(format.sampleRate * 0.03)
    guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
          let ch = buf.floatChannelData?[0] else { return nil }
    buf.frameLength = frames
    let freq = accent ? 1760.0 : 1320.0
    for i in 0..<Int(frames) {
      let t = Double(i) / format.sampleRate
      ch[i] = Float(sin(2 * .pi * freq * t) * exp(-t * 120) * 0.6)
    }
    return buf
  }
}
