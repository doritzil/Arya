import MediaPlayer

/// Lock screen / Control Center info for recordings and synth playback (§6.4). Apple Music full tracks get
/// this automatically from MusicKit.
final class NowPlaying {
  private var registered = false
  private var title = ""
  private var artist: String?
  /// `MPNowPlayingInfoCenter.playbackState` is macOS-only, so track it ourselves for toggle.
  private var isPlaying = false

  /// Remote command handlers; invoked on the main queue by MediaPlayer.
  var onPlay: (() -> Void)?
  var onPause: (() -> Void)?
  var onSeek: ((Double) -> Void)?

  func setMeta(title: String, artist: String?) {
    self.title = title
    self.artist = artist
    registerCommandsIfNeeded()
  }

  func update(position: Double, duration: Double, rate: Double, playing: Bool) {
    guard !title.isEmpty else { return }
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: title,
      MPMediaItemPropertyPlaybackDuration: duration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
      MPNowPlayingInfoPropertyPlaybackRate: playing ? rate : 0,
      MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0,
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
    ]
    if let artist { info[MPMediaItemPropertyArtist] = artist }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    isPlaying = playing
  }

  func clear() {
    title = ""
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    isPlaying = false
  }

  private func registerCommandsIfNeeded() {
    guard !registered else { return }
    registered = true
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in
      self?.onPlay?()
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.onPause?()
      return .success
    }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      self.isPlaying ? self.onPause?() : self.onPlay?()
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self?.onSeek?(e.positionTime)
      return .success
    }
    center.skipBackwardCommand.preferredIntervals = [5]
    center.skipBackwardCommand.addTarget { [weak self] _ in
      let elapsed = MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double ?? 0
      self?.onSeek?(max(0, elapsed - 5))
      return .success
    }
  }
}
