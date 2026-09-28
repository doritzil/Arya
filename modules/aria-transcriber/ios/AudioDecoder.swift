import AVFoundation

/// Reads windows of an audio file as mono float32 at the model rate (typically 16 kHz), without ever holding
/// the whole file in memory (NFR-6). Each window seeks and converts afresh, so windows can overlap and a
/// resumed job can start at any chunk.
final class AudioDecoder {
  let url: URL
  let targetRate: Double
  private let file: AVAudioFile
  private let converter: AVAudioConverter
  private let inFormat: AVAudioFormat
  private let outFormat: AVAudioFormat

  /// Duration of the file in seconds.
  let durationSec: Double

  init(url: URL, targetRate: Double) throws {
    self.url = url
    self.targetRate = targetRate
    file = try AVAudioFile(forReading: url)
    inFormat = file.processingFormat
    guard let out = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: targetRate, channels: 1, interleaved: false),
          let conv = AVAudioConverter(from: inFormat, to: out)
    else { throw TranscriberError.decode("Unsupported audio format \(inFormat)") }
    outFormat = out
    converter = conv
    // Downmix stereo → mono by averaging rather than taking the left channel.
    if inFormat.channelCount == 2 { converter.channelMap = [0] }
    converter.sampleRateConverterQuality = AVAudioQuality.high.rawValue
    durationSec = Double(file.length) / inFormat.sampleRate
  }

  /// `seconds` of audio starting at `startSec`, zero-padded if the file ends first.
  func read(startSec: Double, seconds: Double) throws -> [Float] {
    let wanted = Int((seconds * targetRate).rounded())
    var out = [Float]()
    out.reserveCapacity(wanted)

    let startFrame = AVAudioFramePosition(startSec * inFormat.sampleRate)
    guard startFrame < file.length else { return [Float](repeating: 0, count: wanted) }
    file.framePosition = max(0, startFrame)
    converter.reset()

    let inCapacity: AVAudioFrameCount = 16384
    guard let inBuf = AVAudioPCMBuffer(pcmFormat: inFormat, frameCapacity: inCapacity),
          let outBuf = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: AVAudioFrameCount(Double(inCapacity) * targetRate / inFormat.sampleRate) + 1024)
    else { throw TranscriberError.decode("Out of memory") }

    var endOfInput = false
    var readError: Error?
    while out.count < wanted && !endOfInput {
      outBuf.frameLength = 0
      var convError: NSError?
      let status = converter.convert(to: outBuf, error: &convError) { _, inputStatus in
        if endOfInput {
          inputStatus.pointee = .endOfStream
          return nil
        }
        if self.file.framePosition >= self.file.length {
          endOfInput = true
          inputStatus.pointee = .endOfStream
          return nil
        }
        do {
          try self.file.read(into: inBuf, frameCount: inCapacity)
        } catch {
          readError = error
          inputStatus.pointee = .endOfStream
          endOfInput = true
          return nil
        }
        if inBuf.frameLength == 0 {
          endOfInput = true
          inputStatus.pointee = .endOfStream
          return nil
        }
        // Stereo: average into channel 0 so the channelMap [0] yields a true mono mix.
        if self.inFormat.channelCount == 2, let ch = inBuf.floatChannelData {
          for i in 0..<Int(inBuf.frameLength) { ch[0][i] = 0.5 * (ch[0][i] + ch[1][i]) }
        }
        inputStatus.pointee = .haveData
        return inBuf
      }
      if let readError { throw TranscriberError.decode("\(readError)") }
      if status == .error { throw TranscriberError.decode(convError?.localizedDescription ?? "conversion failed") }
      if let ch = outBuf.floatChannelData, outBuf.frameLength > 0 {
        let n = min(Int(outBuf.frameLength), wanted - out.count)
        out.append(contentsOf: UnsafeBufferPointer(start: ch[0], count: n))
      }
      if status == .endOfStream { break }
    }
    if out.count < wanted { out.append(contentsOf: repeatElement(0, count: wanted - out.count)) }
    return out
  }
}
