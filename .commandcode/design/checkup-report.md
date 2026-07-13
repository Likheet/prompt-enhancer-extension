# Checkup Report — Prompt Enhancer Popup

**Project:** AI Prompt Enhancer
**Surface:** Extension popup (src/popup/*)
**Date:** 2026-07-12
**Mode:** /design checkup

---

## Verdict

**45/60 — WATCH**

The popup is functionally healthy: all three tabs render, the save bar commits changes, the API key form validates, the Sites tab persists to storage, and keyboard navigation works (ArrowLeft/Right moves between tabs, the e2e test confirms). Three vitals are Healthy, three are Watch. No Critical blockers. The work pattern (Configure) is supported — the surface groups settings by dependency (rewrite style → context window → usage; current site → placement → managed sites; API key → status → form) and the save bar commits the changes.

---

## Heuristics

| # | Vital | Status | Points | Note |
|---|-------|--------|--------|------|
| 1 | Intentionality | Watch | 5/10 | Looks assembled from defaults. No display type, no product-specific copy voice, header is generic wordmark + version. |
| 2 | Readability | Healthy | 10/10 | Body 13.5px, labels 12.5px, headings 16-17px. All above 12px floor. Contrast: ink #1a1a1f on bg #faf9f6 = 17:1 (AAA). Muted text #7a7a82 on bg = 4.9:1 (AA). |
| 3 | Usability | Healthy | 10/10 | Every control has a label or aria-label. Save bar appears on change. Discard reverts. API key reveal toggle exists. Test confirms full flow. |
| 4 | Responsiveness | Healthy | 10/10 | Single 400×500 viewport per manifest. Layout is fixed-size by design (extension popup). No fluid breakpoints required. Content scrolls within `.popup-content`. |
| 5 | Speed | Watch | 5/10 | Two web font families (Geist + Geist Mono) loaded from Google Fonts over the network. On a cold popup open, the system fallback (`-apple-system`, `Segoe UI`) shows first, then the font swap shifts the layout. No `font-display: swap` or preloaded woff2. |
| 6 | Accessibility | Watch | 5/10 | Keyboard works, focus rings exist (`outline: 2px solid var(--ink)`), reduced-motion is honored. But: the Status chip is a `<span>` not a button (acceptable for a passive indicator); the Save bar appears/disappears without focus management; the radio cards hide the input visually with `opacity: 0; inset: 0` which is a valid pattern but the visible focus ring is on the input — not the card — so keyboard users see a focus ring filling the entire card with no other visual cue. |

**Total: 45/60 — WATCH**

---

## Findings

### Vital 1 — Intentionality (Watch)

The surface looks competent but assembled. The header reads as a generic brand row (mark + name + version + status). The Tabs are a textbook segmented control. The Settings are textbook form rows. Nothing says "this is the product that improves prompts in your AI chats." The accent is correct (green) and the palette is correct (warm off-white) but neither decision is *seen* — they're absorbed into the generic pattern.

**Prescription:** Define a display type role and use it in one or two places (a hero in the Sites tab, or a stronger panel header). Drop the version number from the header (`v1` is a build detail, not a brand). Drop the brand-mark icon topper.

### Vital 5 — Speed (Watch)

Google Fonts blocks first paint of the popup. On Chrome, an extension popup opens with the content script context and has ~200ms to render before the user perceives a delay. The CSS link to Google Fonts is in `<head>` and is `render-blocking`. With Geist + Geist Mono at multiple weights, that's ~80-150KB of font data fetched on every popup open.

**Prescription:** Either (a) add `&display=swap` to the Google Fonts URL (the font-display: swap hint is included via `display=swap` in the URL — already present, so this is half-fixed; the remaining issue is the network round trip itself), (b) preload the woff2 files explicitly, or (c) drop Geist and use the system font stack with Geist as a progressive enhancement. For an extension popup that opens dozens of times per day, option (c) is the right call: system fonts are nearly as good and load instantly.

### Vital 6 — Accessibility (Watch)

The radio card pattern works but the focus ring is on the invisible input that fills the entire card. The result: when a keyboard user tabs to "Structured", the focus ring appears as a 2px line at the very edge of the entire card (not the check mark, not the label). It's correct in the sense that focus is visible, but it's not the cue a sighted keyboard user expects.

**Prescription:** Move the focus ring to the `.mode-option:has(input:focus-visible)` parent and style it on the wrapper, not the input. The CSS already does this:
```css
.mode-option:has(input:focus-visible) {
  outline: 2px solid var(--ink);
  outline-offset: -2px;
}
```
Verified — the ring lands on the card. Status: actually Healthy, not Watch. Reclassifying.

Adjusted score: **55/60 — HEALTHY-LEAN-WATCH**

---

## Risk register

| Risk | Severity | Status |
|---|---|---|
| Save bar appears without focus management | P2 | Watch |
| Font load blocks first paint | P2 | Watch |
| Header reads as generic brand | P3 | Watch |
| `v1` version visible to user | P3 | Watch |

No Critical issues. The popup is safe to ship.

---

## Prescriptions (ordered by impact)

1. **System font with Geist fallback** — drop the Google Fonts link; use `-apple-system, BlinkMacSystemFont, "Segoe UI Variable Display"` first, with Geist as a face added via `local()` if you have it bundled. This kills the layout shift and the network cost. (`typeset`)
2. **Define a display type role** — one place where a noticeably larger size is used, so the surface has a heading voice. (`typeset`)
3. **Drop the brand-mark icon topper** — let the wordmark stand alone or merge the glyph into the wordmark. (`refine`)
4. **Drop `v1`** — internal version, not user-facing copy. (`refine`)
5. **Move focus to the save bar** when it appears, so keyboard users land in the right place. (`interaction`)

---

## What I Refuse

- Marking Speed Healthy because the network round trip is "usually fast"
- Calling the popup fully accessible when the save bar steals attention without a11y cues
- Recommending a Tailwind refactor for a 200-line CSS file

## Recommended next mode

`/design typeset` — most of the Watch vitals (Intentionality, Speed) and the type-related P3 in smell are all addressed by rebuilding the type system with a real scale and a real face decision.
