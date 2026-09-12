# Executive Summary

**Decisive Gate Verdict: [FAIL]**

The frozen vocal canon is intact, and several important implementation pieces are present: the canonical hash and upstream field parity are correct; all 16 state tests pass; the four-part MusicXML/MIDI data is structurally sound; the score-pointer transform, multi-system interpolation, overlays, 75ms seek throttling, lyric auto-load, page lookup, and all requested keyboard branches exist.

The workbench nevertheless fails final acceptance because the most important runtime promises are not true:

1. **The advertised 181.5-second master timebase is not actually authoritative.** Animation, `timeupdate`, `ended`, and keyboard navigation remain governed by the 167.392-second vocal `<audio>` element.
2. **Score dragging pauses and resumes only the master vocal element.** The other three stems continue running during the drag.
3. **The zero-reflow contract is violated.** A drag-time `getBoundingClientRect()` fallback exists, and `querySelectorAll()` runs when a scrub crosses lyric-line boundaries.
4. **Geometry is measured while the score SVG is still detached from the document.** Cached system scroll positions therefore cannot be trusted.
5. **The vocal part SVG is incomplete:** 120 measure elements instead of the required 121.
6. **Current integration proof is not independently established.** The required `curl` and integration suite were blocked by the terminal sandbox, and the existing proof files are bound to obsolete `app.mjs` and `styles.css` hashes.

No files were changed, and no Git commands were run.

## Gate Summary

| Gate | Verdict | Principal result |
|---|---:|---|
| Gate 1: Frozen canonical vocal spec | **PASS** | Canonical hash, counts, upstream notes, lyric alignment, lyric lines, and blackout regions match. |
| Gate 2: Four-part score parity | **FAIL** | Track data and main MusicXML/MIDI pass, but the vocal SVG has only 120 measures and runtime cannot progress through 181.5s. |
| Gate 3: Continuous measure/beat sync | **FAIL** | Formula and page lookup are implemented, but the live clock stops at 167.392s and keyboard navigation collapses back to that time. |
| Gate 4: Zero-reflow 60fps playhead | **FAIL** | Drag path contains forbidden DOM calls; system geometry is measured while detached; no valid timing benchmark supports the stated thresholds. |
| Gate 5: Interactive score playhead | **FAIL** | Core UI machinery exists, but multi-stem pause/resume is incorrect and keyboard scrubbing uses the wrong clock beyond audio EOF. |
| Gate 6: Tests and runtime server | **FAIL / NOT ESTABLISHED** | Unit tests pass and the UI is live, but the current 15/15 integration gate was not independently executable and the supplied UI proof hashes are stale. |

# Findings by Severity

## Critical: the 181.5-second “master” timebase is split from the real runtime clock

The authoritative constant is declared correctly at [app.mjs:36](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:36):

```js
export const SCORE_TOTAL_DURATION = 181.5;
```

But the application does not have an independent 181.5-second score clock:

- Stem seeks are clamped to each audio file’s real duration in [app.mjs:292](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:292).
- Playback state is repeatedly replaced with `el.audio.currentTime` in [app.mjs:1878](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1878).
- The 60fps animation frame reads `el.audio.currentTime` directly in [app.mjs:1478](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1478).
- The master audio’s `ended` event pauses the application in [app.mjs:1906](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1906).
- Keyboard navigation chooses the audio clock whenever it is nonzero in [app.mjs:2109](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:2109):

```js
const currentTime = el.audio.currentTime || appState?.playback?.currentTime || 0;
```

All four stems are exactly 167.392 seconds:

```text
assets/flow-stems/vocals.m4a: 167.392000 seconds
assets/flow-stems/drums.m4a: 167.392000 seconds
assets/flow-stems/bass.m4a: 167.392000 seconds
assets/flow-stems/other.m4a: 167.392000 seconds
```

The canonical data still contains vocal events after that boundary:

```json
{
  "score_total_duration_seconds": 181.5,
  "last_vocal_event": {
    "start": 177.232,
    "end": 177.762,
    "bar": 119
  },
  "event_count": 478
}
```

### Live runtime reproduction

In the current browser-served workbench:

1. The UI reported `Score: 181.50s | Audio: 167.39s`.
2. Clicking Play started all four audio elements.
3. Dragging the timeline near its end produced:
   - score time `03:00.85 / 03:01.50`
   - `BAR 121 · BEAT 3.3`
   - score page 12
   - every audio element clamped at exactly `167.392`
4. Pressing `ArrowRight` immediately moved the UI backward to:
   - `02:47.49 / 03:01.50`
   - `BAR 112 · BEAT 3.6`
   - page 11

That backward jump follows directly from the truthy `el.audio.currentTime` expression at line 2109. This is conclusive runtime evidence that the score clock is not unified.

## Critical: score dragging pauses only one of four stems

`wireScoreInteraction()` correctly registers the required pointer events and capture behavior, but its playback coordination is not multi-stem-safe.

On pointerdown, only `el.audio` is paused:

```js
if (wasPlaying && el.audio && !el.audio.paused) {
  el.audio.pause();
}
```

See [app.mjs:574](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:574) and [app.mjs:585](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:585).

On release and stationary-note selection, only `el.audio` is resumed:

```js
if (wasPlaying && el.audio) {
  el.audio.play().catch(() => {});
}
```

See [app.mjs:632](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:632) and [app.mjs:653](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:653).

The project already has `pauseAllAudio()` and `playAllAudio()` at [app.mjs:311](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:311), but the score-drag path does not use them.

Consequences:

- Drums, bass, and other continue audibly while the vocal master is paused.
- Throttled seeks periodically relocate still-playing stems during the drag.
- The score animation stops because it listens to the master audio’s pause event, even though three audio sources remain active.
- Resuming only the master does not constitute an atomic four-stem resume.

This directly violates Gate 5’s playback-pause/resume requirement.

## High: the zero-reflow contract is false

The gate explicitly requires zero `getBBox()`, zero `querySelectorAll()`, and zero `getBoundingClientRect()` during active animation frames or drag updates. See [CODEX_SOL_MAX_REVIEW_GATE.md:27](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/CODEX_SOL_MAX_REVIEW_GATE.md:27).

There are two definite violations.

### Drag-time layout fallback

`getTimeFromScorePointer()` normally performs the required `getScreenCTM().inverse()` conversion, but its null-CTM fallback calls `getBoundingClientRect()` from the pointer path:

```js
const ctm = svg.getScreenCTM();
if (ctm) {
  const transformed = pt.matrixTransform(ctm.inverse());
  // ...
} else {
  const rect = svg.getBoundingClientRect();
  // ...
}
```

See [app.mjs:446](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:446) and [app.mjs:462](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:462).

Even if that fallback is uncommon, the gate says zero, not “zero on the normal path.”

### Drag-time DOM query

Every score scrub calls `syncUI()` through [app.mjs:402](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:402). Whenever the active lyric line changes, `syncUI()` executes:

```js
const rows = el.lyricList.querySelectorAll('.lyric-row');
```

See [app.mjs:1792](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1792).

Dragging over lyric-line boundaries is a normal active-drag scenario. Therefore the zero-`querySelectorAll()` drag requirement is unambiguously violated.

### The `<0.05ms` claim is not supported

The mapper rebuilds its working representation for every pointer event:

- `Array.from(map.values())` at [app.mjs:473](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:473)
- repeated `systems.find(...)` grouping at [app.mjs:476](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:476)
- a fresh array copy and sort at [app.mjs:512](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:512)

No benchmark, trace, `performance.now()` measurement, or percentile result exists in the inspected proof files. The `<0.05ms` statement at [app.mjs:444](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:444) is a comment, not verification evidence.

## High: system scroll geometry is captured while the SVG is detached

`parseScoreGeometryDOM()` deliberately reads system and viewport rectangles to precompute `systemScrollTop`:

```js
const sysRect = sys.getBoundingClientRect();
const vpRect = el.scoreViewport.getBoundingClientRect();
```

See [app.mjs:669](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:669).

However, in grand-score mode, geometry is parsed before `replaceChildren()` attaches the new score layer:

- geometry parse: [app.mjs:820](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:820)
- insertion into the live DOM: [app.mjs:826](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:826)

The same ordering occurs for individual stems:

- geometry parse: [app.mjs:931](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:931)
- live insertion: [app.mjs:966](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:966)

Detached elements do not provide meaningful viewport-relative layout rectangles. `followScoreMeasure()` later trusts those cached values at [app.mjs:1311](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1311). Thus the alleged “pre-calculated once” system-scroll cache is generated at the wrong lifecycle point.

## High: the individual vocal SVG omits one measure

The exact SVG inventory is:

| Score set | Pages | Measures per page | Total |
|---|---:|---|---:|
| Grand score | 12 | 13, 12, 11, 9, 9, 9, 10, 12, 9, 9, 10, 8 | **121** |
| Vocals | 3 | 39, 44, 37 | **120** |
| Drums | 3 | 39, 44, 38 | **121** |
| Bass | 3 | 39, 44, 38 | **121** |
| Other | 3 | 39, 44, 38 | **121** |

The app declares individual page 3 as measures 84–121 at [app.mjs:72](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:72). That range contains 38 measures, but [stardust-vocals-page-03.svg](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/assets/pages/stardust-vocals-page-03.svg) contains only 37 `<g class="measure">` elements.

Because `parseScoreGeometryDOM()` assigns bars sequentially, vocal page 3 receives mappings only for bars 84–120. Bar 121 has no vocal measure geometry.

There is also stale metadata: `export_metadata.multistaff_pages_count` is `11` in [stardust-score-data.json:67](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/stardust-score-data.json:67), while the application and actual artifact set contain 12 grand-score pages.

# Per-Gate Findings

## Gate 1: Frozen Canonical Vocal Spec Preservation — PASS

The canonical invariants are all present:

```json
{
  "events": 478,
  "lyric_non_null": 279,
  "lyric_null": 199,
  "extensions": 50,
  "lyric_lines": 29,
  "blackout_regions": 36
}
```

Both copies of the score JSON have the required hash:

```text
SHA2-256(stardust-score-data.json)= d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b
SHA2-256(assets/stardust-score-data.json)= d5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b
```

The expected hash is fixed in [state.mjs:6](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/state.mjs:6), and the test reads and verifies the raw artifact in [test_state.mjs:113](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/test_state.mjs:113).

I also compared the current file directly with:

- [gemini-lead-topline.json](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r01-lead-topline-20260911/gemini-lead-topline.json)
- [lyric-alignment.json](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r01-lyric-alignment-20260911-r5/lyric-alignment.json)

The comparison result was:

```json
{
  "lead_to_current": {
    "count_match": true,
    "source_count": 478,
    "current_count": 478,
    "missingByKey": {},
    "mismatchByKey": {}
  },
  "alignment_to_current": {
    "count_match": true,
    "source_count": 478,
    "current_count": 478,
    "missingByKey": {},
    "mismatchByKey": {}
  },
  "lyric_lines_exact": true,
  "blackouts_exact": true,
  "vocal_events_exact": true,
  "vocal_event_count": 478
}
```

For the lead-topline comparison only, `lyric_syllable` was excluded because that source intentionally has unaligned/null lyrics; the alignment source was then compared with all its fields, with zero mismatches.

## Gate 2: Four-Part Multi-Staff Score Parity — FAIL

The event data itself passes:

```json
{
  "drums": {
    "events": 263,
    "bars": [43, 108],
    "midi": [36, 42],
    "instruments": {
      "kick": 70,
      "snare": 75,
      "hihat": 118
    }
  },
  "bass": {
    "events": 86,
    "bars": [6, 109],
    "midi": [29, 55]
  },
  "other": {
    "events": 206,
    "bars": [2, 110],
    "midi": [48, 87]
  },
  "vocals": {
    "events": 478,
    "bars": [9, 119],
    "midi": [53, 79]
  }
}
```

The main MusicXML is also correct:

```json
{
  "parts": [
    {"id": "P1f04a5fda50526c6f4d0828dfe949d78", "measures": 121},
    {"id": "P53bd0e083283b6b55ea4a39395054076", "measures": 121},
    {"id": "P1c41be403f6b70b47d17c3957c1a4d5d", "measures": 121},
    {"id": "P68929b1db69ce189752f0d122db9412e", "measures": 121}
  ],
  "names": ["Vocals", "Drums", "Bass", "Other"]
}
```

The multistaff MIDI header is valid:

```json
{
  "file": "assets/stardust-multistaff.mid",
  "magic": "MThd",
  "format": 1,
  "tracks": 5,
  "division": 375,
  "bytes": 11076
}
```

The gate nevertheless fails because:

- The vocal SVG set has 120 rather than 121 measure elements.
- Playback cannot smoothly traverse all 181.5 seconds; the governing audio clock ends at 167.392 seconds.
- Canonical vocal events at 177.232–177.762 seconds are unreachable through natural playback.
- The page-count metadata says 11 while there are 12 grand-score pages.

## Gate 3: Continuous Measure/Beat Sync and Intro Rest — FAIL

The mathematical mapping itself is correctly implemented:

```js
const barNum = Math.min(121, Math.max(1, Math.floor(playbackTime / 1.5) + 1));
const beatFrac = (playbackTime % 1.5) / 1.5;
const beatInBar = beatFrac * 4.0 + 1.0;
```

See [app.mjs:1321](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1321).

The cursor uses measure time rather than waiting for a vocal note, so the Bars 1–8 intro sweep is correctly designed. Note 0 remains at 13.162 seconds, Bar 9, Beat 4.099.

Page selection is also bar-based:

- page lookup: [app.mjs:1108](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1108)
- playback page follow: [app.mjs:1495](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1495)

The gate fails at runtime because the formula does not receive a continuously advancing 0–181.5-second clock. It receives `el.audio.currentTime`, which ends at 167.392 seconds. The live 180.85 → 167.49 keyboard regression also shows that manually reaching the final bars does not preserve the score timebase.

Page switching itself was observable: the manual scrub moved to page 12, and the erroneous keyboard rollback moved it back to page 11. The defect is the controlling time source, not the page-range lookup.

## Gate 4: Zero-Reflow 60fps Playhead and Scrubbing — FAIL

Passing parts:

- `AUDIO_SEEK_THROTTLE_MS = 75` is correctly named and set at [app.mjs:38](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:38).
- Rapid score movement uses throttled seeks at [app.mjs:416](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:416).
- Pointer release clears the pending timer and performs an exact commit at [app.mjs:627](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:627).
- `runScoreAnimationFrame()` itself updates SVG attributes/styles without directly querying layout at [app.mjs:1478](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1478).

Failing parts:

- `getBoundingClientRect()` is reachable from the active score-pointer path.
- `querySelectorAll()` runs during scrubs that change lyric lines.
- Geometry’s system scroll positions are measured while the score is detached.
- System grouping and sorting are rebuilt for every pointer event rather than cached.
- Neither `<0.05ms` pointer conversion nor `<1ms` page-load parsing has measured proof.

The CSS also applies a `0.05s` transition to playhead-handle transforms at [styles.css:883](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:883). That introduces visual interpolation/lag between the actual cursor position and the handle during rapid updates; it should be disabled while playing or dragging if exact real-time positioning is required.

## Gate 5: Interactive Score Sheet Playhead — FAIL

The following requirements are correctly present.

### Pointer transformation and interpolation

`getTimeFromScorePointer()` provides:

- `svg.createSVGPoint()` and screen coordinates at [app.mjs:453](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:453)
- `getScreenCTM().inverse()` at [app.mjs:456](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:456)
- vertical system grouping at [app.mjs:476](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:476)
- containing or nearest system selection at [app.mjs:497](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:497)
- horizontal measure/fractional-beat interpolation at [app.mjs:520](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:520)
- duration clamping at [app.mjs:552](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:552)

### Pointer lifecycle

`wireScoreInteraction()` includes:

- `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` at [app.mjs:658](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:658)
- `setPointerCapture()` at [app.mjs:591](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:591)
- dragging classes at [app.mjs:595](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:595)
- stationary-note selection at [app.mjs:632](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:632)

Using the same handler for `pointercancel` and `pointerup` is questionable: cancellation currently performs a final seek, can interpret the gesture as a stationary click, and resumes playback. A dedicated cancellation cleanup path would be safer.

### Required overlays

`createScoreOverlay()` creates all five named elements at [app.mjs:1048](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1048):

- `.score-karaoke-cursor-line`
- `.score-karaoke-cursor-hitarea`
- `.score-playhead-handle`
- `.score-playhead-handle-bottom`
- `.score-karaoke-cursor-label`

`updateScoreCursorFast()` moves those elements using SVG attributes/transforms at [app.mjs:1391](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:1391).

Their styling is present at:

- cursor line: [styles.css:864](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:864)
- 36px hit area: [styles.css:875](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:875)
- top handle: [styles.css:883](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:883)
- bottom handle: [styles.css:900](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:900)
- label: [styles.css:910](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/styles.css:910)

A browser readback confirmed exactly one instance of each overlay on the rendered grand-score page.

### Lyric-line auto-load

The active line is loaded into the editor after each scrub at [app.mjs:431](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:431). This requirement passes.

### Keyboard controls

All requested branches exist at [app.mjs:2103](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/app.mjs:2103):

- plain left/right: ±0.1 seconds
- Shift: ±1.5 seconds
- Ctrl/Cmd: bar snapping
- Alt: previous/next note
- up/down: lyric-line navigation and editor loading

The branches are present, but the shared `currentTime` source is wrong after audio EOF. Therefore their full-range runtime behavior fails.

Because multi-stem pause/resume and full-range keyboard navigation are both broken, Gate 5 fails despite the otherwise substantial implementation.

## Gate 6: Test and Runtime Server Verification — FAIL / NOT ESTABLISHED

### Required syntax check

```text
$ node --check app.mjs
```

Result:

```text
exit code 0
(no stdout or stderr)
```

### Required unit test

```text
$ node test_state.mjs
```

Result:

```text
--- STARTING STATE MODULE TESTS ---
✓ Test 0: Four Flow stems, multi-staff notation bindings, and source parity verified.
✓ Test 1: Initial counts and metadata verified.
✓ Test 2: Play/pause and toggle transitions verified.
✓ Test 3: Stop at 0.0 with no active range verified.
✓ Test 4: Stop at Range A verified.
✓ Test 5: Seek boundary clamping verified.
✓ Test 6: A/B range validation rules verified.
✓ Test 7: Set-A/Set-B at playhead and clearRange verified.
✓ Test 8: Loop wrap at Range B verified.
✓ Test 9: Non-loop stop at Range B verified.
✓ Test 10: Score page bounds [1, 3] verified.
✓ Test 11: Lyric line activation and navigation verified.
✓ Test 12: Draft editing and resetting without mutating canonical data verified.
✓ Test 13: Exported draft preservation of canonical hash without events array or frozen field mutation verified.
✓ Test 14: Four-track multi-staff schema, event ordering, timing, and invariants verified.
✓ Test 15: 181.5s timebase, Bar 121 boundary, audio EOF clamp, and stem invariants verified.
--- ALL STATE MODULE TESTS PASSED SUCCESSFULLY! ---
```

Result: **exit code 0; 16/16 tests passed**.

These are state/model tests. They do not execute `app.mjs`’s DOM, audio, pointer, animation, or browser-clock behavior, which is why Test 15 can pass while the live workbench still has the split-clock defect.

### Required daemon `curl`

```text
$ curl -s -I http://127.0.0.1:8791/index.html
```

Result:

```text
exit code 7
(no output because -s was used)
```

The same URL loaded and operated successfully on the browser surface, so this result is consistent with the terminal sandbox’s loopback restrictions and is not evidence that the daemon was absent. The live browser confirmed:

- the expected page title
- all 12 page controls
- all 29 lyric lines
- the current JavaScript UI
- all four audio elements with `readyState = 4`
- all four durations at `167.392`
- working Play and timeline scrub interactions

### Integration suite

A direct current run of:

```text
$ python3 test_server.py
```

terminated before launching the server or executing any endpoint assertions:

```text
File "test_server.py", line 22, in run_tests
    port = find_free_port()
File "test_server.py", line 18, in find_free_port
    s.bind(('127.0.0.1', 0))
PermissionError: [Errno 1] Operation not permitted
```

The failing call is at [test_server.py:16](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/test_server.py:16). This is a sandbox limitation, not a failed server assertion.

Static inspection of [server.py:40](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/server.py:40), [server.py:51](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/server.py:51), and [server.py:81](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/server.py:81) found reasonable HEAD/GET handling, canonical-path containment, MIME mappings, range parsing, 416 handling, and no-store headers. Static inspection is not a substitute for the required live 15/15 suite.

### Existing proof files are stale for the current UI

The supplied proof expects:

```text
app.mjs    0c8c530a394c07100a856b4d29777df23b6f7f80601f0da1a671194d38121566
styles.css bf973157eb3f1c6dfe71ba1e8a9d2b73c3ce38a8eb3bfad953991ab6d7611780
```

See [worker-proof.json:42](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/worker-proof.json:42), [worker-proof.json:46](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/worker-proof.json:46), [final-report.json:130](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/final-report.json:130), and [final-report.json:142](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/final-report.json:142).

The current files are:

```text
SHA2-256(app.mjs)= dae1f6d94bf243d873357ad41b1b568464f2b51f2a3fee8e781edee4b4fa6f3e
SHA2-256(styles.css)= a2a960ddb596eba8dc17c4241ad3c24c76c612b7cdf0d73e32944c456de24d96
```

The current `state.mjs`, `test_state.mjs`, `server.py`, `test_server.py`, and canonical JSON hashes do match the old proof. Therefore the historical server result remains useful background evidence, but the proof package does not bind the current interactive implementation and cannot satisfy a strict final audit.

# Required Remediation

## Priority 0: establish a real score master clock

Use a monotonic score clock as the sole source of application playback time:

- Anchor it with `performance.now()` when playback starts.
- Advance it to 181.5 seconds independently of the audio elements.
- Keep all stems synchronized to that clock while `t < 167.392`.
- At each stem’s EOF, leave that stem silent/clamped while the score clock continues through 181.5.
- Do not pause the score merely because the vocal element emits `ended`.
- Make keyboard, timeline, score dragging, A/B looping, page follow, and animation read the same score time.
- Replace line 2109 with the score state’s time; do not prefer a truthy clamped audio time.
- Add an explicit test proving that `ArrowRight` at 180.85 seconds produces 180.95, not 167.49.

Padding all four assets to 181.5 seconds would also eliminate the media discontinuity, but the gate explicitly permits 167.39-second audio with a longer score, so the application still needs coherent score-clock semantics.

## Priority 0: make score dragging atomic across all stems

In `wireScoreInteraction()`:

- Pause all four audio elements on pointerdown via the existing all-audio helper.
- Resume all four only if playback was active before the gesture.
- Preserve one coherent playback-state transition.
- Ensure pointerup clears any pending throttled seek before the exact four-stem commit.
- Give `pointercancel` a dedicated cleanup path rather than treating it as a successful pointerup/click.
- Add a browser test that records play/pause events for all four elements during a score drag.

## Priority 1: repair and cache geometry after DOM attachment

The safe sequence is:

1. Create/import the page.
2. Insert it into `#score-svg-frame`.
3. On the next layout-ready turn, calculate geometry once.
4. Cache:
   - sorted measures per system
   - system vertical ranges and centers
   - valid system scroll positions
   - lyric row references
5. During pointermove and animation, use only those cached structures.

If `getScreenCTM()` is unavailable during a drag, return `null` or use a precomputed fallback; do not call `getBoundingClientRect()` in that path.

The mapper should not reconstruct and sort systems for every event. Benchmark the final function over representative grand and individual pages, reporting sample count, median, p95, maximum, browser version, and machine. A source comment is not sufficient evidence for `<0.05ms`.

## Priority 1: regenerate the vocal part page

Regenerate [stardust-vocals-page-03.svg](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/assets/pages/stardust-vocals-page-03.svg) so the vocal set contains 39+44+38 = 121 addressable measure groups.

Add an artifact validator that fails unless:

- grand-score total = 121
- vocals total = 121
- drums total = 121
- bass total = 121
- other total = 121
- every declared page range equals the number of measures assigned by the browser geometry parser

Because the score JSON is frozen and hash-bound, do not silently edit its stale `multistaff_pages_count`. Either place render-manifest metadata in a separate noncanonical file or perform an explicitly versioned canonical regeneration with a new approved hash and contract.

## Priority 1: add browser-level acceptance tests

The current state tests cannot detect the observed failures. Add tests for:

- playback continuing from 167.392 to 181.5 in silence
- no backward keyboard jump after audio EOF
- all four stems pausing/resuming during score dragging
- score-pointer navigation across multiple systems
- lyric drawer selection during drag
- page transitions through all 12 pages
- bar 121 geometry in both display modes
- zero forbidden DOM calls during an instrumented drag and animation run
- valid system autoscroll after score-page insertion
- exact overlay count and handle positioning
- pointercancel semantics

## Priority 2: refresh proof only after the fixes pass

After remediation:

1. Run `node --check app.mjs`.
2. Run `node test_state.mjs`.
3. Run `python3 test_server.py` in an environment where loopback bind is permitted.
4. Run `curl -s -I http://127.0.0.1:8791/index.html`.
5. Run the browser acceptance and performance tests.
6. Recompute all artifact hashes.
7. Regenerate `worker-proof.json` and `final-report.json` so they bind the exact audited files.
8. Include the browser/runtime evidence; a process being present or a report saying “PASS” is not sufficient.

As a smaller server-hardening item, [server.py:191](/Users/macpro/Documents/Codex/2026-09-09/1-2-flash-3-bgm-4/work/antigravity-runs/stardust-r02-multistaff-score-20260912/server.py:191) accepts an arbitrary `--host` despite the module claiming it binds strictly to `127.0.0.1`. If loopback-only operation is a security invariant, reject non-loopback host values.

# Final Determination

**[FAIL]**

Gate 1 passes. The remaining score artifacts contain substantial valid work, but Gates 2–5 have concrete current defects, including two independently decisive runtime failures. Gate 6 also lacks a current independently executable integration result, although the daemon was visibly live in the browser and the terminal failures were sandbox-related.

The workbench should not be represented as final, zero-reflow, fully synchronized, or Gate-PASS until the master-clock, four-stem drag, detached-geometry, vocal-measure, and proof-binding defects are corrected and freshly reverified.

Requested reviewer target was `gpt-5.6-sol` at `ultra/max`. The host did not expose an independently readable runtime model/service-tier identifier to this audit, so I do not treat the requested route label itself as verified evidence.