import CoreML
import Foundation

/// Spotify's Basic Pitch (ICASSP 2022, Apache-2.0, https://github.com/spotify/basic-pitch) as the bundled
/// transcription model. Polyphonic and instrument-agnostic, tiny (~270 KB), with the CQT front end inside the
/// Core ML graph, so it takes raw audio.
///
/// Spec (nmp.mlpackage from basic-pitch 0.4.0):
///   input  "input_2"    Float32 [1, 43844, 1]   mono audio at 22 050 Hz (~2 s)
///   output "Identity"   Float32 [1, 172, 264]   pitch contour (unused)
///   output "Identity_1" Float32 [1, 172, 88]    note (frame) activations
///   output "Identity_2" Float32 [1, 172, 88]    onset activations
/// 172 frames at 22 050 / 256 ≈ 86.13 fps. No velocity, offset or pedal heads.
///
/// The model ships as plain files in the `AriaTranscriberModel` resource bundle (see the podspec). On first use
/// they are put back into an .mlpackage, compiled on device and the result cached in Application Support.
final class BasicPitchModel: TranscriptionModel {
  static let modelId = "basic-pitch"
  static let modelVersion = "icassp_2022"
  private static let bundleName = "AriaTranscriberModel"
  private static let inputSamples = 43844
  private static let hopSamples = 256

  let id = BasicPitchModel.modelId
  let version = BasicPitchModel.modelVersion
  let sampleRate: Double = 22050
  let chunkSeconds: Double = Double(BasicPitchModel.inputSamples) / 22050
  let frameRate: Double = 22050 / Double(BasicPitchModel.hopSamples)
  /// Chosen so the hop between chunks is a whole number of frames (141 × 256 samples); otherwise the
  /// stitched timeline drifts by a fraction of a frame per chunk.
  let overlapSec: Double = Double(BasicPitchModel.inputSamples - 141 * BasicPitchModel.hopSamples) / 22050
  /// Basic Pitch's own defaults, except a shorter minimum note (theirs is ~128 ms) for fast piano passages.
  /// Its note head flickers, so a held note survives up to 11 quiet frames (their `energy_tol`). It also
  /// reports piano overtones as quiet notes an octave up; `overtoneRatio` removes those.
  let postParams = PostProcessing.Params(
    onsetThreshold: 0.5,
    frameThreshold: 0.3,
    minNoteSec: 0.06,
    frameTolerance: 11,
    overtoneRatio: 0.6
  )

  private let model: MLModel

  static var isBundled: Bool { resourceBundle()?.url(forResource: "BasicPitch.model", withExtension: "spec") != nil }

  init() throws {
    let config = MLModelConfiguration()
    // The GPU isn't available in the background; CPU + Neural Engine works in both states.
    config.computeUnits = .cpuAndNeuralEngine
    model = try MLModel(contentsOf: try Self.compiledModelURL(), configuration: config)
  }

  func predict(samples: [Float]) throws -> FrameActivations {
    let n = Self.inputSamples
    let input = try MLMultiArray(shape: [1, NSNumber(value: n), 1], dataType: .float32)
    let ptr = input.dataPointer.bindMemory(to: Float.self, capacity: n)
    let count = min(n, samples.count)
    samples.withUnsafeBufferPointer { src in
      if count > 0 { ptr.update(from: src.baseAddress!, count: count) }
    }
    if count < n { (ptr + count).initialize(repeating: 0, count: n - count) }

    let provider = try MLDictionaryFeatureProvider(dictionary: ["input_2": MLFeatureValue(multiArray: input)])
    let out = try model.prediction(from: provider)
    guard let note = out.featureValue(for: "Identity_1")?.multiArrayValue,
          let onset = out.featureValue(for: "Identity_2")?.multiArrayValue
    else { throw TranscriptionModelError.badOutput("missing Identity_1/Identity_2") }

    let t = note.shape.count >= 2 ? note.shape[note.shape.count - 2].intValue : 0
    guard t > 0 else { throw TranscriptionModelError.badOutput("empty note tensor") }
    let frames = try CoreMLOnsetsFramesModel.matrix(note, frames: t)
    let onsets = Self.inferOnsets(onsets: try CoreMLOnsetsFramesModel.matrix(onset, frames: t), frames: frames, frameCount: t)

    return FrameActivations(
      frameRate: frameRate,
      frameCount: t,
      onsets: onsets,
      frames: frames,
      offsets: nil,
      // No velocity head: loudness of the note activation at the onset is the closest stand-in.
      velocities: frames,
      pedal: nil
    )
  }

  /// Port of basic_pitch.note_creation.get_infered_onsets: also treat sharp rises in the note activation as
  /// onsets (min over 1- and 2-frame differences), rescaled to the predicted onsets' maximum.
  static func inferOnsets(onsets: [Float], frames: [Float], frameCount t: Int, nDiff: Int = 2) -> [Float] {
    let keys = FrameActivations.keys
    var diff = [Float](repeating: 0, count: t * keys)
    var maxDiff: Float = 0
    for f in nDiff..<max(nDiff, t) {
      for k in 0..<keys {
        var d = Float.greatestFiniteMagnitude
        for n in 1...nDiff { d = min(d, frames[f * keys + k] - frames[(f - n) * keys + k]) }
        let v = max(0, d)
        diff[f * keys + k] = v
        maxDiff = max(maxDiff, v)
      }
    }
    let maxOnset = onsets.max() ?? 0
    guard maxDiff > 0, maxOnset > 0 else { return onsets }
    let scale = maxOnset / maxDiff
    var out = onsets
    for i in out.indices { out[i] = max(out[i], diff[i] * scale) }
    return out
  }

  // MARK: - Loading

  private static func resourceBundle() -> Bundle? {
    for b in [Bundle.main, Bundle(for: BasicPitchModel.self)] {
      if let url = b.url(forResource: bundleName, withExtension: "bundle"), let bundle = Bundle(url: url) { return bundle }
    }
    return nil
  }

  private static func compiledModelURL() throws -> URL {
    let fm = FileManager.default
    let support = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let cacheDir = support.appendingPathComponent("AriaModels", isDirectory: true)
    let compiled = cacheDir.appendingPathComponent("\(modelId)-\(modelVersion).mlmodelc", isDirectory: true)
    if fm.fileExists(atPath: compiled.path) { return compiled }

    guard let bundle = resourceBundle(),
          let manifest = bundle.url(forResource: "BasicPitch.Manifest", withExtension: "json"),
          let spec = bundle.url(forResource: "BasicPitch.model", withExtension: "spec"),
          let weights = bundle.url(forResource: "BasicPitch.weight", withExtension: "bin")
    else { throw TranscriptionModelError.notBundled("\(bundleName).bundle/BasicPitch") }

    // Rebuild the .mlpackage layout that Manifest.json describes.
    let pkg = fm.temporaryDirectory.appendingPathComponent("BasicPitch-\(UUID().uuidString).mlpackage", isDirectory: true)
    defer { try? fm.removeItem(at: pkg) }
    let core = pkg.appendingPathComponent("Data/com.apple.CoreML", isDirectory: true)
    try fm.createDirectory(at: core.appendingPathComponent("weights", isDirectory: true), withIntermediateDirectories: true)
    try fm.copyItem(at: manifest, to: pkg.appendingPathComponent("Manifest.json"))
    try fm.copyItem(at: spec, to: core.appendingPathComponent("model.mlmodel"))
    try fm.copyItem(at: weights, to: core.appendingPathComponent("weights/weight.bin"))

    let temp = try MLModel.compileModel(at: pkg)
    try fm.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    if fm.fileExists(atPath: compiled.path) { try? fm.removeItem(at: compiled) }
    try fm.moveItem(at: temp, to: compiled)
    return compiled
  }
}
