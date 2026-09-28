// AriaTheme.swift — generated from the Aria design system tokens (tokens.json).
// Colors adapt to light/dark automatically. Fonts: bundle Outfit (OFL, Google Fonts) — Regular/Medium/SemiBold.

import SwiftUI
import UIKit

private func dynamic(_ light: UIColor, _ dark: UIColor) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
}

enum AriaColor {
    /// Solid screen ground behind the gradient, and the fallback where no gradient is drawn.
    static let surface = dynamic(UIColor(red: 0.976, green: 0.890, blue: 0.863, alpha: 1.00), UIColor(red: 0.102, green: 0.075, blue: 0.125, alpha: 1.00))
    /// Screen gradient, top stop (warm peach).
    static let gradPeach = dynamic(UIColor(red: 0.976, green: 0.843, blue: 0.765, alpha: 1.00), UIColor(red: 0.231, green: 0.133, blue: 0.188, alpha: 1.00))
    /// Screen gradient, middle stop (rose pink).
    static let gradPink = dynamic(UIColor(red: 0.945, green: 0.714, blue: 0.812, alpha: 1.00), UIColor(red: 0.239, green: 0.122, blue: 0.239, alpha: 1.00))
    /// Screen gradient, bottom-left stop (lilac).
    static let gradLilac = dynamic(UIColor(red: 0.827, green: 0.667, blue: 0.925, alpha: 1.00), UIColor(red: 0.169, green: 0.122, blue: 0.290, alpha: 1.00))
    /// Frosted cards and sheets over the gradient, with a 24px background blur.
    static let glass = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 0.55), UIColor(red: 0.173, green: 0.118, blue: 0.212, alpha: 0.62))
    /// Circular icon buttons, tab bar, icon tiles — glass that needs to read as a control.
    static let glassStrong = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 0.80), UIColor(red: 0.188, green: 0.129, blue: 0.235, alpha: 0.86))
    /// 1px inner edge on glass surfaces. Decorative.
    static let glassEdge = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 0.75), UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 0.12))
    /// Solid cards where no gradient sits behind (lists, sheets, the song page lower half).
    static let surfaceRaised = dynamic(UIColor(red: 1.000, green: 0.969, blue: 0.961, alpha: 1.00), UIColor(red: 0.153, green: 0.114, blue: 0.184, alpha: 1.00))
    /// Wells: segmented track, piano-roll lane, meter track, search field.
    static let surfaceSunken = dynamic(UIColor(red: 0.953, green: 0.867, blue: 0.902, alpha: 1.00), UIColor(red: 0.078, green: 0.059, blue: 0.098, alpha: 1.00))
    /// Empty part of sliders and scrubbers.
    static let track = dynamic(UIColor(red: 0.231, green: 0.137, blue: 0.259, alpha: 0.12), UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 0.16))
    /// Hairline dividers on solid surfaces. Decorative only.
    static let line = dynamic(UIColor(red: 0.925, green: 0.827, blue: 0.867, alpha: 1.00), UIColor(red: 0.231, green: 0.176, blue: 0.271, alpha: 1.00))
    /// Outlines on secondary buttons and unselected chips. Kept soft on purpose (about 2:1 on glass in light mode), so these controls also carry a glass fill and a label; never the only edge of an input. Never on the bare gradient.
    static let lineStrong = dynamic(UIColor(red: 0.765, green: 0.667, blue: 0.761, alpha: 1.00), UIColor(red: 0.541, green: 0.451, blue: 0.588, alpha: 1.00))
    /// Primary text and icons on every surface, glass and gradient stop.
    static let ink = dynamic(UIColor(red: 0.200, green: 0.125, blue: 0.227, alpha: 1.00), UIColor(red: 0.973, green: 0.925, blue: 0.957, alpha: 1.00))
    /// Secondary text (subtitles, artist, times) on every surface, glass and gradient stop.
    static let inkMuted = dynamic(UIColor(red: 0.333, green: 0.247, blue: 0.365, alpha: 1.00), UIColor(red: 0.780, green: 0.706, blue: 0.812, alpha: 1.00))
    /// The dark play disc and the one main action per screen (Want to learn, Mark as learned); selected tab. In dark mode it flips to a light disc.
    static let primary = dynamic(UIColor(red: 0.165, green: 0.114, blue: 0.180, alpha: 1.00), UIColor(red: 0.973, green: 0.925, blue: 0.957, alpha: 1.00))
    /// Text and icons on a primary fill.
    static let onPrimary = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1.00), UIColor(red: 0.165, green: 0.114, blue: 0.180, alpha: 1.00))
    /// Start of the slider/progress gradient, and warm highlights. Decorative: not for text.
    static let peach = dynamic(UIColor(red: 0.925, green: 0.573, blue: 0.459, alpha: 1.00), UIColor(red: 0.957, green: 0.659, blue: 0.549, alpha: 1.00))
    /// Orchid. End of the slider gradient, difficulty dots, the Learning status, links and ghost buttons, the focus ring. As text, only on glass or solid surfaces, never on the bare gradient.
    static let accent = dynamic(UIColor(red: 0.478, green: 0.239, blue: 0.682, alpha: 1.00), UIColor(red: 0.824, green: 0.706, blue: 1.000, alpha: 1.00))
    /// Text and icons on an accent fill.
    static let onAccent = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1.00), UIColor(red: 0.133, green: 0.086, blue: 0.247, alpha: 1.00))
    /// Selected genre chip, art tiles. Text on it: ink.
    static let primarySoft = dynamic(UIColor(red: 0.984, green: 0.875, blue: 0.918, alpha: 1.00), UIColor(red: 0.290, green: 0.141, blue: 0.251, alpha: 1.00))
    /// Learning status pill, active piano-roll lane. Text on it: accent or ink.
    static let accentSoft = dynamic(UIColor(red: 0.933, green: 0.878, blue: 0.980, alpha: 1.00), UIColor(red: 0.227, green: 0.165, blue: 0.376, alpha: 1.00))
    /// Waveform bars over the gradient (with a soft glow). Decorative.
    static let wave = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1.00), UIColor(red: 0.965, green: 0.851, blue: 0.925, alpha: 1.00))
    /// Record button and the recording indicator only.
    static let record = dynamic(UIColor(red: 0.788, green: 0.227, blue: 0.341, alpha: 1.00), UIColor(red: 1.000, green: 0.541, blue: 0.635, alpha: 1.00))
    /// Icon on the record button.
    static let onRecord = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1.00), UIColor(red: 0.227, green: 0.027, blue: 0.063, alpha: 1.00))
    /// Learned status, "saved offline" confirmations. Teal so it never pairs with record red by hue alone; always with a word or check.
    static let success = dynamic(UIColor(red: 0.122, green: 0.424, blue: 0.380, alpha: 1.00), UIColor(red: 0.435, green: 0.816, blue: 0.749, alpha: 1.00))
    /// Learned status pill ground. Text on it: success.
    static let successSoft = dynamic(UIColor(red: 0.851, green: 0.937, blue: 0.910, alpha: 1.00), UIColor(red: 0.090, green: 0.227, blue: 0.204, alpha: 1.00))
    /// Input too quiet / clipping, preview-only notices. Always with a word.
    static let warning = dynamic(UIColor(red: 0.541, green: 0.310, blue: 0.000, alpha: 1.00), UIColor(red: 0.953, green: 0.710, blue: 0.384, alpha: 1.00))
    /// Warning banner ground. Text on it: warning.
    static let warningSoft = dynamic(UIColor(red: 0.988, green: 0.922, blue: 0.827, alpha: 1.00), UIColor(red: 0.247, green: 0.176, blue: 0.071, alpha: 1.00))
    /// White piano keys.
    static let keyWhite = dynamic(UIColor(red: 1.000, green: 1.000, blue: 1.000, alpha: 1.00), UIColor(red: 0.937, green: 0.902, blue: 0.933, alpha: 1.00))
    /// Black piano keys.
    static let keyBlack = dynamic(UIColor(red: 0.200, green: 0.125, blue: 0.227, alpha: 1.00), UIColor(red: 0.051, green: 0.039, blue: 0.063, alpha: 1.00))
    /// Keyboard/VoiceOver focus: 2px solid ring, 2px offset.
    static let focusRing = dynamic(UIColor(red: 0.478, green: 0.239, blue: 0.682, alpha: 1.00), UIColor(red: 0.824, green: 0.706, blue: 1.000, alpha: 1.00))
    /// Note bars in the piano roll and the highlighted note during playback.
    static let note = dynamic(UIColor(red: 0.478, green: 0.239, blue: 0.682, alpha: 1.00), UIColor(red: 0.824, green: 0.706, blue: 1.000, alpha: 1.00))
}

enum AriaSpace {
    static let space1: CGFloat = 4  // Icon-to-label gap inside pills.
    static let space2: CGFloat = 8  // Gap between chips; icon-to-label in buttons.
    static let space3: CGFloat = 12  // Inner gaps in cards; slider row gaps.
    static let space4: CGFloat = 16  // Screen side margins.
    static let space5: CGFloat = 24  // Glass card padding; between sections.
    static let space6: CGFloat = 32  // Above hero titles; around the play disc and record button.
}

enum AriaRadius {
    static let radiusSm: CGFloat = 10  // Piano-roll notes, level meter, small art tiles.
    static let radiusMd: CGFloat = 16  // Buttons, icon tiles, segmented control.
    static let radiusLg: CGFloat = 28  // Glass cards, sheets, the player.
    static let radiusPill: CGFloat = 999  // Chips, pills, sliders, the play disc, round icon buttons, the record button.
}

enum AriaFont {
    // Sizes are iOS points; relativeTo keeps Dynamic Type scaling (NFR-9).
    /// Screen titles (iOS Large Title). Once per screen. — 34px/38px, weight 600, tracking -0.03em
    static let largeTitle = Font.custom("Outfit-SemiBold", size: 34, relativeTo: .largeTitle)
    /// The song title on the now-playing hero, centered over the gradient. — 44px/46px, weight 600, tracking -0.04em
    static let hero = Font.custom("Outfit-SemiBold", size: 44, relativeTo: .largeTitle)
    /// Card and section headers. — 24px/28px, weight 600, tracking -0.02em
    static let title2 = Font.custom("Outfit-SemiBold", size: 24, relativeTo: .title2)
    /// Recording timer, tempo (BPM), transcription percentage. Tabular figures. — 44px/48px, weight 500, tracking -0.02em
    static let numeral = Font.custom("Outfit-Medium", size: 44, relativeTo: .largeTitle)
    /// Uppercase line above a hero title or card title. One per block. — 13px/16px, weight 500, tracking 0.14em
    static let eyebrow = Font.custom("Outfit-Medium", size: 13, relativeTo: .footnote)
    /// Song titles in lists and cards; button labels. — 17px/22px, weight 600, tracking 0
    static let headline = Font.custom("Outfit-SemiBold", size: 17, relativeTo: .headline)
    /// Paragraphs, subtitles under a hero, settings rows. — 17px/24px, weight 400, tracking 0
    static let body = Font.custom("Outfit-Regular", size: 17, relativeTo: .body)
    /// Artist/composer and genre lines; chip labels; slider labels. — 15px/20px, weight 400, tracking 0
    static let callout = Font.custom("Outfit-Regular", size: 15, relativeTo: .callout)
    /// Metadata, helper text, time codes. — 13px/18px, weight 400, tracking 0
    static let footnote = Font.custom("Outfit-Regular", size: 13, relativeTo: .footnote)
    /// Status pills and tab labels. Uppercase for pills only. — 12px/16px, weight 600, tracking 0.06em
    static let caption = Font.custom("Outfit-SemiBold", size: 12, relativeTo: .caption)
}

/// The screen background: peach → pink linear gradient with a lilac glow from the bottom-left.
struct AriaBackground: View {
    var body: some View {
        ZStack {
            AriaColor.surface
            LinearGradient(colors: [AriaColor.gradPeach, AriaColor.gradPink, AriaColor.gradPeach], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [AriaColor.gradLilac, .clear], center: UnitPoint(x: 0, y: 0.72), startRadius: 0, endRadius: 420)
        }.ignoresSafeArea()
    }
}

/// Glass card: .ultraThinMaterial + glass tint + 1pt edge + shadow-card. Swap to surfaceRaised when Reduce Transparency is on.
struct AriaGlass: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) var reduce
    func body(content: Content) -> some View {
        content.padding(AriaSpace.space5)
            .background(reduce ? AnyShapeStyle(AriaColor.surfaceRaised) : AnyShapeStyle(.ultraThinMaterial), in: RoundedRectangle(cornerRadius: AriaRadius.radiusLg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: AriaRadius.radiusLg, style: .continuous).stroke(AriaColor.glassEdge, lineWidth: 1))
            .shadow(color: Color(red: 131/255, green: 71/255, blue: 120/255).opacity(0.14), radius: 16, y: 12)
    }
}
extension View { func ariaGlass() -> some View { modifier(AriaGlass()) } }
