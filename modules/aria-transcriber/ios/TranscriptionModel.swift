import CoreML
import Foundation

/// Per-frame model outputs for one chunk, already in "piano key × frame" layout.
/// All matrices are row-major `[frame][key]` with `keys` = 88 (MIDI 21…108), values 0…1.
struct FrameActivations {
  static let keys = 88
  static let lowestPitch = 21

  let frameRate: Double
  let frameCount: Int
  var onsets: [Float]
  var frames: [Float]
  /// Optional offset head (ByteDance has one; Onsets&Frames doesn't).
  var offsets: [Float]?
  /// Velocity 0…1 per frame/key (read at the onset frame).
  var velocities: [Float]
  /// Sustain pedal probability per frame (count = frameCount). nil if the model has no pedal head.
  var pedal: [Float]?

  @inline(__always) func index(_ frame: Int, _ key: Int) -> Int { frame * Self.keys + key }
}

/// The transcription network behind a stable seam, so the model chosen in the Phase 1 spike (§7.1) can be
/// swapped by writing one adapter. Implementations must be safe to call from a background task, one chunk
/// at a time.
protocol TranscriptionModel: AnyObject {
  var id: String { get }
  var version: String { get }
  /// Input sample rate (mono float32).
  var sampleRate: Double { get }
  /// Fixed input window the model was exported with; shorter final chunks are zero-padded.
  var chunkSeconds: Double { get }
  var frameRate: Double { get }
  /// `samples.count == Int(sampleRate * chunkSeconds)`.
  func predict(samples: [Float]) throws -> FrameActivations
}

enum TranscriptionModelError: Error, CustomStringConvertible {
  case notBundled(String)
  case badOutput(String)

  var description: String {
    switch self {
    case .notBundled(let name): return "\(name).mlmodelc is not in the app bundle"
    case .badOutput(let what): return "Unexpected model output: \(what)"
    }
  }
}

/// PLACEHOLDER adapter for an onsets / frames / (offsets) / velocity / pedal model, e.g. the ByteDance
/// high-resolution piano transcription network converted with coremltools (§7.1).
///
/// Assumed I/O — adjust after the Phase 1 spike to match the converted model's spec
/// (`xcrun coremlcompiler metadata AriaTranscriber.mlmodelc` or Xcode's model viewer):
///   input  "audio"    Float32 [1, sampleRate × chunkSeconds]   (log-mel front end inside the model)
///   output "onset"    Float32 [1, T, 88]
///   output "frame"    Float32 [1, T, 88]
///   output "offset"   Float32 [1, T, 88]   (optional)
///   output "velocity" Float32 [1, T, 88]   (0…1)
///   output "pedal"    Float32 [1, T]  or [1, T, 1]   (optional, sustain frame probability)
/// If the front end doesn't convert cleanly, compute log-mel with vDSP here and feed "mel" instead.
final class CoreMLOnsetsFramesModel: TranscriptionModel {
  static let resourceName = "AriaTranscriber"

  let id: String
  let version: String
  let sampleRate: Double = 16000
  let chunkSeconds: Double = 10
  let frameRate: Double = 100
  private let model: MLModel

  init() throws {
    guard let url = Bundle.main.url(forResource: Self.resourceName, withExtension: "mlmodelc") else {
      throw TranscriptionModelError.notBundled(Self.resourceName)
    }
    let config = MLModelConfiguration()
    // Prefers the Neural Engine. Note: the GPU is not usable while the app is in the background; if
    // background runs fail on device, reload with `.cpuAndNeuralEngine` when backgrounded (spike item).
    config.computeUnits = .all
    let loaded = try MLModel(contentsOf: url, configuration: config)
    let meta = loaded.modelDescription.metadata
    id = (meta[.creatorDefinedKey] as? [String: String])?["aria.modelId"] ?? Self.resourceName
    version = meta[.versionString] as? String ?? "0"
    model = loaded
  }

  func predict(samples: [Float]) throws -> FrameActivations {
    let n = Int(sampleRate * chunkSeconds)
    let input = try MLMultiArray(shape: [1, NSNumber(value: n)], dataType: .float32)
    let ptr = input.dataPointer.bindMemory(to: Float.self, capacity: n)
    samples.withUnsafeBufferPointer { src in
      let count = min(n, src.count)
      ptr.update(from: src.baseAddress!, count: count)
      if count < n { (ptr + count).initialize(repeating: 0, count: n - count) }
    }
    let provider = try MLDictionaryFeatureProvider(dictionary: ["audio": MLFeatureValue(multiArray: input)])
    let out = try model.prediction(from: provider)

    guard let onset = out.featureValue(for: "onset")?.multiArrayValue,
          let frame = out.featureValue(for: "frame")?.multiArrayValue,
          let velocity = out.featureValue(for: "velocity")?.multiArrayValue
    else { throw TranscriptionModelError.badOutput("missing onset/frame/velocity") }

    let t = onset.shape.count >= 2 ? onset.shape[onset.shape.count - 2].intValue : 0
    guard t > 0 else { throw TranscriptionModelError.badOutput("empty onset tensor") }

    return FrameActivations(
      frameRate: frameRate,
      frameCount: t,
      onsets: try Self.matrix(onset, frames: t),
      frames: try Self.matrix(frame, frames: t),
      offsets: try out.featureValue(for: "offset")?.multiArrayValue.map { try Self.matrix($0, frames: t) },
      velocities: try Self.matrix(velocity, frames: t),
      pedal: out.featureValue(for: "pedal")?.multiArrayValue.map { Self.vector($0, frames: t) }
    )
  }

  /// Copies a [1, T, 88] tensor (any strides, float32 or float16) into a dense row-major [T × 88] array.
  private static func matrix(_ a: MLMultiArray, frames t: Int) throws -> [Float] {
    let keys = FrameActivations.keys
    guard a.shape.count >= 2, a.shape[a.shape.count - 1].intValue == keys else {
      throw TranscriptionModelError.badOutput("expected [...,T,88], got \(a.shape)")
    }
    let s = a.strides.map(\.intValue)
    let st = s[s.count - 2], sk = s[s.count - 1]
    var out = [Float](repeating: 0, count: t * keys)
    read(a) { get in
      for f in 0..<t {
        for k in 0..<keys {
          out[f * keys + k] = get(f * st + k * sk)
        }
      }
    }
    return out
  }

  /// Gives `body` a strided element reader over the tensor's storage (float32 / float16 fast paths).
  private static func read(_ a: MLMultiArray, _ body: ((Int) -> Float) -> Void) {
    switch a.dataType {
    case .float32:
      a.withUnsafeBufferPointer(ofType: Float.self) { p in body { p[$0] } }
    case .float16:
      a.withUnsafeBufferPointer(ofType: Float16.self) { p in body { Float(p[$0]) } }
    default:
      let ptr = a.dataPointer
      let isDouble = a.dataType == .double
      body { i in
        isDouble ? Float(ptr.load(fromByteOffset: i * 8, as: Double.self)) : Float(ptr.load(fromByteOffset: i * 4, as: Int32.self))
      }
    }
  }

  private static func vector(_ a: MLMultiArray, frames t: Int) -> [Float] {
    // [1, T] or [1, T, 1]
    let s = a.strides.map(\.intValue)
    let st = a.shape.count >= 3 ? s[s.count - 2] : s[s.count - 1]
    var out = [Float](repeating: 0, count: t)
    read(a) { get in
      for f in 0..<t { out[f] = get(f * st) }
    }
    return out
  }
}
