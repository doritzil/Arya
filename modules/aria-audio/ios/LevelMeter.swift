import Foundation

/// RMS/peak metering at a fixed report rate plus quiet/clipping warnings with hysteresis (FR-2, §8.1).
/// Not thread-safe: fed from the input tap thread only. Unit-testable without audio hardware.
final class LevelMeter {
  struct Thresholds {
    /// *quiet* if RMS stays below this while playing is expected.
    var quietDb: Float = -45
    /// *clipping* if peak reaches this repeatedly.
    var clipDb: Float = -1
    /// A condition must hold this long before a warning fires (hysteresis ≥ 1.5 s).
    var warnAfterSec: Double = 1.5
    /// Clipping needs this many clipped report frames within `warnAfterSec`.
    var clipFramesToWarn: Int = 3
    /// Quiet clears after this much normal level; clipping clears after `warnAfterSec` clean.
    var quietClearSec: Double = 0.5
  }

  struct Report {
    let rmsDb: Float
    let peakDb: Float
  }

  enum Warning: String {
    case quiet
    case clipping
  }

  var thresholds = Thresholds()
  let reportFrames: Int
  private let frameSec: Double

  private var sumSquares: Double = 0
  private var peak: Float = 0
  private var frames = 0

  private(set) var warning: Warning?
  private var quietFor: Double = 0
  private var okFor: Double = 0
  private var clipTimes: [Double] = []
  private var clock: Double = 0

  /// Warnings are suppressed until this time (count-in).
  var armedAfterSec: Double = 0

  init(sampleRate: Double, reportHz: Double = 20) {
    reportFrames = max(1, Int(sampleRate / reportHz))
    frameSec = 1 / reportHz
  }

  /// Feed mono samples. Calls `onReport` at `reportHz` and `onWarning` when the warning state changes
  /// (`nil` = cleared).
  func process(_ samples: UnsafePointer<Float>, count: Int, onReport: (Report) -> Void, onWarning: (Warning?) -> Void) {
    var i = 0
    while i < count {
      let n = min(count - i, reportFrames - frames)
      for j in i..<(i + n) {
        let s = samples[j]
        sumSquares += Double(s * s)
        let a = abs(s)
        if a > peak { peak = a }
      }
      frames += n
      i += n
      if frames >= reportFrames {
        let rms = Float(sqrt(sumSquares / Double(frames)))
        let report = Report(rmsDb: dBFS(rms), peakDb: dBFS(peak))
        sumSquares = 0
        peak = 0
        frames = 0
        onReport(report)
        if let change = evaluate(report) {
          onWarning(change.warning)
        }
      }
    }
  }

  private struct Change { let warning: Warning? }

  private func evaluate(_ r: Report) -> Change? {
    clock += frameSec
    guard clock >= armedAfterSec else { return nil }

    if r.peakDb >= thresholds.clipDb { clipTimes.append(clock) }
    clipTimes.removeAll { clock - $0 > thresholds.warnAfterSec }
    let clipping = clipTimes.count >= thresholds.clipFramesToWarn
    let quiet = r.rmsDb < thresholds.quietDb

    quietFor = quiet ? quietFor + frameSec : 0
    okFor = (!quiet && clipTimes.isEmpty) ? okFor + frameSec : 0

    let previous = warning
    switch warning {
    case nil:
      if clipping { warning = .clipping } else if quietFor >= thresholds.warnAfterSec { warning = .quiet }
    case .quiet?:
      if clipping { warning = .clipping } else if !quiet && okFor >= thresholds.quietClearSec { warning = nil }
    case .clipping?:
      if clipTimes.isEmpty && okFor >= thresholds.warnAfterSec { warning = nil }
    }
    return previous == warning ? nil : Change(warning: warning)
  }
}
