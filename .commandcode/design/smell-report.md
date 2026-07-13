# Smell Report — Prompt Enhancer Popup

**Project:** AI Prompt Enhancer
**Surface:** Extension popup (src/popup/popup.html + popup.css + popup.js)
**Date:** 2026-07-12
**Mode:** /design smell

---

## Verdict

**6/10 — PRESENT**

The popup avoids the worst AI-tells (no blue-violet gradient, no glassmorphism, no stat monument, no bounce). But it still carries a cluster of generic SaaS reflexes in micro-form: a centered brand mark + product name + version, an iOS-style segmented control, a stat block with two big numbers, and a pill-shaped toggle with a dot — the same primitives shipped in dozens of "modern dashboard" popovers. The dominant work pattern (Configure) is not yet expressed. Nothing on the surface is bad; almost nothing is specific.

---

## Heuristics

| # | Odor | Found | Note |
|---|------|-------|------|
| 1 | Tech gradient | 0 | No indigo/cyan/purple-to-teal. Clean. |
| 2 | Generic tech hue | 0 | Accent is deep green, not the blue-purple default. |
| 3 | Feature tile grid | 0 | No three-up "What it does" tiles. |
| 4 | Accent rail | 0 | No colored stripe decorating cards. |
| 5 | Unearned blur | 0 | No frosted glass. |
| 6 | Stat monument | 1 | The Usage block displays two oversized numbers (22px bold) without context. They are real, but a count without a sentence reads as a stat monument. |
| 7 | Icon topper | 1 | A rounded square brand mark sits above the product name in the header. It carries no function — the title is already right next to it. |
| 8 | Bounce everywhere | 0 | No elastic easing. The button has subtle background pulse, which is honest state feedback, not bounce. |
| 9 | Default type | 1 | Geist is a deliberate choice, but used at one weight (400/500/600) with a flat 13.5px body. No display size, no monospace ratios, no optical-size reasoning. The font shows up because it is popular — not because it earns the slot. |
| 10 | Center stack | 0 | Header is split (brand left, status right). Content is left-aligned. |

**Tells found: 3** → Score: **7/10 — FAINT**

Adjusted downward to **6/10 — PRESENT** because the three tells cluster in the same two regions (header, usage stats) and are not isolated.

---

## Findings

### F1 — Stat monument in Usage (P2)

**Where:** panel-enhance → `.usage-stats` → `.usage-stat-value` (22px bold)

**Pattern:** Two big numbers (Total enhancements, Using Gemini API) sit side by side. No copy explains them, no comparison, no trend.

**Reflex:** "Stats section" is the default Configure-surface reflex — fill empty space with a number. The numbers are real data, but real data presented stat-monument style still fails.

**Fix direction:** Either give each number a one-line sentence of context ("across 12 chats this month", "saved you a free-tier quota"), or fold the stats into a single sentence ("128 enhancements · 47 with your own key") and free the visual real estate. This is `writing` + `refine` territory, not a recolor.

### F2 — Icon topper on the brand mark (P2)

**Where:** `.brand-mark` in the header — a 22px dark rounded square containing a sparkle SVG, sitting to the left of "Prompt Enhancer".

**Pattern:** Icon-as-decoration immediately above/before the title. The header has nothing else to anchor to; the icon was added because the layout felt empty.

**Reflex:** "I need a brand mark, let me put a small square + glyph next to the wordmark." The square adds zero information — the wordmark already names the product. The sparkle is the same icon used in the inline enhancer button, so it has semantic dual-use, but the rounded square container is pure decoration.

**Fix direction:** Two options:
- Drop the square container; keep just the glyph inline with the title (or remove entirely if it doesn't earn the slot).
- Or: keep the glyph, but make it a real wordmark (e.g., the glyph becomes the dot of the "i" in Prompt, or sits inline with the wordmark) so it is part of the typography rather than a topper.

### F3 — Default type with no scale (P1)

**Where:** Whole surface — `popup.css` `:root` sets `font-size: 13.5px` and uses a near-flat hierarchy (`17/16/14.5/13.5/12.5/12/11.5`).

**Pattern:** Geist is loaded but treated as "the modern default." The hierarchy is built from small weight steps (500 → 600) and minor size deltas. There is no display size. There is no body/UI distinction. The mono font is used for the `{{PROMPT}}` pill and the API key input — that's the only structural type decision.

**Reflex:** "Use a nice font" — which is exactly the user's stated ask. Loading Geist was the *first* step of taking type seriously, but the *second* step — defining a real scale with named roles (display, heading, body, label, mono) and a measured relationship between them — wasn't done.

**Fix direction:** `typeset` — define four or five type roles with explicit sizes, weights, tracking, and line-height; rebuild the hierarchy on those roles instead of ad-hoc numbers per element.

---

## Cluster: header + stats

F1 and F2 both live in the same visual neighborhood (the upper third of the popup). The header needs a wordmark decision; the stats need a copy decision. Fixing them in the same pass would let the upper third develop a single voice — currently it has none.

## What I Refuse

- Calling the popup "clean" because it isn't blue-violet
- Reporting a smell I can't point to a CSS class for
- Inventing smells that aren't there (the popover is genuinely competent)

## Recommended next modes

- `typeset` — fix F3 first; the whole hierarchy rides on it
- `refine` — fold F1 and F2 into a single pass that revoices the upper third
- After those: re-run `smell` to confirm zero tells, then consider `finish`
