import AVFoundation
import ExpoModulesCore

/// `aria-audio` (ARCHITECTURE.md §8.1): single AVAudioSession owner — recording, metering, inputs, count-in,
/// imports and all non-MusicKit playback. JS surface: modules/aria-audio/index.ts.
///
/// All state lives on `audioQueue`; AsyncFunctions run there via `.runOnQueue`, sync transport Functions
/// hop onto it.
public final class AriaAudioModule: Module {
  private let audioQueue = DispatchQueue(label: "com.aria.audio", qos: .userInitiated)
  private let session = AudioSessionController()
  private lazy var player = Player(queue: audioQueue, session: session)
  private let nowPlaying = NowPlaying()

  private var recorder: Recorder?
  /// A take that was finalized by an interruption / the time limit before JS called `stopRecording`.
  private var pendingResult: Recorder.Result?

  public func definition() -> ModuleDefinition {
    Name("AriaAudio")

    Events("level", "inputWarning", "interruption", "clock", "routeChange", "countInBeat", "recordingStatus", "playerError")

    OnCreate {
      self.setUp()
    }

    OnDestroy {
      self.audioQueue.sync {
        self.recorder?.finish(interrupted: true)
        self.player.unload(emit: false)
      }
      self.session.stopObserving()
    }

    // MARK: permission / session

    AsyncFunction("getMicPermission") { () -> String in
      self.session.micPermission()
    }

    AsyncFunction("requestMicPermission") { (promise: Promise) in
      self.session.requestMicPermission { granted in
        promise.resolve(granted ? "granted" : "denied")
      }
    }

    AsyncFunction("getInputs") { () -> [[String: Any]] in
      try? self.session.activate(for: .playback)
      return self.session.inputs()
    }
    .runOnQueue(audioQueue)

    AsyncFunction("setPreferredInput") { (id: String) in
      try self.session.setPreferredInput(id: id)
    }
    .runOnQueue(audioQueue)

    AsyncFunction("getOutput") { () -> [String: Any] in
      ["output": self.session.outputKind, "outputLatency": self.session.outputLatency]
    }
    .runOnQueue(audioQueue)

    // MARK: recording

    AsyncFunction("startRecording") { (opts: StartRecordingRecord) in
      try self.startRecording(opts)
    }
    .runOnQueue(audioQueue)

    AsyncFunction("stopRecording") { () -> [String: Any] in
      try self.stopRecording()
    }
    .runOnQueue(audioQueue)

    AsyncFunction("discardRecording") {
      if let rec = self.recorder {
        let result = rec.finish()
        try? FileManager.default.removeItem(at: result.cafURL)
      }
      if let pending = self.pendingResult {
        try? FileManager.default.removeItem(at: pending.cafURL)
      }
      self.recorder = nil
      self.pendingResult = nil
    }
    .runOnQueue(audioQueue)

    // MARK: import / files

    AsyncFunction("importAudio") { (src: String, projectDir: String) -> [String: Any] in
      let r = try AudioFiles.importAudio(src: .fromJS(src), projectDir: .fromJS(projectDir))
      return ["file": r.file.absoluteString, "durationSec": r.durationSec]
    }
    .runOnQueue(DispatchQueue.global(qos: .userInitiated))

    AsyncFunction("getPeaks") { (file: String, count: Int) -> [Double] in
      try AudioFiles.peaks(of: .fromJS(file), count: count)
    }
    .runOnQueue(DispatchQueue.global(qos: .userInitiated))

    AsyncFunction("recoverOrphanedRecordings") { (projectsDir: String) -> [[String: Any]] in
      AudioFiles.recoverOrphans(projectsDir: .fromJS(projectsDir))
    }
    .runOnQueue(DispatchQueue.global(qos: .utility))

    // MARK: playback

    AsyncFunction("load") { (source: PlayerSourceRecord, meta: NowPlayingRecord?, promise: Promise) in
      self.player.load(source) { result in
        switch result {
        case .success(let duration):
          if let meta, !meta.title.isEmpty, source.kind != "silent" {
            self.nowPlaying.setMeta(title: meta.title, artist: meta.artist)
          } else {
            self.nowPlaying.clear()
          }
          promise.resolve(["durationSec": duration])
        case .failure(let error):
          promise.reject(error)
        }
      }
    }
    .runOnQueue(audioQueue)

    Function("play") {
      self.audioQueue.async { self.player.play() }
    }
    Function("pause") {
      self.audioQueue.async { self.player.pause() }
    }
    Function("seek") { (sec: Double) in
      self.audioQueue.async { self.player.seek(sec) }
    }
    Function("setLoop") { (on: Bool) in
      self.audioQueue.async { self.player.setLoop(on) }
    }
    Function("setRate") { (rate: Double) in
      self.audioQueue.async { self.player.setRate(rate) }
    }
    Function("unload") {
      self.audioQueue.async {
        self.player.unload()
        self.nowPlaying.clear()
      }
    }
  }

  // MARK: - Setup

  private func setUp() {
    session.onInterruption = { [weak self] began, reason in
      self?.audioQueue.async { self?.handleInterruption(began: began, reason: reason) }
    }
    session.onRouteChange = { [weak self] reason in
      self?.audioQueue.async { self?.emitRouteChange(reason: reason) }
    }
    session.onMediaServicesReset = { [weak self] in
      self?.audioQueue.async {
        guard let self else { return }
        // All AV objects are invalid now. Finalize any take; drop the player source.
        if self.recorder != nil { self.finalizeInterrupted() }
        self.player.unload()
        self.sendEvent("interruption", ["phase": "began", "reason": "mediaReset", "recordingStopped": self.pendingResult != nil])
      }
    }
    session.startObserving()

    player.onClock = { [weak self] body in
      self?.sendEvent("clock", body)
    }
    player.onStateChange = { [weak self] in
      guard let self else { return }
      self.nowPlaying.update(
        position: self.player.currentPosition(), duration: self.player.duration,
        rate: self.player.rate, playing: self.player.status == "playing"
      )
    }
    nowPlaying.onPlay = { [weak self] in self?.audioQueue.async { self?.player.play() } }
    nowPlaying.onPause = { [weak self] in self?.audioQueue.async { self?.player.pause() } }
    nowPlaying.onSeek = { [weak self] sec in self?.audioQueue.async { self?.player.seek(sec) } }
  }

  // MARK: - Recording

  private func startRecording(_ opts: StartRecordingRecord) throws {
    if recorder != nil { throw AriaAudioException.alreadyRecording }
    guard session.micPermission() == "granted" else { throw AriaAudioException.micDenied }
    pendingResult = nil
    player.pauseForRecording()

    try session.activate(for: .recording)
    if let sr = opts.sampleRate { session.setPreferredSampleRate(sr) }

    let rec = Recorder(projectDir: .fromJS(opts.projectDir), maxDurationSec: opts.maxDurationSec, callbackQueue: audioQueue)
    rec.onLevel = { [weak self] rms, peak in
      self?.sendEvent("level", ["rms": Double(rms), "peak": Double(peak), "meter": Double(meterValue(rms))])
    }
    rec.onWarning = { [weak self] kind in
      self?.sendEvent("inputWarning", ["kind": kind])
    }
    rec.onCountInBeat = { [weak self] beat, beats, audible in
      self?.sendEvent("countInBeat", ["beat": beat, "beats": beats, "audible": audible])
    }
    rec.onStatus = { [weak self] state, elapsed in
      self?.sendEvent("recordingStatus", ["state": state, "elapsedSec": elapsed])
    }
    rec.onAutoStop = { [weak self] in
      // already on audioQueue
      self?.finalizeInterrupted()
    }
    do {
      try rec.start(countIn: opts.countIn, clicksAudible: session.isHeadphoneOutput)
    } catch {
      rec.finish()
      try? FileManager.default.removeItem(at: rec.cafURL)
      throw error
    }
    recorder = rec
  }

  private func finalizeInterrupted() {
    guard let rec = recorder else { return }
    pendingResult = rec.finish(interrupted: true)
    recorder = nil
  }

  private func stopRecording() throws -> [String: Any] {
    let result: Recorder.Result
    if let rec = recorder {
      result = rec.finish()
      recorder = nil
    } else if let pending = pendingResult {
      result = pending
    } else {
      throw AriaAudioException.notRecording
    }
    pendingResult = nil
    let (file, duration) = AudioFiles.finalizeRecording(caf: result.cafURL)
    try? session.activate(for: .playback)
    return [
      "file": file.absoluteString,
      "durationSec": duration > 0 ? duration : result.durationSec,
      "countInEndSec": result.countInEndSec,
      "sampleRate": result.sampleRate,
      "interrupted": result.interrupted,
    ]
  }

  // MARK: - Session events

  private func handleInterruption(began: Bool, reason: String) {
    var stopped = false
    if began {
      // Never auto-resume into the same file (§8.1): finalize now, the UI offers Keep / Record again.
      if recorder != nil {
        finalizeInterrupted()
        stopped = true
      }
      player.pause()
    }
    sendEvent("interruption", ["phase": began ? "began" : "ended", "reason": reason, "recordingStopped": stopped])
  }

  private func emitRouteChange(reason: String) {
    // Losing the recording input (e.g. unplugging a USB mic) mid-take is treated like an interruption.
    if reason == "oldDeviceUnavailable", recorder != nil {
      finalizeInterrupted()
      sendEvent("interruption", ["phase": "began", "reason": "route", "recordingStopped": true])
    }
    // Headphones pulled out: pause playback like every other audio app.
    if reason == "oldDeviceUnavailable", player.status == "playing", session.outputKind == "speaker" {
      player.pause()
    }
    sendEvent("routeChange", [
      "inputs": session.inputs(),
      "output": session.outputKind,
      "outputLatency": session.outputLatency,
      "reason": reason,
    ])
    player.emitClock()
  }
}
