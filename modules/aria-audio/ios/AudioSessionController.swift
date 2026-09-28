import AVFoundation

/// What the session is currently configured for. Recording uses `.measurement` (no AGC / voice processing,
/// keeps piano dynamics); playback uses `.default` so speaker output isn't attenuated.
enum SessionUse {
  case playback
  case recording
}

/// Single owner of `AVAudioSession` (ARCHITECTURE.md D5). Everything else asks this class.
final class AudioSessionController {
  private let session = AVAudioSession.sharedInstance()
  private var observers: [NSObjectProtocol] = []

  /// HFP (Bluetooth mic) inputs only appear in `availableInputs` when `.allowBluetooth` is set, and setting it
  /// drags output to low-quality HFP too. So it is only enabled after the user explicitly picks a Bluetooth mic.
  private(set) var bluetoothMicAllowed = false

  var onInterruption: ((_ began: Bool, _ reason: String) -> Void)?
  var onRouteChange: ((_ reason: String) -> Void)?
  var onMediaServicesReset: (() -> Void)?

  // MARK: - Lifecycle

  func startObserving() {
    let nc = NotificationCenter.default
    observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: nil) { [weak self] note in
      self?.handleInterruption(note)
    })
    observers.append(nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: nil) { [weak self] note in
      self?.handleRouteChange(note)
    })
    observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: nil) { [weak self] _ in
      self?.onMediaServicesReset?()
    })
  }

  func stopObserving() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }

  // MARK: - Configuration

  func activate(for use: SessionUse) throws {
    var options: AVAudioSession.CategoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP]
    if bluetoothMicAllowed {
      // Renamed `.allowBluetoothHFP` in the iOS 26 SDK (same raw value); the old name is deprecated there.
#if compiler(>=6.2) // Xcode 26
      options.insert(.allowBluetoothHFP)
#else
      options.insert(.allowBluetooth)
#endif
    }
    let mode: AVAudioSession.Mode = use == .recording ? .measurement : .default
    if session.category != .playAndRecord || session.mode != mode || session.categoryOptions != options {
      try session.setCategory(.playAndRecord, mode: mode, options: options)
    }
    try session.setActive(true)
  }

  func setPreferredSampleRate(_ rate: Double) {
    try? session.setPreferredSampleRate(rate)
  }

  func deactivate() {
    try? session.setActive(false, options: .notifyOthersOnDeactivation)
  }

  // MARK: - Mic permission

  func micPermission() -> String {
    if #available(iOS 17.0, *) {
      switch AVAudioApplication.shared.recordPermission {
      case .granted: return "granted"
      case .denied: return "denied"
      default: return "undetermined"
      }
    }
    switch session.recordPermission {
    case .granted: return "granted"
    case .denied: return "denied"
    default: return "undetermined"
    }
  }

  func requestMicPermission(_ completion: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: completion)
    } else {
      session.requestRecordPermission(completion)
    }
  }

  // MARK: - Routes

  var outputLatency: Double { session.outputLatency }

  /// 'speaker' | 'headphones' | 'bluetooth' | 'other'
  var outputKind: String {
    guard let port = session.currentRoute.outputs.first?.portType else { return "other" }
    switch port {
    case .builtInSpeaker: return "speaker"
    case .headphones, .usbAudio, .lineOut: return "headphones"
    case .bluetoothA2DP, .bluetoothLE, .bluetoothHFP: return "bluetooth"
    default: return "other"
    }
  }

  /// Count-in clicks are only played when they can't leak into the mic (§8.1).
  var isHeadphoneOutput: Bool {
    let kind = outputKind
    return kind == "headphones" || kind == "bluetooth"
  }

  func inputs() -> [[String: Any]] {
    let current = Set(session.currentRoute.inputs.map(\.uid))
    let preferred = session.preferredInput?.uid
    var result: [[String: Any]] = (session.availableInputs ?? []).map { port in
      let kind = Self.kind(of: port.portType)
      return [
        "id": port.uid,
        "name": port.portName,
        "kind": kind,
        "lowBandwidth": port.portType == .bluetoothHFP,
        "selected": preferred.map { $0 == port.uid } ?? current.contains(port.uid),
      ]
    }
    // A connected A2DP headset has a mic that only shows up once HFP is allowed. Offer it anyway so the
    // picker can list it ("Bluetooth mics are low quality"); selecting it turns `.allowBluetooth` on.
    if !bluetoothMicAllowed {
      for out in session.currentRoute.outputs where out.portType == .bluetoothA2DP || out.portType == .bluetoothLE {
        result.append([
          "id": "bt:\(out.uid)",
          "name": out.portName,
          "kind": "bluetooth",
          "lowBandwidth": true,
          "selected": false,
        ])
      }
    }
    return result
  }

  func setPreferredInput(id: String) throws {
    if id.hasPrefix("bt:") {
      bluetoothMicAllowed = true
      try activate(for: .recording)
      // Now the HFP port exists; pick the first Bluetooth HFP input.
      if let hfp = session.availableInputs?.first(where: { $0.portType == .bluetoothHFP }) {
        try session.setPreferredInput(hfp)
      }
      return
    }
    guard let port = session.availableInputs?.first(where: { $0.uid == id }) else {
      throw AriaAudioException.unknownInput(id)
    }
    if port.portType != .bluetoothHFP && bluetoothMicAllowed {
      bluetoothMicAllowed = false
      try activate(for: .recording)
    }
    try session.setPreferredInput(port)
  }

  static func kind(of port: AVAudioSession.Port) -> String {
    switch port {
    case .builtInMic: return "builtIn"
    case .usbAudio: return "usb"
    case .bluetoothHFP, .bluetoothLE, .bluetoothA2DP: return "bluetooth"
    case .headsetMic, .lineIn: return "wired"
    default: return "wired"
    }
  }

  // MARK: - Notifications

  private func handleInterruption(_ note: Notification) {
    guard let info = note.userInfo,
          let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw)
    else { return }
    var reason = "call" // `.default` covers calls, alarms, Siri — iOS doesn't tell them apart
    // Raw values: 2 = builtInMicMuted, 4 = routeDisconnected. The enum case for the latter is not
    // available on iOS in every SDK, so compare numbers rather than risk a compile error.
    if let r = info[AVAudioSessionInterruptionReasonKey] as? UInt {
      switch r {
      case 2: reason = "other"
      case 4: reason = "route"
      default: break
      }
    }
    onInterruption?(type == .began, reason)
  }

  private func handleRouteChange(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let why = AVAudioSession.RouteChangeReason(rawValue: raw)
    else { return }
    let reason: String
    switch why {
    case .newDeviceAvailable: reason = "newDevice"
    case .oldDeviceUnavailable: reason = "oldDeviceUnavailable"
    case .categoryChange: reason = "categoryChange"
    case .override: reason = "override"
    default: reason = "other"
    }
    onRouteChange?(reason)
  }
}
