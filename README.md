# Stardust Multi-Staff Score & Interactive Feedback Workbench

A high-performance, zero-reflow web workbench for full 4-part musical score inspection, Japanese lyric proofing, DAW-style timeline/score scrubbing, and right-click instant feedback.

---

## 1. Quick Start (One Command)

Launch the local server daemon:
```bash
python3 server.py --port 8791
```

Open `http://127.0.0.1:8791/` in any desktop browser.

---

## 2. Core Capabilities

### A. Dual Notation Modes (Grand 4-Part & Stems Part Score)
- **Grand Score (4-Part 총보)**: All 4 Flow stems (Vocals, Drums, Bass, Other) bracketed and synchronized system-by-system across 12 full-band pages (121 measures).
- **Stems Part Score (파트보)**: Individual stem view with selectable tracks and real-time audio playback status.

### B. Premiere Pro / DAW Interactive Scrubbing Engine
- **Click & Drag on Score**: Click anywhere on the score staff to immediately position the playhead and scrub continuously across systems.
- **Atomic Multi-Stem Coordination**: 4 audio stems pause synchronously during scrubbing and resume in lockstep without drift.
- **181.50s Master Timebase**: Full 121-measure musical coverage (160 BPM, 1.5s/bar). Monotonic clock allows scrubbing beyond audio EOF (167.39s) up to 181.50s without backward snapping.
- **Zero Layout Reflow (<0.05ms)**: Inverse SVG CTM matrix transformation and pre-cached system geometry eliminate forced browser reflows during pointer movement.

### C. Right-Click Instant Feedback System
- **Context Menu**: Right-click anywhere on the score or timeline to open DAW context menu (leave feedback, play from here, set loop markers A/B, copy timecode).
- **Feedback Modal**: Automatically captures Bar, Beat, Timecode, and singing lyric text; lets you choose stem target and category tags.
- **SVG Pins & Timeline Markers**: Interactive colored pins (`score-feedback-pin`) on the score and markers on the timeline with native tooltips and click-to-seek navigation.
- **Inspector Feedback Pane**: Right sidebar tab with filtering, resolve toggle, edit, delete, and 1-click Markdown copy / JSON download.
- **Persistence**: All feedback items persist across page reloads via `localStorage`.

---

## 3. Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause (Atomic 4-stem coordination) |
| `S` | Stop playback (returns to Range A or 00:00) |
| `[` / `]` | Set Range A / Range B at current playhead |
| `L` | Toggle Loop Mode |
| `←` / `→` | Frame Scrub (0.1s · Shift: 1.5s/1 Bar, Alt: Note Snap, Ctrl: Bar Snap) |
| `↑` / `↓` | Jump to Previous / Next Japanese Lyric Line |
| `PageUp` / `PageDown` | Previous / Next Score Page |
| `F` or `M` | Open Feedback Modal at current playhead |
| `Esc` | Close Context Menu / Feedback Modal |
| `Cmd+Enter` (Mac) / `Ctrl+Enter` | Save feedback in modal dialog |

---

## 4. Verification & Testing

Run state module unit tests:
```bash
node test_state.mjs
```
(17/17 tests passing)

Run server test suite:
```bash
python3 test_server.py
```

Check code syntax:
```bash
node --check app.mjs
node --check state.mjs
```

---

## 5. File Map & Architecture

- `index.html`: Application markup and semantic layout.
- `app.mjs`: Core runtime, coordinate mapping, event listeners, audio sync, and DOM rendering.
- `state.mjs`: Pure state management (playback, ranges, pages, drafts, feedbacks).
- `styles.css`: Complete dark-theme stylesheet and responsive layout rules.
- `server.py`: Local Python server with RFC 7233 range request support.
- `ASTRA_PRO_REVIEW_GUIDE.md`: Dedicated evaluation checklist and review prompt for Astra Pro.
