import ExpoModulesCore
import Foundation
import QuartzCore

// MARK: - Records (JS → Swift argument shapes; see src/AriaAudio.types.ts)

struct CountInRecord: Record {
  @Field var bpm: Double = 90
  @Field var beats: Int = 4
  @Field var clickOnlyInHeadphones: Bool = true
  init() {}
}

struct StartRecordingRecord: Record {
  @Field var projectDir: String = ""
  @Field var sampleRate: Double? = nil
  @Field var countIn: CountInRecord? = nil
  @Field var maxDurationSec: Double = 600
  init() {}
}

struct SynthNoteRecord: Record {
  @Field var pitch: Int = 60
  @Field var startSec: Double = 0
  @Field var endSec: Double = 0
  @Field var velocity: Int = 80
  init() {}
}

struct PlayerSourceRecord: Record {
  /// 'file' | 'url' | 'synth' | 'silent'
  @Field var kind: String = ""
  @Field var uri: String? = nil
  @Field var url: String? = nil
  @Field var notes: [SynthNoteRecord]? = nil
  @Field var durationSec: Double? = nil
  init() {}
}

struct NowPlayingRecord: Record {
  @Field var title: String = ""
  @Field var artist: String? = nil
  init() {}
}

// MARK: - Errors

enum AriaAudioException {
  static func unknownInput(_ id: String) -> Exception {
    Exception(name: "UnknownInput", description: "No audio input with id \(id)", code: "ERR_UNKNOWN_INPUT")
  }
  static let alreadyRecording = Exception(name: "AlreadyRecording", description: "A recording is already running", code: "ERR_ALREADY_RECORDING")
  static let notRecording = Exception(name: "NotRecording", description: "No recording to stop", code: "ERR_NOT_RECORDING")
  static let noInput = Exception(name: "NoInput", description: "No audio input is available", code: "ERR_NO_INPUT")
  static let micDenied = Exception(name: "MicDenied", description: "Microphone permission was not granted", code: "ERR_MIC_DENIED")
  static func io(_ message: String) -> Exception {
    Exception(name: "AudioIO", description: message, code: "ERR_AUDIO_IO")
  }
  static func badSource(_ message: String) -> Exception {
    Exception(name: "BadSource", description: message, code: "ERR_BAD_SOURCE")
  }
}

// MARK: - Helpers

extension URL {
  /// JS passes either `file:///…` URIs (expo-file-system) or plain absolute paths.
  static func fromJS(_ value: String) -> URL {
    if value.hasPrefix("file://"), let url = URL(string: value) {
      return url
    }
    return URL(fileURLWithPath: value)
  }
}

@inline(__always) func dBFS(_ amplitude: Float) -> Float {
  amplitude <= 1e-8 ? -160 : 20 * log10f(amplitude)
}

@inline(__always) func meterValue(_ db: Float) -> Float {
  min(1, max(0, (db + 60) / 60))
}

/// Monotonic ms (same timebase as mach_absolute_time / CACurrentMediaTime).
func hostTimeMs() -> Double {
  CACurrentMediaTime() * 1000
}

func wallTimeMs() -> Double {
  Date().timeIntervalSince1970 * 1000
}
