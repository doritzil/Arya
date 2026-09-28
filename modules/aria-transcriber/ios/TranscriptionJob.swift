import AVFoundation
import UIKit

enum TranscriberError: Error {
  case cancelled
  case decode(String)
  case model(String)
  case io(String)

  var code: String {
    switch self {
    case .cancelled: return "cancelled"
    case .decode: return "decode"
    case .model: return "model"
    case .io: return "io"
    }
  }

  var message: String {
    switch self {
    case .cancelled: return "Cancelled"
    case .decode(let m), .model(let m), .io(let m): return m
    }
  }
}

/// Checkpoint metadata stored next to `cache/tx-partial.bin` (§7.2 backgrounding).
struct TranscriptionCheckpoint: Codable {
  var audioPath: String
  var startAtSec: Double
  var modelId: String
  var modelVersion: String
  var frameRate: Double
  var chunksDone: Int
  var hasOffsets: Bool
  var hasPedal: Bool
}

/// One transcription: decode → chunk (10 s, 2 s overlap) → model → stitch central regions → post-process →
/// write notes.raw.json atomically. Runs in a detached `Task`; cancellation is checked between chunks.
final class TranscriptionJob {
  static let overlapSec = 2.0

  let id: String
  let audioURL: URL
  let outURL: URL
  let startAtSec: Double
  private let model: TranscriptionModel
  private let emit: (_ event: String, _ body: [String: Any]) -> Void
  private var task: Task<Void, Never>?
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
  /// Set when iOS is about to suspend us; the job checkpoints and parks until foreground.
  private let suspendFlag = AtomicFlag()
  var onFinish: (() -> Void)?

  private var cacheDir: URL { outURL.deletingLastPathComponent().appendingPathComponent("cache", isDirectory: true) }
  private var checkpointBin: URL { cacheDir.appendingPathComponent("tx-partial.bin") }
  private var checkpointMeta: URL { cacheDir.appendingPathComponent("tx-partial.json") }

  init(id: String, audioURL: URL, outURL: URL, startAtSec: Double, model: TranscriptionModel,
       emit: @escaping (_ event: String, _ body: [String: Any]) -> Void) {
    self.id = id
    self.audioURL = audioURL
    self.outURL = outURL
    self.startAtSec = startAtSec
    self.model = model
    self.emit = emit
  }

  func start() {
    beginBackgroundTask()
    task = Task.detached(priority: .userInitiated) { [self] in
      let began = CFAbsoluteTimeGetCurrent()
      do {
        let (notes, pedal) = try await run()
        try writeOutput(notes: notes, pedal: pedal)
        clearCheckpoint()
        emit("progress", ["jobId": id, "fraction": 1.0, "stage": "notes"])
        emit("done", [
          "jobId": id,
          "noteCount": notes.count,
          "pedalCount": pedal.count,
          "elapsedMs": Int((CFAbsoluteTimeGetCurrent() - began) * 1000),
          "outPath": outURL.absoluteString,
        ])
      } catch let e as TranscriberError {
        if case .cancelled = e { clearCheckpoint() }
        emit("error", ["jobId": id, "code": e.code, "message": e.message])
      } catch is CancellationError {
        clearCheckpoint()
        emit("error", ["jobId": id, "code": "cancelled", "message": "Cancelled"])
      } catch {
        emit("error", ["jobId": id, "code": "io", "message": "\(error)"])
      }
      endBackgroundTask()
      onFinish?()
    }
  }

  func cancel() {
    task?.cancel()
  }

  // MARK: - Pipeline

  private func run() async throws -> ([RawNoteOut], [PedalOut]) {
    let decoder: AudioDecoder
    do {
      decoder = try AudioDecoder(url: audioURL, targetRate: model.sampleRate)
    } catch let e as TranscriberError {
      throw e
    } catch {
      throw TranscriberError.decode("\(error)")
    }

    let chunkSec = model.chunkSeconds
    let hopSec = chunkSec - Self.overlapSec
    let margin = Self.overlapSec / 2
    let audioSec = max(0, decoder.durationSec - startAtSec)
    let chunkCount = max(1, Int(ceil(max(0, audioSec - Self.overlapSec) / hopSec)))
    let fr = model.frameRate

    // Resume from a checkpoint written by an earlier, suspended/killed run of the same job.
    var track = ActivationTrack(frameRate: fr)
    var firstChunk = 0
    if let cp = loadCheckpoint(), cp.chunksDone < chunkCount {
      track = cp.track
      firstChunk = cp.chunksDone
    }

    for k in firstChunk..<chunkCount {
      try Task.checkCancellation()
      await waitWhileSuspended()
      await thermalPause()

      let chunkStart = Double(k) * hopSec
      let samples = try autoreleasepool { try decoder.read(startSec: startAtSec + chunkStart, seconds: chunkSec) }
      let act: FrameActivations
      do {
        act = try autoreleasepool { try model.predict(samples: samples) }
      } catch {
        throw TranscriberError.model("\(error)")
      }

      // Keep the chunk's central region so every frame comes from where the model had context both sides.
      let isLast = k == chunkCount - 1
      let keepFrom = k == 0 ? 0 : Int((margin * fr).rounded())
      let keepTo = isLast
        ? Int(((audioSec - chunkStart) * fr).rounded())
        : Int(((chunkSec - margin) * fr).rounded())
      let appended = track.append(act, from: keepFrom, to: keepTo)
      saveCheckpoint(chunksDone: k + 1, appended: appended, track: track)

      emit("progress", ["jobId": id, "fraction": min(0.99, Double(k + 1) / Double(chunkCount)), "stage": "notes"])
    }

    let pedal = PostProcessing.pedal(track, startSec: startAtSec)
    let notes = PostProcessing.applyPedal(PostProcessing.notes(track, startSec: startAtSec), pedal: pedal)
    return (notes, pedal)
  }

  /// NFR-6: on `.serious` insert short pauses between chunks rather than fail.
  private func thermalPause() async {
    switch ProcessInfo.processInfo.thermalState {
    case .serious: try? await Task.sleep(nanoseconds: 2_000_000_000)
    case .critical: try? await Task.sleep(nanoseconds: 6_000_000_000)
    default: break
    }
  }

  private func waitWhileSuspended() async {
    while suspendFlag.value && !Task.isCancelled {
      try? await Task.sleep(nanoseconds: 500_000_000)
    }
  }

  // MARK: - Output

  private func writeOutput(notes: [RawNoteOut], pedal: [PedalOut]) throws {
    func r(_ x: Double) -> Double { (x * 1000).rounded() / 1000 }
    let json: [String: Any] = [
      "notes": notes.enumerated().map { i, n in
        ["id": "n\(i + 1)", "pitch": n.pitch, "onset": r(n.onset), "offset": r(n.offset), "velocity": n.velocity] as [String: Any]
      },
      "pedal": pedal.map { ["on": r($0.on), "off": r($0.off)] },
      "frameRate": model.frameRate,
      "modelId": model.id,
      "modelVersion": model.version,
    ]
    do {
      let data = try JSONSerialization.data(withJSONObject: json, options: [])
      try FileManager.default.createDirectory(at: outURL.deletingLastPathComponent(), withIntermediateDirectories: true)
      // .atomic = write to a temp file then rename.
      try data.write(to: outURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    } catch {
      throw TranscriberError.io("Could not write \(outURL.lastPathComponent): \(error)")
    }
  }

  // MARK: - Checkpoints

  private func loadCheckpoint() -> (chunksDone: Int, track: ActivationTrack)? {
    guard let metaData = try? Data(contentsOf: checkpointMeta),
          let meta = try? JSONDecoder().decode(TranscriptionCheckpoint.self, from: metaData),
          meta.audioPath == audioURL.path, meta.startAtSec == startAtSec,
          meta.modelId == model.id, meta.modelVersion == model.version, meta.frameRate == model.frameRate,
          let bin = try? Data(contentsOf: checkpointBin)
    else { return nil }
    let track = ActivationTrack(frameRate: meta.frameRate, data: [UInt8](bin), hasOffsets: meta.hasOffsets, hasPedal: meta.hasPedal)
    return (meta.chunksDone, track)
  }

  private func saveCheckpoint(chunksDone: Int, appended: [UInt8], track: ActivationTrack) {
    do {
      try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
      if chunksDone == 1 || !FileManager.default.fileExists(atPath: checkpointBin.path) {
        try Data(track.data).write(to: checkpointBin)
      } else {
        let h = try FileHandle(forWritingTo: checkpointBin)
        try h.seekToEnd()
        try h.write(contentsOf: appended)
        try h.close()
      }
      let meta = TranscriptionCheckpoint(
        audioPath: audioURL.path, startAtSec: startAtSec, modelId: model.id, modelVersion: model.version,
        frameRate: model.frameRate, chunksDone: chunksDone, hasOffsets: track.hasOffsets, hasPedal: track.hasPedal
      )
      // Meta written after the bin: a torn bin append is never referenced by a newer chunksDone.
      try JSONEncoder().encode(meta).write(to: checkpointMeta, options: .atomic)
    } catch {
      NSLog("[AriaTranscriber] checkpoint failed: \(error)")
    }
  }

  private func clearCheckpoint() {
    try? FileManager.default.removeItem(at: checkpointBin)
    try? FileManager.default.removeItem(at: checkpointMeta)
  }

  // MARK: - Background execution

  /// Keeps going for the ~30 s iOS grants after backgrounding. On expiry the job parks (checkpoint is
  /// already on disk after each chunk) and continues when the app returns to the foreground; if the app
  /// is killed instead, calling `transcribe` again with the same paths resumes from the checkpoint.
  /// TODO(iOS 26): use BGContinuedProcessingTask (identifier registered by withAriaInfoPlist) to keep
  /// running with system progress UI.
  private func beginBackgroundTask() {
    DispatchQueue.main.async { [self] in
      backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "aria.transcribe.\(id)") { [self] in
        suspendFlag.value = true
        endBackgroundTask()
      }
    }
  }

  private func endBackgroundTask() {
    DispatchQueue.main.async { [self] in
      guard backgroundTask != .invalid else { return }
      UIApplication.shared.endBackgroundTask(backgroundTask)
      backgroundTask = .invalid
    }
  }

  /// Called by the module on `willEnterForeground`.
  func resumeIfSuspended() {
    guard suspendFlag.value else { return }
    suspendFlag.value = false
    beginBackgroundTask()
  }
}

/// Minimal lock-protected Bool (avoids pulling in swift-atomics).
final class AtomicFlag {
  private let lock = NSLock()
  private var _value = false
  var value: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _value }
    set { lock.lock(); _value = newValue; lock.unlock() }
  }
}
