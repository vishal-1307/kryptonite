# Kryptonite — UI redesign spec (v2)

Goal: a calm, plain classroom tool. Fewer boxes, one accent, honest type, black dark mode.
Everything below is implemented as CSS custom properties in `styles.css` (one token layer at the top);
components and visuals use only tokens — no raw hex values outside the token block.

## 1. Critique of the current UI (why it reads "AI generated")
- Stock Tailwind trio: teal-600 accent + indigo-600 "output" + amber-700 "key". Three loud hues fight in every visual.
- Template hero: eyebrow label ("KRYPTONITE · BY TEAM KRYPTONITE"), 48px slogan, "1 Pick · 2 Enter · 3 Play" bubbles, filter chips.
- Cards everywhere: soft shadows, 14px radius, hover lift; cards inside cards (viz card → stage → register card → table card).
- Coloured pill badges on every card + "Open →" links that repeat what the card already does.
- Tinted callout box with a left accent bar for the explanation; tinted 200px output box even for 5 characters.
- UPPERCASE letter-spaced micro labels (INPUT, OUTPUT, CLASSICAL) on everything.
- Dark mode is navy-grey (#0e1014 / #161920) with teal glows, not black.
- Generic app-icon logo (rounded teal square with gem); fonts pulled from Google CDN (fails offline in class).
- Mode switch (Encrypt/Decrypt) is a small grey segmented control in a card corner; Run is a small button.
- Player row: 5 buttons + speed + scrubber + keyboard legend with 9 kbd chips → clutter.
- Motion: overshooting "pop" (scale 1.1–1.35), bouncing drops, drop-shadowed tokens.

## 2. Layout

### Header (all pages, 56px, hairline bottom border, solid bg — no blur)
```
[◆ Kryptonite] / Caesar cipher                [Motion] [Projector] [◐ Dark] [GitHub]
```
Method name shows as a breadcrumb only on method pages (hidden ≤600px). Buttons 36px tall (44px on touch/≤900px), text labels ≥601px, icon-only below.

### Home
```
Kryptonite                                                     (h1, 32px)
Pick a method. Type a message and a key, then step through what happens.   (1 line, muted)

CLASSICAL CIPHERS ─────────────────────────────────────────────
Caesar cipher            Shift every letter a fixed number of places.        →
Vigenère cipher          A keyword gives each letter its own Caesar shift.   →
...
MODERN CRYPTOGRAPHY ───────────────────────────────────────────
AES-128 · RSA · Diffie–Hellman
HASHING & ENCODING ────────────────────────────────────────────
SHA-256 · Base64
```
Two-column list at ≥900px (rows, hairline separators, whole row clickable, 64px min height), one column below.
Groups: Classical → "Classical ciphers"; Symmetric / Asymmetric / Key Exchange → "Modern cryptography";
Hashing / Encoding → "Hashing & encoding". Row = name (semibold) + first sentence of description + category in small muted text.
No hero slogan, no chips, no badges, no "Open →".

### Method page
```
┌ sidebar 200px (≥1100px) ┐  Caesar cipher                                    (h1 28px)
│ ← All methods           │  Shift every letter by a fixed number of places.  (muted)
│ Classical ciphers       │
│  Caesar  ◀ active       │  ┌───────────────────────────── input ─┬──── output ──────────┐
│  Vigenère …             │  │ [ Encrypt | Decrypt | Brute force ] │ Ciphertext     Copy  │
│ Modern …                │  │ Message  [....................]     │ Dwwdfn dw gdzq       │
│ Hashing & encoding …    │  │ Shift    [ 3 ]                      │ Use as input → Decr. │
└─────────────────────────┘  │ [ ▶ Run ]  Reset   Ctrl+Enter      │                      │
                             └─────────────────────────────────────┴──────────────────────┘
                             STEP 8 / 14   a → d                                    (title 22px)
                             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (2px progress)
                             ┌──────────────── stage (surface) ───────────────────────────┐
                             │                      visuals                               │
                             └────────────────────────────────────────────────────────────┘
                             Explanation in plain 17px text, max 70ch.
                             [⏮] [◀ Back] [ ▶ Play ] [Next ▶] [⏭]      Speed [1×]  ───●──
                             Shortcuts  ·  All steps (details)
```
- Input/output = one bordered panel split by a hairline (stacked ≤960px). No card in card.
- Mode switch is the first control: full-width segmented control, 40px tall (44 on touch), active segment = ink fill.
- Run = primary accent button, 44px tall, with play icon; full width ≤600px.
- Sidebar hidden <1100px → native `<select>` method switcher beside the title (above it ≤600px).
- ≤380px the GitHub header icon is dropped (the footer links to the repo) so the wordmark never clips.
- Projector mode: sidebar hidden, root font 20px, stronger borders, stage min-height 360px.

## 3. Type
Fonts (self-hosted, OFL 1.1, latin subset, `font-display: swap`, license in `assets/fonts/OFL.txt`):
- UI: **IBM Plex Sans** variable 400–700 (`assets/fonts/ibm-plex-sans-var-latin.woff2`, 45 KB)
- Data: **IBM Plex Mono** 400 + 600 (`ibm-plex-mono-{400,600}-latin.woff2`, 15 KB each)
Plex was chosen over Inter because Inter is the default of nearly every generated template; Plex is
engineered, highly legible at projector distance, and Sans/Mono share metrics. Glyphs outside latin
(→ ⊕ ᵉ) fall back to system fonts via `unicode-range`.
`font-variant-numeric: tabular-nums` on all numbers, counters, hex and tables.

| token | size (root 16px) | use |
|---|---|---|
| --fs-xs | 12px | captions, figcaptions, cell sublabels |
| --fs-sm | 14px | secondary text, labels, buttons |
| --fs-md | 16px | body, inputs |
| --fs-lg | 18px | explanation text, output value |
| --fs-xl | 22px | step title |
| --fs-2xl | 28px | page h1 (32px home) |
Weights: 400 body, 500 labels/buttons, 600 headings. Letter-spacing −0.01em on headings only.
Section labels are sentence case, 12px, weight 600, muted (no uppercase except the step counter).

## 4. Colour tokens
Light is the default on first visit (OS preference ignored until the user chooses; stored in `cv-theme`).

| token | light | dark (pure black) | role |
|---|---|---|---|
| --bg | #ffffff | #000000 | page |
| --surface | #f6f6f4 | #0d0d0d | stage, input fields, header-less panels |
| --cell | #ffffff | #161616 | letter/byte cells |
| --border | #e3e3df | #262626 | hairlines |
| --border-strong | #8a8a84 | #5a5a5a | cell outlines, controls (≥3:1 non-text) |
| --text | #111111 | #f2f2f2 | primary text |
| --muted | #5c5c57 | #a1a1a1 | secondary text |
| --accent | #15803d | #4ade80 | Run, Play, active, progress, links |
| --on-accent | #ffffff | #000000 | text on accent |
| --accent-soft | #e7f4eb | #0c2a17 | selected nav, subtle hl |
| --accent-ink | #14532d | #86efac | text on accent-soft |
| --hl / --on-hl | #ffe9a3 / #111111 | #4a3b00 / #fff3c4 | "being read now" (input letter, current byte) — marker yellow |
| --out / --on-out | #15803d / #ffffff | #4ade80 / #000000 | "just produced" (output) — accent |
| --key / --key-soft | #1e4fb8 / #e8eefb | #9dbcff / #0d1a33 | key material (round keys, keyword) |
| --danger | #b42318 | #ff8a7a | errors |

Measured contrast (WCAG 2.x): text/bg 18.9 (L) 18.8 (D); muted/bg 6.7 / 8.1; accent text/bg 5.0 / 12.1;
on-accent/accent 5.0 / 12.1; on-hl/hl 15.7 / 9.8; key/key-soft 6.3 / 9.1; accent-ink/accent-soft 8.0 / 11.0;
danger/bg 6.6 / 9.2; border-strong/bg 3.5 / 3.0. All text pairs ≥ 4.5 (AA).
Semantic rule for every visual: **yellow = being read, green = result, blue = key, red = error**. Nothing else is coloured.

## 5. Spacing, radius, borders
- Spacing scale (4px base): --s1 4, --s2 8, --s3 12, --s4 16, --s5 24, --s6 32, --s7 48.
- Radius: --r-sm 4px (cells, kbd), --r 6px (buttons, inputs, boxes), --r-lg 8px (panels, stage). No pills except the toggle state.
- Borders: 1px hairlines. No box-shadows, no backdrop blur, no gradients, no glows, no hover lift.
- Focus: 2px solid accent-ink/blue outline, offset 2px.

## 6. Per-visual rules
Common: cells 2.25em square (min 28px), radius 4px, 1px --border-strong at 40% (light) / #333 (dark), mono 600, tabular.
States: `.is-hl`/active input = --hl fill; `.is-out` = --out fill; key tone = --key-soft fill + --key text; empty = dashed border.
Labels: 12px muted sentence case. Figcaptions 12px muted, centred.
- **Caesar wheel**: outer ring dots = --cell w/ border, inner ring = --accent-soft; active plain = --hl, target = --out; travel token flat (no drop-shadow), trail 3px --out.
- **Text rows / letter strip (Caesar, Vigenère, Rail read-out)**: input row cells = --cell; output cells = accent-soft/accent-ink; current column = hl (input) + out (output).
- **Playfair grid**: 5×5 cells 2.6em; band/rectangle = 2px --key stroke with 8% fill; arrows --out; rule label = plain 14px text, not a pill.
- **Rail Fence**: zigzag stroke --muted 1.5px at 50%; slots dashed; dropped letters --hl then rest on --cell; min 12px letters kept.
- **Hill matrix**: bracket borders 2px --text; mono 18px.
- **AES byte grids**: 4×4, cells 2.4em; key grid = key tone; focus byte = 2px --text outline; readout = hairline box on --bg.
- **RSA / DH math lines**: rows on --bg with hairline bottom, highlighted line = --accent-soft + accent-ink; DH flow columns = hairline columns, middle (public) dashed.
- **SHA-256**: hex dump legend uses hl/key/out tones; register strip = plain section (no card), cells hairline; new values = --out outline + accent-soft.
- **Base64 bits**: groups hairline boxes; current 6-bit group --hl; padding = dashed --key.
Motion: ease-out `cubic-bezier(.2,.7,.2,1)` for everything (the old spring curve is now an alias of it). No overshoot or bounce:
`pop` = scale .9→1 + opacity .6→1; Playfair/Rail Fence letters settle from .88–.92 → 1; Rail Fence drops slide 1.2em with no
rebound; Caesar wheel ticks flash the dot yellow instead of scaling it 1.35×; Base64 "=" settles 1.2→1 (was 1.6). No drop-shadows
or glows. ≤1000 ms per step at 1× (settle cap in visuals/anim.js unchanged); Motion off = final state on the first frame.
Text content: the flow renderer (visuals/flow.js) shows plain labels instead of emoji pictograms (👩 🌐 👨 😈 dropped, 🔒 → "(secret)"), so methods/ stays untouched.

## 7. Logo
Mark: a kryptonite **crystal shard** (pointed, faceted pentagon) with a **keyhole** knocked out of its centre —
crystal = "Kryptonite", keyhole = cryptography. Single flat fill (`currentColor`), even-odd knockout, no gradients.
Reads at 16px (silhouette + keyhole). Colours: accent green on light, #4ade80 on black, or pure #111/#fff mono.
Wordmark: "Kryptonite" in IBM Plex Sans SemiBold, −0.02em, outlined to paths in `assets/logo.svg`.
Files: `assets/logo-mark.svg`, `assets/logo.svg` (lockup), `favicon.svg`, `assets/apple-touch-icon.png` (180),
`assets/og-image.png` (1200×630, light), preview `assets/logo-preview.png`.

## 8. Workspace, sidebar and tabs (ui-animations branch)

* **Shell.** Collapsible sidebar (248px expanded, 64px icon rail with tooltips; toggle next to the logo; state in
  `localStorage['cv-sidebar']`, default collapsed below 1200px when nothing is saved). Groups and counts come from the
  registry (`core/groups.js`): All Methods, Classical Ciphers, Modern Cryptography, Hashing & Encoding; category links go
  to `#/c/<slug>`. Below 900px it is a modal drawer (menu button in the top bar, focus trapped, Esc / scrim / link closes,
  focus returns to the menu button; `inert` when closed). Flat 24×24 stroke icons in `core/icons.js`.
* **Method page.** Title row + tablist (Visualizer, Explanation, Code, Examples; ARIA tabs, arrow/Home/End keys,
  deep links `#/aes/code`, `?a=decrypt`). Visualizer is a three-column workspace when the page container is ≥940px:
  inputs + result | visualization with timeline and player under it | "What is happening", maths and step list.
  At ≥560px viewport height the workspace is fixed to the viewport and the columns scroll inside, so the visualization
  is always on screen at 1280×800. 680–939px: inputs and result side by side, visualization full width, explanation
  below. Narrow: inputs, visualization, explanation stacked; Run scrolls the visualization into view.
* **Explanation** is built only from the method's own text and step titles/explanations (`core/explain.js`).
  **Examples** are produced by running the method (`core/examples.js`); "Load into visualizer" fills the inputs.
  **Code** reads `code/manifest.json` (see `docs/code-manifest.md`).
* **Lifecycle.** Each method view owns a `Scope` (`core/lifecycle.js`); route changes dispose it (timers, rAF, observers,
  fetches), cancel animations and reset speed, so nothing from the previous method can render later.
* **Teaching visuals** read the optional `step.meta` fields (`code/STEP_FIELDS.md`) and fall back to deriving the same
  hint from the visual data (`visuals/teach.js`): Vigenère key ribbon, Playfair pair badges 1/2 → 1′/2′ and dashed
  filler letters, Hill row × vector → sum → mod 26 per row, SHA-256 before → after register diff with changed hex digits
  underlined, Base64 decode direction, Rail Fence keeps the active letters scrolled into view, RSA square-and-multiply
  table. All big numbers stay strings.
* **CSP.** No inline script, handler or `style` attribute anywhere; the theme boot is `core/theme-boot.js`; dynamic
  styles use CSSOM (`el.style`, `setProperty`).
