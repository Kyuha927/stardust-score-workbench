# Stardust Multi-Staff Score & Feedback Workbench — Astra Pro Review Guide

This document is the primary entry point for **Astra Pro** web model review.
It details the architecture, features, invariants, and specific verification gates for this repository.

---

## 1. Project Overview & Context

- **Project**: Stardust Japanese Anime/Game Vocal Piece
- **Tempo / Meter**: 160 BPM, 4/4 Time Signature (1 measure = 1.5 seconds)
- **Total Form**: 121 Measures = 181.50 Seconds (Intro m.1-8, Verse A m.9-24, Pre-Ch m.25-32, Chorus m.33-48, Interlude m.49-52, Verse B m.53-68, Chorus m.69-84, Bridge m.85-100, Chorus m.101-116, Outro m.117-121).
- **Audio Stems**: 4 Flow-separated stems (`vocals.m4a`, `drums.m4a`, `bass.m4a`, `other.m4a`). The audio tracks fade out around 167.392 seconds, while the musical score extends through measure 121 (181.50 seconds).
- **Core Goal**: A zero-reflow, high-performance web workbench combining:
  1. Full multi-staff score viewing (Grand 4-Part Band Score + 4 Stem Part Scores).
  2. Premiere Pro / DAW style interactive score and timeline dragging & scrubbing.
  3. Right-click instant musical feedback system (pins on score, markers on timeline, inspector drawer, localStorage persistence, Markdown/JSON export).

---

## 2. Key Architecture & File Map

| File | Role | Key Invariants / Notes |
| :--- | :--- | :--- |
| `index.html` | Application UI Skeleton | Semantic DOM with Grand/Stems switcher, Score Viewport, Inspector Tabs (`📝 가사 라인` vs `💬 피드백`), Context Menu `#score-context-menu`, Modal Dialog `#feedback-modal-backdrop`, Bottom Timeline `#timeline-track`, and Toast Notifications. |
| `app.mjs` | Main Interactive Engine | Pure zero-reflow coordinate engine (`getTimeFromScorePointer`), pre-cached system bounds (`_cachedSystems`), multi-stem audio sync (`syncStemAudioClocks`), atomic pause/resume during drag, right-click context menu positioning, feedback modal and rendering logic. |
| `state.mjs` | Pure State Module | Implements immutable transitions for Playback, A/B Loop, Page navigation, Draft overrides, and Feedback CRUD (`addFeedback`, `updateFeedback`, `deleteFeedback`, `toggleFeedbackResolved`, `loadFeedbacks`, `exportFeedbackMarkdown`). |
| `test_state.mjs` | Automated Unit Tests | 17 comprehensive unit tests (Test 0 to Test 16). Exits code 0. |
| `styles.css` | Dark Theme & Layout CSS | Professional DAW aesthetics, hardware-accelerated transforms, zero transition during drag (`.score-dragging`), custom score pins and timeline markers. |
| `server.py` | Local Server Daemon | Standard library Python HTTP server with RFC 7233 byte-range support for smooth audio scrubbing. |
| `assets/` | Audio, MIDI, XML, Data | Contains canonical `stardust-score-data.json`, 4 audio stems in `flow-stems/`, MusicXML and MIDI files. |
| `pages/` | SVG Score Pages | 12 Grand score pages (`stardust-multistaff-page-01..12.svg`) and 3 stem pages (`stardust-vocals-page-01..03.svg` etc.), all verifying 121 measures. |

---

## 3. Features Implemented for Astra Pro Audit

### A. Right-Click Instant Feedback System
1. **Context Menu Trigger**:
   - Right-clicking anywhere on the score SVG frame (`#score-svg-frame` / `#score-viewport`) or timeline (`#timeline-track`) suppresses native browser context menu and opens `#score-context-menu`.
   - Computes musical time $t$, measure number (`Math.floor(t / 1.5) + 1`), and fractional beat (`((t % 1.5) / 1.5) * 4.0 + 1.0`).
   - Actions:
     - 💬 **이 지점에 피드백 남기기** (`F` / `M` shortcut): Opens modal dialog.
     - ▶️ **이 위치부터 재생** (`Space`): Seeks and initiates playback.
     - 📍 **A 루프 시작점 / B 루프 종료점** (`[` / `]`): Sets loop boundaries.
     - 📋 **현재 위치 타임코드 복사**: Copies formatted timecode to clipboard with toast feedback.
2. **Feedback Input Modal**:
   - Displays Bar, Beat, Timecode, and active Japanese lyric phrase context for the clicked measure.
   - Stem Selector pills: 전체(Master), Vocals, Drums, Bass, Other.
   - Category Selector pills: 보컬/발음, 타이밍/리듬, 음정/멜로디, 믹스/밸런스, 가사 수정, 일반 메모.
   - Author input and multi-line textarea with `Cmd+Enter` / `Ctrl+Enter` save shortcut and `Esc` to close.
   - Automatically pauses playback when modal opens so reviewer can comfortably type.
3. **Persistence & Bidirectional Visualization**:
   - Persists all feedback items in browser `localStorage` (`stardust_score_feedbacks`).
   - **Score SVG Pins (`score-feedback-pin`)**: Renders colored circular pin at the exact staff position ($x, y$) with hover tooltip. Clicking the pin seeks audio to that timestamp and highlights the corresponding card in the inspector.
   - **Timeline Markers (`timeline-feedback-marker`)**: Placed on timeline bar with hover tooltip and click-to-seek.
   - **Inspector Feedbacks Tab (`#pane-feedbacks`)**:
     - Filter toolbar by stem (전체, 보컬, 드럼, 베이스, 기타).
     - Cards show time badge, bar/beat badge, stem badge, category badge, author/timestamp, text content.
     - Card actions: Resolve toggle (`✅ 해결됨` / `⭕ 해결하기`), Seek (`▶ 이동`), Edit (`✏️ 수정`), Delete (`🗑️ 삭제`).
     - Global actions: Copy as Markdown (`📋 복사`), Download JSON (`📥 내보내기`).

### B. High-Performance Zero-Reflow Scrubbing Engine
1. **Coordinate Mapping (`getTimeFromScorePointer`)**:
   - Transforms screen `clientX`, `clientY` into SVG coordinate space $[0, 21000] \times [0, 29700]$ via inverse screen CTM (`svg.getScreenCTM().inverse()`).
   - Uses pre-built `svg._cachedSystems` parsed once per page mount.
   - Eliminates all dynamic `getBoundingClientRect()` calls in pointer event loop ($<0.05$ms per frame).
2. **Atomic Multi-Stem Playback**:
   - During score pointer drag, all active audio elements are paused atomically (`pauseAllAudio()`), with throttled audio preview (75ms).
   - Upon release, if playback was active, all stems resume atomically (`playAllAudio()`) without desynchronization.
3. **Master 181.5s Timebase & Audio EOF Clamping**:
   - Even though audio stems fade out at 167.392s, the workbench monotonic clock allows scrubbing and playhead movement all the way to measure 121 (181.50s).
   - Prevents backward snapping when navigating via keyboard arrows near the end of the piece.

---

## 4. Frozen Invariants & Verification Checklist

1. **Vocal Canon Invariant**:
   - Canonical score data SHA-256: `d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b`.
   - Total notes: 478 (279 lyric-bearing notes, 199 null/rest notes).
   - Total lyric phrases: 29.
   - Draft edits in the inspector produce overlays only; canonical JSON is immutable.
2. **Automated Unit Tests**:
   - Run `node test_state.mjs` — all 17 tests must pass.
3. **Syntax Checks**:
   - `node --check app.mjs`
   - `node --check state.mjs`

---

## 5. Instructions for Astra Pro Reviewer

When auditing this codebase, please evaluate:
1. **Interaction Rigor**: Are right-click events cleanly isolated? Does dragging feel responsive like Premiere/Logic Pro? Are keyboard shortcuts conflict-free?
2. **State Purity**: Does `state.mjs` maintain purely functional transitions? Are feedbacks correctly sorted and exported without side effects?
3. **Zero-Reflow Performance**: Is the SVG coordinate mapping truly reflow-free? Are DOM queries cached in `el`?
4. **Edge Cases**: Audio EOF boundary (167.4s to 181.5s), page transitions during scrubbing, empty feedback state, localStorage error handling.
