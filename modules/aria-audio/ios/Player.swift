import AVFoundation
import AudioToolbox
import QuartzCore

/// Every non-MusicKit player (§6.4, §7.5): the user's recording (file), Apple Music previews (url),
/// the synthesized notes (synth) and a clock-only source (silent). One source loaded at a time.
///
/// - file:  AVAudioPlayerNode → AVAudioUnitTimePitch → mixer (rate changes keep pitch; segment scheduling
///          gives sample-accurate seek and loop).
/// - url:   AVPlayer (streamed), cached to Caches/previews for re-listen.
/// - synth: AVAudioSequencer (in-memory SMF) → AVAudioUnitSampler with the bundled piano SoundFont.
/// - silent: host-clock timer only.
///
/// Threading: every method must be called on `queue`. Clock events are emitted at 10 Hz while playing and
/// on every state change.
final class Player {
  enum Kind { case none, file, url, synth, silent }

  var onClock: (([String: Any]) -> Void)?
  /// Position/duration/rate changed — used to update Now Playing info.
  var onStateChange: (() -> Void)?

  private let queue: DispatchQueue
  private let session: AudioSessionController

  private let engine = AVAudioEngine()
  private let fileNode = AVAudioPlayerNode()
  private let timePitch = AVAudioUnitTimePitch()
  private let sampler = AVAudioUnitSampler()
  private var sequencer: AVAudioSequencer?
  private var soundFontLoaded = false

  private var avPlayer: AVPlayer?
  private var endObserver: NSObjectProtocol?
  private var audioFile: AVAudioFile?

  private(set) var kind: Kind = .none
  private(set) var status = "idle" // idle | playing | paused | ended
  private(set) var duration: Double = 0
  private(set) var rate: Double = 1
  private(set) var loop = false

  // file: position of the start of the currently scheduled segment; generation guards stale completions
  private var segmentStart: Double = 0
  private var generation = 0
  // silent: base position + host time when started
  private var silentBase: Double = 0
  private var silentStartedAt: CFTimeInterval = 0
  // position while paused/ended (all kinds)
  private var pausedPosition: Double = 0

  private var clockTimer: DispatchSourceTimer?
  private var configObserver: NSObjectProtocol?

  init(queue: DispatchQueue, session: AudioSessionController) {
    self.queue = queue
    self.session = session
    engine.attach(fileNode)
    engine.attach(timePitch)
    engine.attach(sampler)
    engine.connect(fileNode, to: timePitch, format: nil)
    engine.connect(timePitch, to: engine.mainMixerNode, format: nil)
    engine.connect(sampler, to: engine.mainMixerNode, format: nil)
    configObserver = NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
    ) { [weak self] _ in
      self?.queue.async { self?.handleEngineConfigChange() }
    }
  }

  deinit {
    if let configObserver { NotificationCenter.default.removeObserver(configObserver) }
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
  }

  // MARK: - Load

  func load(_ source: PlayerSourceRecord, completion: @escaping (Result<Double, Error>) -> Void) {
    unload(emit: false)
    do {
      switch source.kind {
      case "file":
        guard let uri = source.uri else { throw AriaAudioException.badSource("file source needs a uri") }
        try session.activate(for: .playback)
        let file = try AVAudioFile(forReading: .fromJS(uri))
        audioFile = file
        engine.disconnectNodeOutput(fileNode)
        engine.connect(fileNode, to: timePitch, format: file.processingFormat)
        try startEngine()
        kind = .file
        duration = Double(file.length) / file.processingFormat.sampleRate
        finishLoad(completion)

      case "url":
        guard let s = source.url, let remote = URL(string: s) else { throw AriaAudioException.badSource("url source needs a url") }
        try session.activate(for: .playback)
        let cached = PreviewCache.cachedFile(for: remote)
        let item = AVPlayerItem(url: cached ?? remote)
        item.audioTimePitchAlgorithm = .timeDomain
        let player = AVPlayer(playerItem: item)
        player.automaticallyWaitsToMinimizeStalling = true
        avPlayer = player
        kind = .url
        if cached == nil { PreviewCache.store(remote) }
        endObserver = NotificationCenter.default.addObserver(
          forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: nil
        ) { [weak self] _ in
          self?.queue.async { self?.handleURLEnded() }
        }
        let asset = item.asset
        asset.loadValuesAsynchronously(forKeys: ["duration"]) { [weak self] in
          self?.queue.async {
            guard let self, self.kind == .url else { return }
            let d = asset.duration.seconds
            self.duration = d.isFinite ? d : 30
            self.finishLoad(completion)
          }
        }

      case "synth":
        let notes = source.notes ?? []
        try session.activate(for: .playback)
        try loadSoundFontIfNeeded()
        try startEngine()
        let seq = AVAudioSequencer(audioEngine: engine)
        try seq.load(from: SMF.make(notes: notes), options: [])
        for track in seq.tracks { track.destinationAudioUnit = sampler }
        seq.prepareToPlay()
        sequencer = seq
        kind = .synth
        duration = (notes.map(\.endSec).max() ?? 0) + 0.5
        applyLoop()
        finishLoad(completion)

      case "silent":
        kind = .silent
        duration = max(0, source.durationSec ?? 30)
        finishLoad(completion)

      default:
        throw AriaAudioException.badSource("Unknown source kind \(source.kind)")
      }
    } catch {
      unload(emit: true)
      completion(.failure(error))
    }
  }

  private func finishLoad(_ completion: (Result<Double, Error>) -> Void) {
    status = "paused"
    pausedPosition = 0
    segmentStart = 0
    applyRate()
    emitClock()
    completion(.success(duration))
  }

  private func startEngine() throws {
    if !engine.isRunning {
      engine.prepare()
      try engine.start()
    }
  }

  private func loadSoundFontIfNeeded() throws {
    guard !soundFontLoaded else { return }
    // Placeholder name: the SoundFont (≤ 25 MB, permissive licence — see §10) is added to the app bundle by a
    // config plugin / withModelAsset-style copy. Without it the sampler falls back to its default sine voice.
    if let url = Bundle.main.url(forResource: "AriaPiano", withExtension: "sf2") {
      try sampler.loadSoundBankInstrument(
        at: url, program: 0,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
      )
    } else {
      NSLog("[AriaAudio] AriaPiano.sf2 not bundled — synth uses the default sampler voice")
    }
    soundFontLoaded = true
  }

  // MARK: - Transport

  func play() {
    guard kind != .none else { return }
    if status == "ended" { pausedPosition = 0 }
    let from = pausedPosition
    try? session.activate(for: .playback)
    switch kind {
    case .file:
      try? startEngine()
      scheduleFile(from: from)
      fileNode.play()
    case .url:
      avPlayer?.seek(to: CMTime(seconds: from, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
      avPlayer?.defaultRate = Float(rate)
      avPlayer?.rate = Float(rate)
    case .synth:
      try? startEngine()
      sequencer?.currentPositionInSeconds = from
      try? sequencer?.start()
    case .silent:
      silentBase = from
      silentStartedAt = CACurrentMediaTime()
    case .none:
      return
    }
    status = "playing"
    startClock()
    emitClock()
    onStateChange?()
  }

  func pause() {
    guard status == "playing" else { return }
    pausedPosition = currentPosition()
    stopSources()
    status = "paused"
    stopClock()
    emitClock()
    onStateChange?()
  }

  func seek(_ sec: Double) {
    guard kind != .none else { return }
    let target = max(0, min(sec, duration))
    let wasPlaying = status == "playing"
    if wasPlaying { stopSources() }
    pausedPosition = target
    if status == "ended" { status = "paused" }
    if wasPlaying {
      status = "paused"
      play()
    } else {
      emitClock()
      onStateChange?()
    }
  }

  func setLoop(_ on: Bool) {
    loop = on
    applyLoop()
  }

  func setRate(_ r: Double) {
    let wasPosition = currentPosition()
    rate = max(0.25, min(2, r))
    if kind == .silent && status == "playing" {
      silentBase = wasPosition
      silentStartedAt = CACurrentMediaTime()
    }
    applyRate()
    emitClock()
    onStateChange?()
  }

  func unload(emit: Bool = true) {
    stopSources()
    stopClock()
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = nil
    avPlayer?.replaceCurrentItem(with: nil)
    avPlayer = nil
    sequencer = nil
    audioFile = nil
    kind = .none
    status = "idle"
    duration = 0
    pausedPosition = 0
    if emit { emitClock() }
  }

  /// Called when recording starts (one thing at a time).
  func pauseForRecording() {
    pause()
    if engine.isRunning { engine.pause() }
  }

  // MARK: - Position

  func currentPosition() -> Double {
    guard status == "playing" else { return pausedPosition }
    switch kind {
    case .file:
      guard let nodeTime = fileNode.lastRenderTime,
            let t = fileNode.playerTime(forNodeTime: nodeTime) else { return segmentStart }
      return min(duration, segmentStart + Double(t.sampleTime) / t.sampleRate)
    case .url:
      let s = avPlayer?.currentTime().seconds ?? 0
      return s.isFinite ? s : 0
    case .synth:
      return sequencer?.currentPositionInSeconds ?? 0
    case .silent:
      return silentBase + (CACurrentMediaTime() - silentStartedAt) * rate
    case .none:
      return 0
    }
  }

  // MARK: - Internals

  private func scheduleFile(from position: Double) {
    guard let file = audioFile else { return }
    generation += 1
    let gen = generation
    fileNode.stop()
    let sr = file.processingFormat.sampleRate
    let startFrame = AVAudioFramePosition(position * sr)
    let frames = AVAudioFrameCount(max(0, file.length - startFrame))
    segmentStart = position
    guard frames > 0 else { return }
    fileNode.scheduleSegment(file, startingFrame: startFrame, frameCount: frames, at: nil,
                             completionCallbackType: .dataPlayedBack) { [weak self] _ in
      self?.queue.async { self?.handleFileSegmentEnded(generation: gen) }
    }
  }

  private func handleFileSegmentEnded(generation gen: Int) {
    guard gen == generation, kind == .file, status == "playing" else { return }
    if loop {
      scheduleFile(from: 0)
      fileNode.play()
      emitClock()
    } else {
      markEnded()
    }
  }

  private func handleURLEnded() {
    guard kind == .url, status == "playing" else { return }
    if loop {
      avPlayer?.seek(to: .zero)
      avPlayer?.rate = Float(rate)
      emitClock()
    } else {
      markEnded()
    }
  }

  private func markEnded() {
    stopSources()
    pausedPosition = duration
    status = "ended"
    stopClock()
    emitClock()
    onStateChange?()
  }

  private func stopSources() {
    generation += 1 // invalidate pending segment completions
    switch kind {
    case .file: fileNode.stop()
    case .url: avPlayer?.pause()
    case .synth: sequencer?.stop()
    default: break
    }
  }

  private func applyRate() {
    timePitch.rate = Float(rate) // pitch preserved
    sequencer?.rate = Float(rate)
    if kind == .url, status == "playing" { avPlayer?.rate = Float(rate) }
  }

  private func applyLoop() {
    // file/url/silent loop in `tick`/completion handlers; the sequencer loops natively.
    guard let seq = sequencer else { return }
    let lengthBeats = seq.beats(forSeconds: duration)
    for track in seq.tracks {
      track.loopRange = AVBeatRange(start: 0, length: lengthBeats)
      track.numberOfLoops = loop ? AVMusicTrackLoopCount.forever.rawValue : 0
      track.isLoopingEnabled = loop
    }
  }

  private func handleEngineConfigChange() {
    // Route/sample-rate change stopped the engine; restart and resume from where we were.
    guard kind == .file || kind == .synth else { return }
    let wasPlaying = status == "playing"
    let pos = currentPosition()
    if wasPlaying { stopSources(); status = "paused" }
    pausedPosition = pos
    try? startEngine()
    if wasPlaying { play() }
  }

  // MARK: - Clock

  private func startClock() {
    stopClock()
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + .milliseconds(100), repeating: .milliseconds(100), leeway: .milliseconds(5))
    timer.setEventHandler { [weak self] in self?.tick() }
    timer.resume()
    clockTimer = timer
  }

  private func stopClock() {
    clockTimer?.cancel()
    clockTimer = nil
  }

  private func tick() {
    guard status == "playing" else { return }
    let pos = currentPosition()
    if (kind == .synth || kind == .silent) && pos >= duration {
      if loop {
        if kind == .silent {
          silentBase = 0
          silentStartedAt = CACurrentMediaTime()
        }
        // the sequencer wraps by itself when looping
      } else {
        markEnded()
        return
      }
    }
    emitClock(position: pos)
  }

  func emitClock(position: Double? = nil) {
    onClock?([
      "position": position ?? currentPosition(),
      "hostTime": hostTimeMs(),
      "wallTime": wallTimeMs(),
      "rate": status == "playing" ? rate : 0,
      "status": status,
      "duration": duration,
      "outputLatency": session.outputLatency,
    ])
  }
}

// MARK: - Preview cache

/// Apple Music previews are cached to Caches/previews so re-listening works offline.
enum PreviewCache {
  static var dir: URL {
    let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("previews", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
    return d
  }

  static func key(for url: URL) -> URL {
    var hash: UInt64 = 14695981039346656037
    for b in url.absoluteString.utf8 { hash = (hash ^ UInt64(b)) &* 1099511628211 }
    let ext = url.pathExtension.isEmpty ? "m4a" : url.pathExtension
    return dir.appendingPathComponent(String(hash, radix: 16)).appendingPathExtension(ext)
  }

  static func cachedFile(for url: URL) -> URL? {
    let f = key(for: url)
    return FileManager.default.fileExists(atPath: f.path) ? f : nil
  }

  static func store(_ url: URL) {
    let target = key(for: url)
    URLSession.shared.downloadTask(with: url) { tmp, response, _ in
      guard let tmp, (response as? HTTPURLResponse)?.statusCode == 200 else { return }
      try? FileManager.default.moveItem(at: tmp, to: target)
    }.resume()
  }
}

// MARK: - Standard MIDI file builder (for AVAudioSequencer)

enum SMF {
  static let ppq: UInt16 = 480
  /// 120 BPM → 1 quarter = 0.5 s → ticks per second = 960.
  static let ticksPerSecond = Double(ppq) * 2

  static func make(notes: [SynthNoteRecord]) -> Data {
    struct Ev { let tick: UInt32; let bytes: [UInt8]; let order: Int }
    var events: [Ev] = []
    for n in notes {
      let pitch = UInt8(max(0, min(127, n.pitch)))
      let vel = UInt8(max(1, min(127, n.velocity)))
      let on = UInt32(max(0, n.startSec) * ticksPerSecond)
      let off = max(on + 1, UInt32(max(0, n.endSec) * ticksPerSecond))
      events.append(Ev(tick: on, bytes: [0x90, pitch, vel], order: 1))
      events.append(Ev(tick: off, bytes: [0x80, pitch, 0], order: 0)) // offs before ons at the same tick
    }
    events.sort { $0.tick != $1.tick ? $0.tick < $1.tick : $0.order < $1.order }

    var track: [UInt8] = []
    // tempo 500000 µs/quarter (120 BPM)
    track += [0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20]
    var last: UInt32 = 0
    for e in events {
      track += vlq(e.tick - last) + e.bytes
      last = e.tick
    }
    track += [0x00, 0xFF, 0x2F, 0x00]

    var data: [UInt8] = [UInt8]("MThd".utf8) + be32(6) + be16(0) + be16(1) + be16(ppq)
    data += [UInt8]("MTrk".utf8) + be32(UInt32(track.count)) + track
    return Data(data)
  }

  private static func vlq(_ value: UInt32) -> [UInt8] {
    var v = value
    var bytes: [UInt8] = [UInt8(v & 0x7F)]
    v >>= 7
    while v > 0 {
      bytes.insert(UInt8(v & 0x7F) | 0x80, at: 0)
      v >>= 7
    }
    return bytes
  }

  private static func be16(_ v: UInt16) -> [UInt8] { [UInt8(v >> 8), UInt8(v & 0xFF)] }
  private static func be32(_ v: UInt32) -> [UInt8] { [UInt8(v >> 24), UInt8((v >> 16) & 0xFF), UInt8((v >> 8) & 0xFF), UInt8(v & 0xFF)] }
}
