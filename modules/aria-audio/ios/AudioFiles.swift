import AVFoundation

/// File-level audio utilities: CAF → ALAC transcode, imports, waveform peaks, crash recovery.
enum AudioFiles {
  /// Transcodes any readable audio file to ALAC in an .m4a container (lossless, ~50% of PCM).
  /// Writes to a temp file, verifies the frame count, then moves it into place. Returns the duration.
  @discardableResult
  static func transcodeToALAC(from src: URL, to dst: URL, maxChannels: AVAudioChannelCount = 2) throws -> Double {
    let fm = FileManager.default
    // AVAudioFile picks the container from the extension, so the temp file must end in .m4a.
    let tmp = dst.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).m4a")
    defer { try? fm.removeItem(at: tmp) }

    let input = try AVAudioFile(forReading: src)
    let format = input.processingFormat
    let channels = min(format.channelCount, maxChannels)
    guard input.length > 0 else { throw AriaAudioException.io("\(src.lastPathComponent) has no audio") }

    try autoreleasepool {
      let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatAppleLossless,
        AVSampleRateKey: format.sampleRate,
        AVNumberOfChannelsKey: channels,
        AVEncoderBitDepthHintKey: 16,
      ]
      // Scoped so the writer is deallocated (= finalized) before we verify it. iOS 18+ also has close().
      let output = try AVAudioFile(forWriting: tmp, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
      let needsDownmix = channels != format.channelCount
      guard let readBuf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 32768) else {
        throw AriaAudioException.io("Out of memory")
      }
      let outFormat = output.processingFormat
      let writeBuf = needsDownmix ? AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: 32768) : nil
      while input.framePosition < input.length {
        try input.read(into: readBuf)
        if readBuf.frameLength == 0 { break }
        if let writeBuf, let src = readBuf.floatChannelData, let dstCh = writeBuf.floatChannelData {
          // Keep the first `channels` channels (inputs with > 2 channels are rare: multi-input USB).
          writeBuf.frameLength = readBuf.frameLength
          for c in 0..<Int(channels) {
            dstCh[c].update(from: src[c], count: Int(readBuf.frameLength))
          }
          try output.write(from: writeBuf)
        } else {
          try output.write(from: readBuf)
        }
      }
      if #available(iOS 18.0, *) { output.close() }
    }

    // Verify before replacing / deleting the source.
    let check = try AVAudioFile(forReading: tmp)
    let expected = Double(input.length) / format.sampleRate
    let actual = Double(check.length) / check.processingFormat.sampleRate
    guard abs(expected - actual) < 0.1 else {
      throw AriaAudioException.io("Transcode verification failed (\(actual)s vs \(expected)s)")
    }
    if fm.fileExists(atPath: dst.path) {
      _ = try fm.replaceItemAt(dst, withItemAt: tmp)
    } else {
      try fm.moveItem(at: tmp, to: dst)
    }
    try? (dst as NSURL).setResourceValue(URLFileProtection.completeUntilFirstUserAuthentication, forKey: .fileProtectionKey)
    return actual
  }

  /// Finalizes a recording: CAF → `audio.m4a`, deletes the CAF after a verified transcode.
  /// On failure the CAF is kept (and returned) so nothing is lost; recovery retries on next launch.
  static func finalizeRecording(caf: URL) -> (file: URL, durationSec: Double) {
    let m4a = caf.deletingPathExtension().appendingPathExtension("m4a")
    do {
      let duration = try transcodeToALAC(from: caf, to: m4a, maxChannels: 1)
      try? FileManager.default.removeItem(at: caf)
      return (m4a, duration)
    } catch {
      NSLog("[AriaAudio] transcode failed, keeping CAF: \(error)")
      let duration = (try? AVAudioFile(forReading: caf)).map { Double($0.length) / $0.processingFormat.sampleRate } ?? 0
      return (caf, duration)
    }
  }

  /// FR-5: imports m4a/wav/mp3/aiff into `projectDir/audio.m4a`.
  static func importAudio(src: URL, projectDir: URL) throws -> (file: URL, durationSec: Double) {
    let scoped = src.startAccessingSecurityScopedResource()
    defer { if scoped { src.stopAccessingSecurityScopedResource() } }
    try FileManager.default.createDirectory(at: projectDir, withIntermediateDirectories: true)
    let dst = projectDir.appendingPathComponent("audio.m4a")
    // Coordinate the read: the source may live in iCloud Drive / another app's File Provider.
    var coordError: NSError?
    var result: Result<Double, Error> = .failure(AriaAudioException.io("Could not read \(src.lastPathComponent)"))
    NSFileCoordinator().coordinate(readingItemAt: src, options: [.withoutChanges], error: &coordError) { readURL in
      result = Result { try transcodeToALAC(from: readURL, to: dst) }
    }
    if let coordError { throw coordError }
    return (dst, try result.get())
  }

  /// Downsampled absolute peaks, normalized so the loudest bucket is 1 (for the Waveform component).
  static func peaks(of url: URL, count: Int) throws -> [Double] {
    guard count > 0 else { return [] }
    let file = try AVAudioFile(forReading: url)
    let total = file.length
    guard total > 0 else { return Array(repeating: 0, count: count) }
    let perBucket = max(1, Double(total) / Double(count))
    var out = [Float](repeating: 0, count: count)
    guard let buf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 65536) else { return [] }
    var frameIndex: Int64 = 0
    let channels = Int(file.processingFormat.channelCount)
    while file.framePosition < total {
      try file.read(into: buf)
      let n = Int(buf.frameLength)
      if n == 0 { break }
      guard let data = buf.floatChannelData else { break }
      for i in 0..<n {
        var a: Float = 0
        for c in 0..<channels { a = max(a, abs(data[c][i])) }
        let bucket = min(count - 1, Int(Double(frameIndex + Int64(i)) / perBucket))
        if a > out[bucket] { out[bucket] = a }
      }
      frameIndex += Int64(n)
    }
    let maxPeak = out.max() ?? 0
    let scale = maxPeak > 0 ? 1 / maxPeak : 0
    return out.map { (Double($0 * scale) * 1000).rounded() / 1000 }
  }

  /// NFR-8: any `Projects/<id>/audio.caf` without `audio.m4a` is a take interrupted by a crash or kill.
  /// The CAF's data chunk may still say "unknown size"; AVAudioFile reads it to the last flushed buffer.
  static func recoverOrphans(projectsDir: URL) -> [[String: Any]] {
    let fm = FileManager.default
    guard let dirs = try? fm.contentsOfDirectory(at: projectsDir, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]) else {
      return []
    }
    var results: [[String: Any]] = []
    for dir in dirs {
      let caf = dir.appendingPathComponent("audio.caf")
      let m4a = dir.appendingPathComponent("audio.m4a")
      guard fm.fileExists(atPath: caf.path) else { continue }
      if fm.fileExists(atPath: m4a.path) {
        // Transcode finished but the CAF delete didn't — the m4a was verified before being moved in place.
        try? fm.removeItem(at: caf)
        continue
      }
      let (file, duration) = finalizeRecording(caf: caf)
      let ok = file.pathExtension == "m4a"
      results.append([
        "projectDir": dir.absoluteString,
        "file": file.absoluteString,
        "durationSec": duration,
        "status": ok ? "recovered" : "unreadable",
      ])
    }
    return results
  }
}
