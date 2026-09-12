# CODEX CLI 5.6 SOL MAX AUDIT & REVIEW GATE SPECIFICATION
**Task ID**: `stardust-r02-multistaff-score-20260912`
**Reviewer Target**: Codex CLI 5.6 Sol Max (`gpt-5.6-sol`, effort `ultra` / `max`)
**Subject**: Stardust 4-Part Multi-Staff Score Workbench, Zero-Reflow 60fps Playhead Engine, Interactive Score Sheet Playhead, and DAW Timeline

---

## 1. MANDATORY GATE CRITERIA

### Gate 1: Frozen Canonical Vocal Spec Preservation
- **Invariants**: 478 vocal canon events, 279 lyric syllables, 199 null notes, 50 extension notes.
- **Rules**: Pitches, start times, durations, Mora alignments, and canonical text must NOT be mutated.
- **Verification**: `state.mjs`, `test_state.mjs` (Test 0-15 verifies raw file hash `d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b`), `CANONFLOW_SCORE_LYRIC_CONTRACT.md`.

### Gate 2: 4-Part Multi-Staff Score Parity
- **Tracks**: Vocals (Lead, 478 events), Drums (263 events: 70 kick, 75 snare, 118 hihat), Bass (86 events, F1–G3 / MIDI 29–55), Other (206 events, C3–D#6 / MIDI 48–87).
- **Measures**: Exactly 121 measures across all 4 stems ($160\text{ BPM}, 4/4 \implies 1.5\text{s}$ per bar, $121 \times 1.5\text{s} = 181.5\text{s}$ total score duration). Audio stems play available audio ($167.39\text{s}$) while the timeline and score smoothly track through all 121 measures ($181.5\text{s}$).
- **Artifacts**: `stardust-multistaff.musicxml`, `stardust-multistaff.mid`, 12 Grand Score SVGs (`pages/stardust-multistaff-page-01.svg` through `12.svg`), and 4 individual stem SVGs.

### Gate 3: Continuous Measure / Beat Sync & Intro Rest Bug Resolution
- **Sync Model**: Continuous musical time mapping calibrated to the 121-bar score ($0.0\text{s} \le t \le 181.5\text{s}$):
  $$\text{barNum} = \min(121, \max(1, \lfloor t / 1.5 \rfloor + 1))$$
  $$\text{beatInBar} = ((t \pmod{1.5}) / 1.5) \times 4.0 + 1.0$$
- **Intro Bug Fix**: Vocal Note 0 starts at $13.162\text{s}$ (Bar 9 Beat 4.1). During Bars 1–8 ($0.0\text{s} \le t < 13.162\text{s}$), the score cursor must smoothly sweep across Bars 1 to 8 without freezing at Note 0.
- **Page Follow**: Auto page turn follows `getScorePageForBar(barNum)` across all 12 pages instead of note presence.

### Gate 4: Zero-Reflow 60fps Playhead & Premiere-Style Timeline Scrubbing
- **Reflow Elimination**: Zero `getBBox()`, zero `querySelectorAll()`, and zero `getBoundingClientRect()` calls during active 60fps animation frames or drag updates. Measure boundaries, system scroll positions, and centers are pre-calculated once on page load via `parseScoreGeometryDOM` (<1ms).
- **Audio Throttling**: Named `AUDIO_SEEK_THROTTLE_MS = 75` throttled audio seeks during rapid pointer scrubbing prevents HTML5 audio decoder bottleneck; exact audio position committed on `pointerup`.

### Gate 5: Interactive Score Sheet Playhead & Instant Feedback Integration
- **Score Playhead Handles**: Top downward-pointing pentagon badge (`.score-playhead-handle`), bottom guide notch (`.score-playhead-handle-bottom`), and 36px wide hit-target area (`.score-karaoke-cursor-hitarea`) attached to `.score-karaoke-cursor-line`.
- **Coordinate Transformation**: Standard W3C SVG `getScreenCTM().inverse()` coordinate transform accurately converts screen pointer `(clientX, clientY)` to SVG `[0, 21000] x [0, 29700]` space across any zoom level, scale, or scroll position.
- **Continuous Score Scrubbing**: Users can click and drag the playhead or click anywhere on score staves/measures to scrub continuously. Uses `setPointerCapture` for uninterrupted drag tracking even outside SVG boundaries.
- **Multi-System Navigation**: Pointer dragging smoothly tracks across vertical staff systems (rows) and interpolates fractional beats within measures.
- **Instant Lyric Drawer Auto-Load**: As the playhead scrubs over the score, the active lyric line at that exact measure/beat automatically loads into the right-hand editor drawer for instant feedback and draft editing.
- **Keyboard Controls**: `←/→` (0.1s frame scrub), `Shift+←/→` (1.5s 1-bar scrub), `Ctrl/Cmd+←/→` (bar snap), `Alt+←/→` (note snap), `↑/↓` (lyric line jump).

### Gate 6: Test & Runtime Server Verification
- **Unit Tests**: `test_state.mjs` (16/16 PASS, Tests 0–15).
- **Integration Tests**: `test_server.py` (15/15 PASS).
- **Daemon Server**: Running on `http://127.0.0.1:8791` serving all endpoints correctly.

---

## 2. AUDIT INSTRUCTIONS FOR REVIEWER
1. Inspect `app.mjs`, `styles.css`, `index.html`, `state.mjs`, `test_state.mjs`, and `test_server.py`.
2. Verify whether all 6 gates above are strictly satisfied.
3. Check for any bugs, coordinate edge cases, layout reflow leaks, race conditions, or performance bottlenecks.
4. Run:
   - `node --check app.mjs`
   - `node test_state.mjs`
   - `curl -s -I http://127.0.0.1:8791/index.html`
5. Output a strict, decisive verdict (`PASS`, `CONDITIONAL_PASS`, or `FAIL`) with detailed technical feedback.
