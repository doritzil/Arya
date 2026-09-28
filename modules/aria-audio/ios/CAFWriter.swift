import Foundation

/// Crash-safe recorder file (NFR-8).
///
/// Writes a CAF file by hand: a `desc` chunk for 16-bit little-endian mono/stereo PCM followed by a `data`
/// chunk whose size is `-1` ("unknown, runs to end of file"), which the CAF spec allows for the last chunk.
/// Samples are appended and `fsync`ed about twice a second, so after a crash or a kill the file is readable
/// by `AVAudioFile` up to the last flush. `close()` patches the real data size in for tidiness.
///
/// We don't use `AVAudioFile(forWriting:)` here because it offers no flush: its header/data are only
/// guaranteed consistent after the file is deallocated.
final class CAFWriter {
  let url: URL
  let sampleRate: Double
  let channels: Int

  private let handle: FileHandle
  private var pending = Data()
  private var dataBytes: Int64 = 0
  private var dataSizeOffset: UInt64 = 0
  private var lastSync = CFAbsoluteTimeGetCurrent()
  private let syncInterval: CFAbsoluteTime = 0.5
  private(set) var framesWritten: Int64 = 0
  private var closed = false

  init(url: URL, sampleRate: Double, channels: Int = 1) throws {
    self.url = url
    self.sampleRate = sampleRate
    self.channels = channels
    let fm = FileManager.default
    if fm.fileExists(atPath: url.path) {
      try fm.removeItem(at: url)
    }
    // completeUntilFirstUserAuthentication: recording must continue with the screen locked (§12).
    guard fm.createFile(atPath: url.path, contents: nil, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]) else {
      throw AriaAudioException.io("Could not create \(url.lastPathComponent)")
    }
    handle = try FileHandle(forWritingTo: url)
    try writeHeader()
  }

  deinit {
    try? close()
  }

  private func writeHeader() throws {
    var h = Data()
    // File header
    h.append(contentsOf: Array("caff".utf8))
    h.appendBE(UInt16(1)) // version
    h.appendBE(UInt16(0)) // flags
    // 'desc' chunk
    h.append(contentsOf: Array("desc".utf8))
    h.appendBE(Int64(32))
    h.appendBE(sampleRate.bitPattern) // Float64 big-endian
    h.append(contentsOf: Array("lpcm".utf8))
    h.appendBE(UInt32(2)) // kCAFLinearPCMFormatFlagIsLittleEndian (integer samples)
    h.appendBE(UInt32(2 * channels)) // bytes per packet
    h.appendBE(UInt32(1)) // frames per packet
    h.appendBE(UInt32(channels))
    h.appendBE(UInt32(16)) // bits per channel
    // 'data' chunk, size unknown (-1) until close
    h.append(contentsOf: Array("data".utf8))
    dataSizeOffset = UInt64(h.count)
    h.appendBE(Int64(-1))
    h.appendBE(UInt32(0)) // edit count
    try handle.write(contentsOf: h)
    try handle.synchronize()
  }

  /// Appends float samples (−1…1). For stereo, `samples` is interleaved. Called on the tap thread.
  func append(_ samples: UnsafePointer<Float>, count: Int) throws {
    guard !closed, count > 0 else { return }
    let start = pending.count
    pending.count += count * 2
    pending.withUnsafeMutableBytes { raw in
      let out = raw.baseAddress!.advanced(by: start).assumingMemoryBound(to: Int16.self)
      for i in 0..<count {
        let clamped = max(-1, min(1, samples[i]))
        out[i] = Int16(clamped * Float(Int16.max)).littleEndian
      }
    }
    framesWritten += Int64(count / channels)
    if CFAbsoluteTimeGetCurrent() - lastSync >= syncInterval {
      try flush()
    }
  }

  func flush() throws {
    guard !closed else { return }
    if !pending.isEmpty {
      try handle.write(contentsOf: pending)
      dataBytes += Int64(pending.count)
      pending.removeAll(keepingCapacity: true)
    }
    try handle.synchronize()
    lastSync = CFAbsoluteTimeGetCurrent()
  }

  func close() throws {
    guard !closed else { return }
    try flush()
    // Patch the data chunk size (= edit count + audio bytes).
    try handle.seek(toOffset: dataSizeOffset)
    var size = Data()
    size.appendBE(Int64(4 + dataBytes))
    try handle.write(contentsOf: size)
    try handle.synchronize()
    try handle.close()
    closed = true
  }

  var durationSec: Double { Double(framesWritten) / sampleRate }
}

private extension Data {
  mutating func appendBE<T: FixedWidthInteger>(_ value: T) {
    var be = value.bigEndian
    Swift.withUnsafeBytes(of: &be) { append(contentsOf: $0) }
  }
}
