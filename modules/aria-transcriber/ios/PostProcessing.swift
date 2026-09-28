import Foundation

/// Stitched activations for the whole file, quantized to UInt8 (0…255) to keep 10 minutes of
/// 100 fps × 88 keys × 4 heads at ~21 MB instead of ~85 MB (NFR-6). Append-only; also the on-disk
/// checkpoint format (`cache/tx-partial.bin`).
struct ActivationTrack {
  /// bytes per frame: onset, frame, offset, velocity (88 each) + pedal (1)
  static let stride = FrameActivations.keys * 4 + 1

  let frameRate: Double
  var hasOffsets = false
  var hasPedal = false
  private(set) var data = [UInt8]()

  init(frameRate: Double) {
    self.frameRate = frameRate
  }

  init(frameRate: Double, data: [UInt8], hasOffsets: Bool, hasPedal: Bool) {
    self.frameRate = frameRate
    self.data = data
    self.hasOffsets = hasOffsets
    self.hasPedal = hasPedal
  }

  var frameCount: Int { data.count / Self.stride }

  /// Appends frames `[from, to)` of a chunk — the chunk's kept (central) region. Returns the appended bytes.
  @discardableResult
  mutating func append(_ a: FrameActivations, from: Int, to: Int) -> [UInt8] {
    let keys = FrameActivations.keys
    hasOffsets = hasOffsets || a.offsets != nil
    hasPedal = hasPedal || a.pedal != nil
    let lo = max(0, from), hi = min(a.frameCount, to)
    guard hi > lo else { return [] }
    var chunk = [UInt8](repeating: 0, count: (hi - lo) * Self.stride)
    @inline(__always) func q(_ v: Float) -> UInt8 { UInt8(max(0, min(255, (v * 255).rounded()))) }
    for f in lo..<hi {
      let base = (f - lo) * Self.stride
      for k in 0..<keys {
        let i = a.index(f, k)
        chunk[base + k] = q(a.onsets[i])
        chunk[base + keys + k] = q(a.frames[i])
        chunk[base + 2 * keys + k] = q(a.offsets?[i] ?? 0)
        chunk[base + 3 * keys + k] = q(a.velocities[i])
      }
      chunk[base + 4 * keys] = q(a.pedal?[f] ?? 0)
    }
    data.append(contentsOf: chunk)
    return chunk
  }

  @inline(__always) func onset(_ f: Int, _ k: Int) -> Float { Float(data[f * Self.stride + k]) / 255 }
  @inline(__always) func frame(_ f: Int, _ k: Int) -> Float { Float(data[f * Self.stride + FrameActivations.keys + k]) / 255 }
  @inline(__always) func offset(_ f: Int, _ k: Int) -> Float { Float(data[f * Self.stride + 2 * FrameActivations.keys + k]) / 255 }
  @inline(__always) func velocity(_ f: Int, _ k: Int) -> Float { Float(data[f * Self.stride + 3 * FrameActivations.keys + k]) / 255 }
  @inline(__always) func pedal(_ f: Int) -> Float { Float(data[f * Self.stride + 4 * FrameActivations.keys]) / 255 }
}

struct RawNoteOut {
  var pitch: Int
  var onset: Double
  var offset: Double
  var velocity: Int
}

struct PedalOut {
  var on: Double
  var off: Double
}

/// Frame activations → notes and pedal (§7.2 post-processing). Pure, unit-testable (XCTest).
enum PostProcessing {
  struct Params {
    var onsetThreshold: Float = 0.5
    var frameThreshold: Float = 0.3
    var offsetThreshold: Float = 0.5
    var pedalOn: Float = 0.5
    var pedalOff: Float = 0.3
    var minNoteSec: Double = 0.03
    var minPedalSec: Double = 0.1
  }

  /// Onset peak picking (local maxima above threshold, sub-frame refined by a parabola through the peak),
  /// sustained while the frame head stays active, ended early by an offset peak or a re-strike.
  static func notes(_ t: ActivationTrack, startSec: Double, params p: Params = Params()) -> [RawNoteOut] {
    let n = t.frameCount
    let fr = t.frameRate
    var out: [RawNoteOut] = []
    guard n > 0 else { return out }
    for k in 0..<FrameActivations.keys {
      var f = 0
      while f < n {
        let o = t.onset(f, k)
        let prev = f > 0 ? t.onset(f - 1, k) : 0
        let next = f + 1 < n ? t.onset(f + 1, k) : 0
        guard o >= p.onsetThreshold, o >= prev, o > next else { f += 1; continue }

        // Sub-frame refinement: vertex of the parabola through (f-1, f, f+1).
        let denom = prev - 2 * o + next
        let delta = denom != 0 ? Double(0.5 * (prev - next) / denom) : 0
        let onsetSec = (Double(f) + max(-0.5, min(0.5, delta))) / fr

        // Sustain
        var end = f + 1
        while end < n {
          if t.frame(end, k) < p.frameThreshold { break }
          if t.hasOffsets && t.offset(end, k) >= p.offsetThreshold { break }
          // a new onset peak on the same key = re-strike
          let eo = t.onset(end, k)
          if eo >= p.onsetThreshold && eo >= t.onset(end - 1, k) && (end + 1 >= n || eo > t.onset(end + 1, k)) { break }
          end += 1
        }
        let offsetSec = Double(end) / fr
        if offsetSec - onsetSec >= p.minNoteSec {
          let v = Int((t.velocity(f, k) * 127).rounded())
          out.append(RawNoteOut(
            pitch: FrameActivations.lowestPitch + k,
            onset: startSec + onsetSec,
            offset: startSec + offsetSec,
            velocity: max(1, min(127, v))
          ))
        }
        f = max(f + 1, end)
      }
    }
    out.sort { $0.onset != $1.onset ? $0.onset < $1.onset : $0.pitch < $1.pitch }
    return out
  }

  /// Sustain pedal spans with hysteresis.
  static func pedal(_ t: ActivationTrack, startSec: Double, params p: Params = Params()) -> [PedalOut] {
    guard t.hasPedal else { return [] }
    var spans: [PedalOut] = []
    var down: Int?
    for f in 0..<t.frameCount {
      let v = t.pedal(f)
      if down == nil, v >= p.pedalOn {
        down = f
      } else if let d = down, v < p.pedalOff {
        appendSpan(&spans, from: d, to: f, fr: t.frameRate, startSec: startSec, min: p.minPedalSec)
        down = nil
      }
    }
    if let d = down {
      appendSpan(&spans, from: d, to: t.frameCount, fr: t.frameRate, startSec: startSec, min: p.minPedalSec)
    }
    return spans
  }

  private static func appendSpan(_ spans: inout [PedalOut], from: Int, to: Int, fr: Double, startSec: Double, min: Double) {
    let on = startSec + Double(from) / fr, off = startSec + Double(to) / fr
    if off - on >= min { spans.append(PedalOut(on: on, off: off)) }
  }

  /// FR-7: a note released while the pedal is down keeps sounding until the pedal is released or the same
  /// key is struck again.
  static func applyPedal(_ notes: [RawNoteOut], pedal: [PedalOut]) -> [RawNoteOut] {
    guard !pedal.isEmpty else { return notes }
    // next onset per pitch, for re-strike limits
    var nextOnset = [Double](repeating: .infinity, count: notes.count)
    var lastIndexForPitch: [Int: Int] = [:]
    for i in stride(from: notes.count - 1, through: 0, by: -1) {
      let p = notes[i].pitch
      if let j = lastIndexForPitch[p] { nextOnset[i] = notes[j].onset }
      lastIndexForPitch[p] = i
    }
    var out = notes
    var s = 0
    for i in out.indices {
      let off = out[i].offset
      // pedal spans are sorted; advance to the first span that could contain `off`
      while s < pedal.count && pedal[s].off < out[i].onset { s += 1 }
      var j = s
      while j < pedal.count && pedal[j].on <= off {
        if pedal[j].off > off {
          out[i].offset = min(pedal[j].off, nextOnset[i])
          break
        }
        j += 1
      }
      out[i].offset = max(out[i].offset, off)
    }
    return out
  }
}
