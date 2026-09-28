import AVFoundation
import Combine
import ExpoModulesCore
import MusicKit
import QuartzCore
import UIKit

/// `aria-musickit` (ARCHITECTURE.md §8.2). JS surface: modules/aria-musickit/index.ts.
///
/// - Uses `ApplicationMusicPlayer` (in-app queue) so loop / back-5 s work and the Music app's queue is untouched.
/// - Only genre weights leave this module; raw listening history never does (NFR-2).
/// - Requires the MusicKit App Service enabled on the App ID (developer portal) and NSAppleMusicUsageDescription
///   (plugins/withAriaInfoPlist). No developer token is needed on device: MusicKit mints it from the App ID.
/// - The PlaybackCoordinator must pause aria-audio before `play` (one thing plays at a time).
public final class AriaMusicKitModule: Module {
  private var clockTimer: Timer?
  private var stateCancellable: AnyCancellable?
  private var currentId: String?
  private var currentDuration: Double = 0
  private var lastStatus = "idle"

  public func definition() -> ModuleDefinition {
    Name("AriaMusicKit")

    Events("clock", "state")

    OnCreate {
      Task { @MainActor in self.observePlayerState() }
    }

    OnDestroy {
      Task { @MainActor in
        self.clockTimer?.invalidate()
        self.stateCancellable = nil
      }
    }

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        let status = await MusicAuthorization.request()
        promise.resolve(Self.authString(status))
      }
    }

    Function("authorizationStatus") { () -> String in
      Self.authString(MusicAuthorization.currentStatus)
    }

    AsyncFunction("subscription") { (promise: Promise) in
      Task {
        do {
          let sub = try await MusicSubscription.current
          promise.resolve([
            "canPlayCatalogContent": sub.canPlayCatalogContent,
            "canBecomeSubscriber": sub.canBecomeSubscriber,
          ])
        } catch {
          promise.reject("ERR_SUBSCRIPTION", "\(error)")
        }
      }
    }

    AsyncFunction("play") { (appleMusicId: String, promise: Promise) in
      Task { @MainActor in
        do {
          try await self.play(appleMusicId)
          promise.resolve()
        } catch {
          self.sendEvent("state", ["status": "failed", "appleMusicId": appleMusicId, "error": "\(error)"])
          promise.reject("ERR_PLAY", "\(error)")
        }
      }
    }

    AsyncFunction("resume") { (promise: Promise) in
      Task { @MainActor in
        do {
          try await ApplicationMusicPlayer.shared.play()
          promise.resolve()
        } catch {
          promise.reject("ERR_PLAY", "\(error)")
        }
      }
    }

    Function("pause") {
      Task { @MainActor in ApplicationMusicPlayer.shared.pause() }
    }

    Function("stop") {
      Task { @MainActor in
        ApplicationMusicPlayer.shared.stop()
        self.currentId = nil
        self.currentDuration = 0
        self.emitClock()
      }
    }

    Function("seek") { (sec: Double) in
      Task { @MainActor in
        ApplicationMusicPlayer.shared.playbackTime = max(0, sec)
        self.emitClock()
      }
    }

    Function("setRepeat") { (on: Bool) in
      Task { @MainActor in
        ApplicationMusicPlayer.shared.state.repeatMode = on ? .one : MusicPlayer.RepeatMode.none
      }
    }

    AsyncFunction("listeningGenreWeights") { (promise: Promise) in
      Task {
        promise.resolve(await Self.genreWeights())
      }
    }

    Function("openInAppleMusic") { (appleMusicId: String) in
      Task { @MainActor in
        var url = URL(string: "https://music.apple.com/song/\(appleMusicId)")
        if let song = try? await Self.fetchSong(appleMusicId), let songURL = song.url { url = songURL }
        if let url { await UIApplication.shared.open(url) }
      }
    }
  }

  // MARK: - Playback

  @MainActor
  private func play(_ id: String) async throws {
    sendEvent("state", ["status": "loading", "appleMusicId": id])
    let song = try await Self.fetchSong(id)
    let player = ApplicationMusicPlayer.shared
    player.queue = ApplicationMusicPlayer.Queue(for: [song])
    currentId = id
    currentDuration = song.duration ?? 0
    try await player.prepareToPlay()
    try await player.play()
  }

  static func fetchSong(_ id: String) async throws -> Song {
    let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(id))
    let response = try await request.response()
    guard let song = response.items.first else {
      throw Exception(name: "NotFound", description: "No Apple Music song \(id)", code: "ERR_NOT_FOUND")
    }
    return song
  }

  @MainActor
  private func observePlayerState() {
    stateCancellable = ApplicationMusicPlayer.shared.state.objectWillChange
      .receive(on: DispatchQueue.main)
      .sink { [weak self] _ in
        // objectWillChange fires before the value changes; read on the next runloop turn.
        DispatchQueue.main.async { self?.handleStateChange() }
      }
  }

  @MainActor
  private func handleStateChange() {
    let status = Self.statusString(ApplicationMusicPlayer.shared.state.playbackStatus, position: ApplicationMusicPlayer.shared.playbackTime, duration: currentDuration)
    if status == "playing" {
      startClock()
    } else {
      stopClock()
    }
    if status != lastStatus {
      lastStatus = status
      var body: [String: Any] = ["status": status, "duration": currentDuration]
      if let currentId { body["appleMusicId"] = currentId }
      sendEvent("state", body)
    }
    emitClock()
  }

  @MainActor
  private func startClock() {
    guard clockTimer == nil else { return }
    clockTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      Task { @MainActor in self?.emitClock() }
    }
  }

  @MainActor
  private func stopClock() {
    clockTimer?.invalidate()
    clockTimer = nil
  }

  @MainActor
  private func emitClock() {
    let player = ApplicationMusicPlayer.shared
    let status = Self.statusString(player.state.playbackStatus, position: player.playbackTime, duration: currentDuration)
    sendEvent("clock", [
      "position": player.playbackTime,
      "hostTime": CACurrentMediaTime() * 1000,
      "wallTime": Date().timeIntervalSince1970 * 1000,
      "rate": status == "playing" ? Double(player.state.playbackRate) : 0,
      "status": status,
      "duration": currentDuration,
      "outputLatency": AVAudioSession.sharedInstance().outputLatency,
    ])
  }

  // MARK: - Listening history → genre weights (FR-27, on device)

  /// Recently played songs + heavy rotation, counted per genre name (excluding the catch-all "Music"),
  /// normalized to sum to 1. Returns {} when not authorized or on any error.
  static func genreWeights() async -> [String: Double] {
    guard MusicAuthorization.currentStatus == .authorized else { return [:] }
    var counts: [String: Double] = [:]
    func add(_ genres: [String]?, weight: Double) {
      for g in genres ?? [] where g != "Music" { counts[g, default: 0] += weight }
    }

    var recent = MusicRecentlyPlayedRequest<Song>()
    recent.limit = 30
    if let songs = try? await recent.response().items {
      for s in songs { add(s.genreNames, weight: 1) }
    }

    // No typed API for heavy rotation; MusicDataRequest adds the developer + user tokens itself.
    if let url = URL(string: "https://api.music.apple.com/v1/me/history/heavy-rotation?limit=10"),
       let data = try? await MusicDataRequest(urlRequest: URLRequest(url: url)).response().data,
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let items = json["data"] as? [[String: Any]] {
      for item in items {
        let attrs = item["attributes"] as? [String: Any]
        add(attrs?["genreNames"] as? [String], weight: 2) // heavy rotation counts double
      }
    }

    let total = counts.values.reduce(0, +)
    guard total > 0 else { return [:] }
    return counts.mapValues { ($0 / total * 1000).rounded() / 1000 }
  }

  // MARK: - Mapping

  static func authString(_ s: MusicAuthorization.Status) -> String {
    switch s {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }

  static func statusString(_ s: MusicPlayer.PlaybackStatus, position: TimeInterval, duration: Double) -> String {
    switch s {
    case .playing, .seekingForward, .seekingBackward: return "playing"
    case .paused, .interrupted: return "paused"
    case .stopped: return duration > 0 && position >= duration - 0.5 ? "ended" : "idle"
    @unknown default: return "paused"
    }
  }
}
