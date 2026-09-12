# Design Document: Stardust Lead-Score & Lyric Proofing Workbench

## 1. Product Classification & Purpose
- **Product Class:** Desktop Music-Notation & Lyric-Proofing Workbench / Dedicated Score Editor.
- **Target Application:** High-density, professional desktop environment for auditing, proofing, and reviewing vocal topline notation tightly aligned with Japanese lyrics.
- **Operational Scope:** Subordinate frontend tool operating strictly within Local Work task contract `bounded-noncreative-v1`.
- **Frozen Invariants:** Canonical source note events (478 total), lyric mappings (279 lyric-bearing notes, 199 null notes), pitches (G minor), timing (160 BPM, 4/4), and verified hashes are permanent and immutable. Any lyric edits made within this workbench are strictly labeled as draft overlay modifications and do not mutate or retime the canonical melodic events.

---

## 2. Design Dials & Form Factors
| Dimension | Setting | Rationale |
| :--- | :--- | :--- |
| **Variation Dial** | **5 / 10** | Balances consistent, standardized DAW/score-editor interface patterns with customized visual hierarchy for rapid Japanese lyric verification. |
| **Motion Dial** | **3 / 10** | Subtle, restrained transitions (smooth playhead, line highlight pulse, clean thumbnail selection). No gratuitous animations; full `@media (prefers-reduced-motion: reduce)` support. |
| **Density Dial** | **8 / 10** | High-density professional workspace maximizing visible notation and lyric data per square inch without visual clutter. Minimizes vertical scrolling overhead. |

---

## 3. Architecture & Composition Choice
### Chosen Archetype: Balanced Score Workbench
The interface organizes the user's attention into a coherent, score-first workflow:
1. **Slim Top Command & Transport Bar (~52px):** Global title, verified status badges (PASS receipt, 478 notes, 279 lyrics, 199 nulls, 29 lines, 160 BPM, G minor), transport buttons (Play/Pause, Stop, Loop), time readout, A/B range controls, export triggers, and canonical artifact downloads.
2. **Narrow Left Page Navigator (~160px):** Vertical stack of miniature page thumbnails (Pages 1–3) with active page badges and Previous/Next buttons for fast multi-page navigation.
3. **Dominant Central Cream Score Container (Flexible Center):** Real rendered SVG notation pages displayed on warm cream archival score paper (`#F7F3EA`), rendering Japanese lyrics placed directly under notes with crisp typography and subtle paper depth.
4. **Right Lyric-Line Inspector (~360px):** Dedicated, time-ordered vertical list of all 29 lyric lines. Highlights the active line in real time during audio playback. Allows line-specific inspection and non-destructive draft editing of `display_text` and `alignment_text`.
5. **Compact Bottom Timeline & Waveform Bar (~72px):** Visual timeline showing overall audio duration (~175.5s), active playhead, A/B loop range highlight, and 29 discrete lyric line tick markers with click-to-seek support.

### Rejected Alternatives
- **Rejected Alternative A: Score-Only View.**
  - *Drawback:* Lacks an interactive, synchronized lyric line list. Proofing syllables across measures becomes slow and error-prone when navigating 121 bars without an inspector or timeline scrubbing.
- **Rejected Alternative B: Table-Heavy / Spreadsheet View.**
  - *Drawback:* Prioritizes raw tabular event rows over graphical notation. Strips out the musical context (ties, pitch contours, rhythmic rests, score layout) essential for vocal proofing.

---

## 4. Visual Language & Token System

### 4.1 Design Philosophy
Inspired by modern digital audio workstations (Logic Pro, Ableton Live) and scoring software (Dorico, Sibelius), customized as a dark utility interface. Deep slate surfaces frame a bright, high-contrast cream score page, preventing eye fatigue while rendering musical symbols with optimal clarity.

### 4.2 Color Palette & Semantic Tokens
```css
:root {
  /* Canvas & Surfaces */
  --bg-base: #0F172A;          /* Deep slate canvas */
  --surface-raised: #171939;   /* Raised panels, bars, cards */
  --surface-hover: #1E2248;    /* Interactive hover state */
  --surface-active: #262B5C;   /* Selected / active container */
  --paper-cream: #F7F3EA;      /* Authentic notation paper */
  --paper-border: #E2DAC8;     /* Paper sheet edge */

  /* Semantic Accents */
  --primary: #7C3AED;          /* Primary purple accent */
  --primary-hover: #6D28D9;
  --secondary: #6366F1;        /* Secondary indigo (timeline/active items) */
  --accent: #0891B2;           /* Cyan utility accent (transport / status) */
  --danger: #DC2626;           /* Danger / reset / error red */
  --success: #10B981;          /* Verification PASS green */
  --warning: #F59E0B;          /* Draft modification amber */

  /* Text & Contrast */
  --text-primary: #F8FAFC;     /* Slate 50 (contrast > 12:1 against bg) */
  --text-secondary: #CBD5E1;   /* Slate 300 */
  --text-muted: #94A3B8;       /* Slate 400 (contrast > 4.5:1 against bg) */
  --text-score: #1E293B;       /* Notation ink color on paper */

  /* Borders & Focus Rings */
  --border-subtle: #334155;    /* Subtle panel division */
  --border-focus: #38BDF8;     /* High-visibility cyan focus outline */
  --ring-focus: 0 0 0 3px rgba(56, 189, 248, 0.4);

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-paper: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
}
```

### 4.3 Typography & Font Fallbacks
- **Interface & UI:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif`
- **Japanese Lyrics & Notation:** `"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", "Noto Sans JP", serif`
- **Timecode & Data Values:** `"SF Mono", "Menlo", "Consolas", "Monaco", monospace`
- **Contrast Standard:** Meets WCAG 2.1 AA (minimum 4.5:1 text contrast for all UI labels, > 10:1 for notation).

### 4.4 Accessibility & Ergonomics
- Clear `:focus-visible` styles with cyan ring indicator for full keyboard control.
- Global shortcuts:
  - `Space`: Play / Pause toggle
  - `S`: Stop playback (returns to Range A if set, otherwise 0:00)
  - `[`: Set Range A at current playhead
  - `]`: Set Range B at current playhead
  - `PageUp` / `PageDown`: Previous / Next score page
  - `ArrowLeft` / `ArrowRight`: Scrub playback by 5 seconds
- Reduced motion: disables smooth scrolling and transitions for users requesting reduced motion.

---

## 5. Layout Preview Representation
`layout-preview.svg` and `layout-preview.png` provide an honest static design and readability proof generated directly from the workbench's exact specifications:
- 1600x900 desktop viewport.
- Real verified counts (478 source notes, 279 lyric-bearing notes, 199 null notes, 29 lines, 160 BPM, G minor, 4/4).
- Real Japanese lyric text excerpts ("信号の消えた交差点", "濡れた午後に朝がほどける").
- Faithful cream score paper rendering with real notation staves.
- Transport state, timeline markers, A/B range overlay, and inspector panel.

*Note: As recorded in `tool-report.json`, this static layout preview is an authentic vector layout proof rendered without remote dependencies or external browser automation, strictly adhering to the Flash CLI execution boundary.*
