# CANONFLOW Score and Lyric Contract (v1.0)
*Reusable, Implementation-Neutral Specification for Melodic Topline and Lyric Alignment Integration*

## 1. Scope and Authority Notice

This document defines the canonical specification for binding melodic topline note events to Japanese lyric alignments, generating deterministic musical artifacts (MusicXML, MIDI, structured score data bundles), and verifying roundtrip integrity.

> **Operational Notice:**
> Syncing, citing, or referencing this contract does not force a merge into an active CANONFLOW task, pipeline run, or upstream trunk. This contract operates as an implementation-neutral architectural standard that can be validated, audited, and adopted independently by any compliant audio, scoring, or synthesis worker.

---

## 2. Source-Note Identity and Immutability

### 2.1 Canonical Event Model
Every extracted or composed vocal event is assigned an immutable, 0-indexed integer identifier (`source_index` or `note_index`).

### 2.2 Frozen (Immutable) Fields
Once an extracted lead topline is approved, the following fields are permanently **frozen** and must never be altered, re-ordered, shifted, or deleted by subsequent alignment or score-export stages:
- `start_time_seconds`: Floating-point timestamp in seconds (millisecond resolution).
- `end_time_seconds`: Floating-point timestamp in seconds (millisecond resolution).
- `pitch_candidates`: Ordered list of detected pitch candidates, with candidate 0 specifying primary `pitch_name` (e.g. `A#3`, `G4`) and `midi_note_number` (e.g. `58`, `67`).
- `duration_in_beats`: Beat duration computed at the nominal tempo.
- `bar_number`: Integer measure number (1-based index).
- `beat_number`: Integer beat number within the measure (1-based index).
- `beat_position`: Decimal beat position within the measure (1.000 to 4.999 in 4/4).
- `confidence`: Formant extraction confidence metric ($0.00 \le c \le 1.00$).
- `uncertain`: Boolean flag indicating pitch detection ambiguity.

### 2.3 Zero-Drop Invariant
The export bundle must contain exactly the same number of ordered source note events as the approved topline input (e.g., exactly 478 events for Stardust R01). Omission or synthetic insertion of melodic notes is strictly prohibited.

---

## 3. Lyric-Line, Token, and Mora Provenance

### 3.1 Hierarchical Structure
Lyrics follow a strict four-tier provenance hierarchy:
1. **Section**: Macro structural segment (e.g., `Intro`, `Verse 1A`, `Verse 1B`, `Pre-Chorus`, `Chorus`, `Bridge`, `Outro`).
2. **Line**: Line-level unit identified by a unique `line_id` (e.g., `line_A_00`, `line_C_01`), defining start/end bounds, display text (Kanji/Kana), phonetic alignment text (Hiragana), and constituent note indices.
3. **Token / Word**: Semantic word or compound lexical token.
4. **Mora / Syllable**: Minimal rhythmic-phonetic atom mapped directly to vocal note events.

### 3.2 Provenance Fields per Note Event
For every note event associated with a lyric line:
- `lyric_syllable`: Exact Hiragana or Katakana character(s) sung on that note (e.g., `し`, `ん`, `ご`, `ない`).
- `lyric_line_id`: Deterministic parent line identifier.
- `lyric_confidence`: Independent confidence score of the phonetic-to-audio alignment.
- `lyric_source_mora_indices`: Array of 0-indexed character/mora positions within the line's `alignment_text`.
- `lyric_extension`: Boolean flag indicating whether the note is a melismatic extension of the preceding syllable.
- `lyric_null_reason`: Explicit diagnostic string if no syllable is assigned.

---

## 4. Null and Blackout Semantics

### 4.1 Musical Rest vs. Lyric-Null Note vs. Blackout Region
A rigorous distinction is maintained between three classes of absence:
1. **Musical Rest**: Interval of true vocal silence where no vocal pitch exists. In MusicXML, represented as `<rest>` elements; in MIDI, represented as the time delta between preceding `note_off` and subsequent `note_on`.
2. **Lyric-Null Note**: An active sung note event that carries no independent lyric syllable. Typical causes include:
   - Vocal melisma / pitch glide trailing off a prior word.
   - Non-lexical vocalise, breath intake, or expressive release.
   - Degraded, masked, or unintelligible vocal passages where lyric assignment would be speculative fabrication.
   - Such notes must explicitly maintain `lyric_syllable: null` with an informative `lyric_null_reason`.
3. **Blackout Region**: Macroscopic time range where lead vocal presence is explicitly excluded from transcription (e.g., instrumental solos, rhythm breaks, backing vocal stacks without lead).

---

## 5. Extension and Notation Tie Handling

### 5.1 Metric Quantization vs. Exact Audio Timing
Traditional notation requires quantization to standard metric subdivisions (e.g., 16th-note grid at $\Delta = 0.25$ beats) and subdivision across metric boundaries (beats 1.0, 2.0, 3.0, 4.0, and measure bar lines).

### 5.2 Deterministic Tie Marking and Syllable Attachment
When a source note event crosses a measure boundary or requires notation splitting:
1. **Deterministic Index Marker**: Every split notation note element retains an explicit attribute pointing back to its source note index (e.g., `<note id="source_note_42_seg_0_0">`).
2. **First-Segment Lyric Attachment**: The `<lyric>` element is placed **strictly on the first tied segment** (`is_global_first == True`).
3. **Subsequent Segments**: Tied continuation notes (`Tie('continue')`, `Tie('stop')`) must receive **no lyric elements**.
4. **Count Integrity**: The exporter and verifier must explicitly report that the notated note segment count (e.g. 545 segments) reflects metric split ties and does **not** alter or redefine the true source note count (478 events).

---

## 6. Editable Fields vs. Frozen Fields

To enable human or AI engraving polishing without corrupting source data:

| Field Category | Mutability | Permitted Operations |
| :--- | :--- | :--- |
| **Source Melodic Data** | **FROZEN** | Read-only. Pitches, MIDI numbers, start/end seconds, durations cannot be modified. |
| **Lyric Syllable Text** | **FROZEN** | Read-only once approved. No invented syllables or re-segmentations. |
| **Visual Engraving** | **EDITABLE** | System breaks, page breaks, beam grouping, stem directions, clef changes. |
| **Typographical Style** | **EDITABLE** | Font family, font size, lyric placement offset (X/Y), title formatting. |
| **Performance Marks** | **EDITABLE** | Articulations (staccato, accent), dynamics ($p$, $f$, $mf$), breath marks. |

---

## 7. Export and Independent Readback Specifications

### 7.1 MusicXML 4.0 Partwise
- Must be valid XML conforming to the MusicXML 4.0 DTD.
- Single vocal part with explicit `<part-name>Lead Vocal</part-name>`.
- Full meter (`4/4`), key (`G minor` with 2 flats), and tempo (`<metronome><beat-unit>quarter</beat-unit><per-minute>160</per-minute></metronome>`).
- Lyric syllables properly enclosed in `<lyric number="1"><syllabic>single</syllabic><text>...</text></lyric>`.
- Verified via clean independent re-parsing with `music21`.

### 7.2 High-Resolution MIDI Export
- Format 0 or Format 1 standard MIDI file.
- Timing resolution chosen so that every integer millisecond is represented with zero rounding error.
  - At 160 BPM ($375\,000\,\mu\text{s}$ per quarter note), setting `ticks_per_beat = 375` yields exactly $1.0\,\text{ms}$ per tick.
- Meta events:
  - `track_name`: `'Lead Vocal'`
  - `time_signature`: $4/4$
  - `key_signature`: `'Gm'`
  - `set_tempo`: $375\,000\,\mu\text{s}$ ($160.0\,\text{BPM}$)
  - `lyrics`: UTF-8 encoded lyric syllables aligned to exact `note_on` ticks.
- Dynamic velocity mapped deterministically from note extraction confidence:
  $$\text{velocity} = \max(1, \min(127, \text{round}(\text{confidence} \times 127.0)))$$
- Verified via clean independent re-parsing with `mido` with 0 timing drift.

---

## 8. Host-Tool and Workflow Integration

This contract guarantees seamless import and cross-validation across standard digital audio workstations and score engravers:
- **DAWs**: Logic Pro, Cubase Pro, PreSonus Studio One, REAPER, Ableton Live (MIDI markers and notes import with exact millisecond onsets and velocities).
- **Engravers**: Dorico, MuseScore 4, Finale, Sibelius (MusicXML imports with clean 4/4 bar structures, standard ties, and Japanese Hiragana lyrics positioned below the staff).
- **Vocal Synthesizers**: Synthesizer V Studio, CeVIO AI, VOCALOID6 (direct ingestion of MIDI note timings, velocities, and embedded lyric syllables).
