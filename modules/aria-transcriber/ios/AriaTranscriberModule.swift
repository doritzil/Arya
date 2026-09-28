import ExpoModulesCore
import UIKit

struct TranscribeOptionsRecord: Record {
  @Field var startAtSec: Double = 0
  @Field var outPath: String = ""
  init() {}
}

/// `aria-transcriber` (ARCHITECTURE.md §7.2). JS surface: modules/aria-transcriber/index.ts.
public final class AriaTranscriberModule: Module {
  private let lock = NSLock()
  private var jobs: [String: TranscriptionJob] = [:]
  private var sharedModel: TranscriptionModel?
  private var foregroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AriaTranscriber")

    Events("progress", "done", "error")

    Constant("modelInfo") { () -> [String: Any] in
      let bundled = Bundle.main.url(forResource: CoreMLOnsetsFramesModel.resourceName, withExtension: "mlmodelc") != nil
      // Loading the model just to read metadata is expensive; the id/version are refreshed after first load.
      return [
        "id": self.sharedModel?.id ?? CoreMLOnsetsFramesModel.resourceName,
        "version": self.sharedModel?.version ?? "unknown",
        "available": bundled,
      ]
    }

    OnCreate {
      self.foregroundObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.willEnterForegroundNotification, object: nil, queue: nil
      ) { [weak self] _ in
        self?.allJobs().forEach { $0.resumeIfSuspended() }
      }
    }

    OnDestroy {
      if let o = self.foregroundObserver { NotificationCenter.default.removeObserver(o) }
      self.allJobs().forEach { $0.cancel() }
    }

    AsyncFunction("transcribe") { (audioPath: String, opts: TranscribeOptionsRecord) -> [String: Any] in
      guard !opts.outPath.isEmpty else {
        throw Exception(name: "BadOptions", description: "outPath is required", code: "ERR_BAD_OPTIONS")
      }
      let model = try self.loadModel()
      let jobId = UUID().uuidString
      let job = TranscriptionJob(
        id: jobId,
        audioURL: Self.url(audioPath),
        outURL: Self.url(opts.outPath),
        startAtSec: max(0, opts.startAtSec),
        model: model
      ) { [weak self] event, body in
        self?.sendEvent(event, body)
      }
      job.onFinish = { [weak self] in self?.removeJob(jobId) }
      self.lock.lock()
      self.jobs[jobId] = job
      self.lock.unlock()
      job.start()
      return ["jobId": jobId]
    }

    Function("cancel") { (jobId: String) in
      self.lock.lock()
      let job = self.jobs[jobId]
      self.lock.unlock()
      job?.cancel()
    }
  }

  /// Loaded once and shared; Core ML models are thread-safe for sequential predictions. Jobs run one chunk
  /// at a time each; two concurrent jobs would interleave predictions, which is fine but slower.
  private func loadModel() throws -> TranscriptionModel {
    lock.lock()
    defer { lock.unlock() }
    if let m = sharedModel { return m }
    do {
      let m = try CoreMLOnsetsFramesModel()
      sharedModel = m
      return m
    } catch {
      throw Exception(name: "ModelUnavailable", description: "\(error)", code: "ERR_MODEL")
    }
  }

  private func allJobs() -> [TranscriptionJob] {
    lock.lock()
    defer { lock.unlock() }
    return Array(jobs.values)
  }

  private func removeJob(_ id: String) {
    lock.lock()
    jobs[id] = nil
    lock.unlock()
  }

  private static func url(_ value: String) -> URL {
    if value.hasPrefix("file://"), let u = URL(string: value) { return u }
    return URL(fileURLWithPath: value)
  }
}
