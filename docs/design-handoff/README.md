# Aria — developer handoff package

Designs for **Aria**, an iPhone piano companion for a teenage pianist (working name). Built from `00-requirements.md`.

Start with **`01-HANDOFF-SPEC.md`**.

| Folder / file | What's inside |
|---|---|
| `00-requirements.md` | Product requirements (FR / NFR numbers used throughout) |
| `01-HANDOFF-SPEC.md` | App structure, navigation map, global rules, every screen's behaviour, open questions |
| `02-design-tokens/` | `tokens.json` (source of truth), `AriaTheme.swift` (SwiftUI colours, fonts, spacing, radius, background, glass), `tokens.css` |
| `03-screens/` | Every screen as a @2x PNG, grouped by flow, plus an `overview.png` per flow |
| `04-components/` | `COMPONENTS.md` (every component, props, states, rules), props in `component-props.d.ts`, working React reference implementation |
| `05-icons/` | Phosphor icon names, weights, SVGs, licence |

**Clickable prototype:** open the screens canvas, switch pages (Onboarding / Discover / Learning / Record) and use Play to tap through the flows:
https://claude.ai/artifact/DAeyZApsjwYJxHs12eRcZf

**Design system (tokens, components, brand book):** https://claude.ai/artifact/EN6MkMqDfH9Fk2HG9Cio8p

Both links are private — share them from their Share menu before sending.

Fonts: Outfit (OFL) from Google Fonts. Icons: Phosphor (MIT).
