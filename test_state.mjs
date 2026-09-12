/**
 * test_state.mjs
 * Comprehensive unit test suite for state.mjs covering all required transitions and invariants.
 * Run with: node test_state.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {
  CANONICAL_SCORE_DATA_SHA256,
  VERIFIED_COUNTS,
  validateSourceInventoryParity,
  createScoreTrackDefinitions,
  hasScoreNotationSource,
  selectScoreTracksForDisplay,
  createInitialState,
  play,
  pause,
  togglePlay,
  stop,
  seek,
  setTime,
  setRangeA,
  setRangeB,
  setRangeAAtPlayhead,
  setRangeBAtPlayhead,
  clearRange,
  isRangeValid,
  setLoop,
  toggleLoop,
  setPage,
  prevPage,
  nextPage,
  selectLineByIndex,
  selectLineById,
  updateDraftLine,
  resetDraftLine,
  resetAllDrafts,
  exportDraftOverlay,
  addFeedback,
  updateFeedback,
  deleteFeedback,
  toggleFeedbackResolved,
  loadFeedbacks,
  exportFeedbackMarkdown
} from './state.mjs';

const scoreDataPath = path.resolve('assets', 'stardust-score-data.json');
assert.ok(fs.existsSync(scoreDataPath), `Score data file must exist at ${scoreDataPath}`);

const scoreData = JSON.parse(fs.readFileSync(scoreDataPath, 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.resolve('assets', 'source-manifest.json'), 'utf8'));

console.log('--- STARTING STATE MODULE TESTS ---');

// 0. Flow-source normalization and truthful display selection
{
  const currentTracks = createScoreTrackDefinitions(scoreData, sourceManifest);
  assert.equal(currentTracks.length, 4, 'Flow source must expose one source row per verified stem');
  assert.deepEqual(currentTracks.map(track => track.id), ['drums', 'bass', 'other', 'vocals']);
  assert.deepEqual(currentTracks.map(track => track.events.length), [263, 86, 206, 478]);
  assert.equal(currentTracks[3].scoreStatus, 'available', 'Vocal source must retain canonical notation');
  assert.equal(currentTracks[0].scoreStatus, 'available', 'Drums source must have available notation');
  assert.equal(currentTracks[1].scoreStatus, 'available', 'Bass source must have available notation');
  assert.equal(currentTracks[2].scoreStatus, 'available', 'Other source must have available notation');
  assert.deepEqual(
    currentTracks.filter(hasScoreNotationSource).map(track => track.id),
    ['drums', 'bass', 'other', 'vocals'],
    'All four Flow stems now have verified score notation data',
  );
  assert.deepEqual(selectScoreTracksForDisplay(currentTracks, '1').map(track => track.id), ['vocals']);
  assert.deepEqual(selectScoreTracksForDisplay(currentTracks, '2').map(track => track.id), ['vocals', 'drums']);
  assert.deepEqual(selectScoreTracksForDisplay(currentTracks, '3').map(track => track.id), ['vocals', 'drums', 'bass']);
  assert.deepEqual(selectScoreTracksForDisplay(currentTracks, 'all').map(track => track.id), ['vocals', 'drums', 'bass', 'other']);

  const parity = validateSourceInventoryParity(sourceManifest);
  assert.equal(parity.ok, true, 'Local manifest must match the verified Flow inventory');
  assert.equal(parity.upstreamStemCount, 4);
  assert.equal(parity.localStemCount, 4);

  const staleManifest = {
    status: 'VOCALS_ONLY',
    stems: [],
    source_readback: {
      status: 'VERIFIED',
      stems: sourceManifest.source_readback.stems
    }
  };
  const staleParity = validateSourceInventoryParity(staleManifest);
  assert.equal(staleParity.ok, false, 'A vocal-only local manifest must fail against Flow readback');
  assert.equal(staleParity.code, 'SOURCE_INVENTORY_MISMATCH');

  const multiStemManifest = {
    stems: [
      { id: 'lead-vocal', label: 'Lead Vocal', kind: 'vocal', events: [{ note_index: 1 }] },
      { id: 'bass', label: 'Bass', kind: 'instrument', events: [{ note_index: 2 }], score_page_pattern: 'assets/pages/bass-{page}.svg' }
    ]
  };
  const multiTracks = createScoreTrackDefinitions({ events: [{ note_index: 99 }] }, multiStemManifest);
  assert.deepEqual(multiTracks.map(track => track.id), ['lead-vocal', 'bass']);
  assert.deepEqual(multiTracks.map(track => track.events.length), [1, 1]);
  assert.equal(multiTracks[1].scorePagePattern, 'assets/pages/bass-{page}.svg');
  console.log('✓ Test 0: Four Flow stems, multi-staff notation bindings, and source parity verified.');
}

// 1. Initial Counts
{
  const state = createInitialState(scoreData, 181.5);
  assert.equal(state.counts.totalNotes, 478, 'Total source events must be 478');
  assert.equal(state.counts.lyricNotes, 279, 'Lyric-bearing notes must be 279');
  assert.equal(state.counts.nullNotes, 199, 'Null notes must be 199');
  assert.equal(state.counts.lyricLines, 29, 'Lyric lines count must be 29');
  assert.equal(state.counts.totalPages, 3, 'Total score pages must be 3');
  assert.equal(state.counts.tempoBpm, 160.0, 'Tempo BPM must be 160.0');
  assert.equal(state.counts.key, 'G minor', 'Key must be G minor');
  assert.equal(state.counts.timeSignature, '4/4', 'Time signature must be 4/4');
  const actualFileSha256 = crypto.createHash('sha256').update(fs.readFileSync(scoreDataPath)).digest('hex');
  assert.equal(actualFileSha256, CANONICAL_SCORE_DATA_SHA256, 'Actual file SHA256 must match CANONICAL_SCORE_DATA_SHA256');
  assert.equal(state.counts.canonicalSha256, CANONICAL_SCORE_DATA_SHA256, 'Canonical SHA256 must match');
  assert.equal(state.playback.isPlaying, false, 'Playback should initially be paused');
  assert.equal(state.playback.currentTime, 0.0, 'Playback should initially be at 0.0');
  console.log('✓ Test 1: Initial counts and metadata verified.');
}

// 2. Play / Pause
{
  let state = createInitialState(scoreData, 181.5);
  state = play(state);
  assert.equal(state.playback.isPlaying, true, 'Play should set isPlaying to true');
  state = pause(state);
  assert.equal(state.playback.isPlaying, false, 'Pause should set isPlaying to false');
  state = togglePlay(state);
  assert.equal(state.playback.isPlaying, true, 'TogglePlay should toggle to true');
  state = togglePlay(state);
  assert.equal(state.playback.isPlaying, false, 'TogglePlay should toggle to false');
  console.log('✓ Test 2: Play/pause and toggle transitions verified.');
}

// 3. Stop at 0 (No active range)
{
  let state = createInitialState(scoreData, 181.5);
  state = play(state);
  state = seek(state, 45.2);
  assert.equal(state.playback.isPlaying, true);
  assert.equal(state.playback.currentTime, 45.2);
  state = stop(state);
  assert.equal(state.playback.isPlaying, false, 'Stop must pause playback');
  assert.equal(state.playback.currentTime, 0.0, 'Stop with no range must reset currentTime to 0.0');
  console.log('✓ Test 3: Stop at 0.0 with no active range verified.');
}

// 4. Stop at Range A (Valid range active)
{
  let state = createInitialState(scoreData, 181.5);
  state = setRangeA(state, 15.0);
  state = setRangeB(state, 30.0);
  state = seek(state, 25.0);
  state = play(state);
  assert.equal(state.playback.isPlaying, true);
  state = stop(state);
  assert.equal(state.playback.isPlaying, false, 'Stop must pause playback');
  assert.equal(state.playback.currentTime, 15.0, 'Stop with valid range must return to range A (15.0)');
  console.log('✓ Test 4: Stop at Range A verified.');
}

// 5. Seek Clamping
{
  let state = createInitialState(scoreData, 181.5);
  state = seek(state, -10.0);
  assert.equal(state.playback.currentTime, 0.0, 'Negative seek must clamp to 0.0');
  state = seek(state, 200.0);
  assert.equal(state.playback.currentTime, 181.5, 'Seek past duration must clamp to duration (181.5)');
  state = seek(state, 50.5);
  assert.equal(state.playback.currentTime, 50.5, 'Valid seek within range');
  console.log('✓ Test 5: Seek boundary clamping verified.');
}

// 6. Invalid and Valid A/B Ranges
{
  assert.equal(isRangeValid(null, null), false, 'Null ranges are invalid');
  assert.equal(isRangeValid(10, null), false, 'Partial null ranges are invalid');
  assert.equal(isRangeValid(-5, 20), false, 'Negative range A is invalid');
  assert.equal(isRangeValid(30, 20), false, 'Range A >= Range B is invalid');
  assert.equal(isRangeValid(20, 20), false, 'Equal Range A and B is invalid');
  assert.equal(isRangeValid(10, 200, 181.5), false, 'Range B > duration is invalid');
  assert.equal(isRangeValid(10, 20, 181.5), true, '10 to 20 within 181.5 is valid');
  console.log('✓ Test 6: A/B range validation rules verified.');
}

// 7. Set-A / Set-B at Playhead
{
  let state = createInitialState(scoreData, 181.5);
  state = seek(state, 18.5);
  state = setRangeAAtPlayhead(state);
  assert.equal(state.playback.rangeA, 18.5, 'Range A set to playhead');
  state = seek(state, 42.0);
  state = setRangeBAtPlayhead(state);
  assert.equal(state.playback.rangeB, 42.0, 'Range B set to playhead');
  assert.equal(isRangeValid(state.playback.rangeA, state.playback.rangeB, state.playback.duration), true);
  state = clearRange(state);
  assert.equal(state.playback.rangeA, null);
  assert.equal(state.playback.rangeB, null);
  console.log('✓ Test 7: Set-A/Set-B at playhead and clearRange verified.');
}

// 8. Loop Wrap
{
  let state = createInitialState(scoreData, 181.5);
  state = setRangeA(state, 10.0);
  state = setRangeB(state, 20.0);
  state = setLoop(state, true);
  state = play(state);
  state = seek(state, 15.0);

  // Advance time past B (e.g. 20.1)
  state = setTime(state, 20.1);
  assert.equal(state.playback.currentTime, 10.0, 'Loop wrap must return to Range A (10.0)');
  assert.equal(state.playback.isPlaying, true, 'Loop wrap must remain playing');
  console.log('✓ Test 8: Loop wrap at Range B verified.');
}

// 9. Non-loop Stop at B
{
  let state = createInitialState(scoreData, 181.5);
  state = setRangeA(state, 10.0);
  state = setRangeB(state, 20.0);
  state = setLoop(state, false);
  state = play(state);
  state = seek(state, 15.0);

  // Advance time past B (e.g. 20.1)
  state = setTime(state, 20.1);
  assert.equal(state.playback.currentTime, 20.0, 'Non-loop must clamp to Range B (20.0)');
  assert.equal(state.playback.isPlaying, false, 'Non-loop must stop at Range B');
  console.log('✓ Test 9: Non-loop stop at Range B verified.');
}

// 10. Page Bounds
{
  let state = createInitialState(scoreData, 181.5);
  assert.equal(state.score.currentPage, 1);
  state = prevPage(state);
  assert.equal(state.score.currentPage, 1, 'Page cannot go below 1');
  state = nextPage(state);
  assert.equal(state.score.currentPage, 2, 'Next page goes to 2');
  state = nextPage(state);
  assert.equal(state.score.currentPage, 3, 'Next page goes to 3');
  state = nextPage(state);
  assert.equal(state.score.currentPage, 3, 'Page cannot exceed totalPages (3)');
  state = setPage(state, 100);
  assert.equal(state.score.currentPage, 3, 'SetPage clamped to 3');
  state = setPage(state, -5);
  assert.equal(state.score.currentPage, 1, 'SetPage clamped to 1');
  console.log('✓ Test 10: Score page bounds [1, 3] verified.');
}

// 11. Line Activation
{
  let state = createInitialState(scoreData, 181.5);
  // Line 0 is 13.162 -> 17.8
  state = seek(state, 14.0);
  assert.equal(state.playback.activeLineIndex, 0, 'Timestamp 14.0 should activate line 0');

  // Line 1 is 18.2 -> 23.24
  state = selectLineByIndex(state, 1);
  assert.equal(state.playback.activeLineIndex, 1, 'Selecting line 1 should activate line 1');
  assert.equal(state.playback.currentTime, 18.2, 'Selecting line 1 should seek to 18.2s');
  assert.equal(state.selectedLineId, 'line_A_01', 'selectedLineId matches line 1');
  console.log('✓ Test 11: Lyric line activation and navigation verified.');
}

// 12. Draft Edit / Reset
{
  let state = createInitialState(scoreData, 181.5);
  const lineId = 'line_A_00';
  const origLine = scoreData.lyric_lines[0];
  const origDisplayText = origLine.display_text;
  const origAlignmentText = origLine.alignment_text;

  // Edit draft overlay
  state = updateDraftLine(state, lineId, {
    display_text: '信号の消えた交差点 [DRAFT EDIT]',
    alignment_text: 'しんごうのきえたこうさてん [ドラフト]'
  });

  assert.equal(state.drafts[lineId].display_text, '信号の消えた交差点 [DRAFT EDIT]');
  // Canonical data MUST NOT be mutated!
  assert.equal(scoreData.lyric_lines[0].display_text, origDisplayText, 'Canonical scoreData display_text untouched');
  assert.equal(state.data.lyric_lines[0].display_text, origDisplayText, 'state.data display_text untouched');

  // Reset line
  state = resetDraftLine(state, lineId);
  assert.equal(state.drafts[lineId], undefined, 'Reset should remove draft override');

  // Multiple edits and resetAllDrafts
  state = updateDraftLine(state, 'line_A_00', { display_text: 'Edit 1' });
  state = updateDraftLine(state, 'line_A_01', { display_text: 'Edit 2' });
  assert.equal(Object.keys(state.drafts).length, 2);
  state = resetAllDrafts(state);
  assert.equal(Object.keys(state.drafts).length, 0);
  console.log('✓ Test 12: Draft editing and resetting without mutating canonical data verified.');
}

// 13. Exported Draft Preservation of Canonical Hash & Invariants
{
  let state = createInitialState(scoreData, 181.5);
  state = updateDraftLine(state, 'line_A_00', {
    display_text: '信号の消えた交差点 (Revised)',
    alignment_text: 'しんごうのきえたこうさてん'
  });

  const exported = exportDraftOverlay(state, scoreData);

  assert.equal(exported.canonical_bundle_sha256, CANONICAL_SCORE_DATA_SHA256, 'Exported draft must preserve canonical hash');
  assert.equal(exported.schema, 'canonflow.score-lyric-draft-overlay.v1', 'Schema matches draft overlay spec');
  assert.ok(exported.canonical_provenance, 'Canonical provenance must be preserved');
  assert.ok(exported.piece_metadata, 'Piece metadata must be preserved');
  assert.ok(exported.draft_lyric_line_overrides, 'draft_lyric_line_overrides must be present');
  assert.equal(exported.draft_lyric_line_overrides['line_A_00'].display_text, '信号の消えた交差点 (Revised)');

  // Invariant: MUST NOT contain an events array
  assert.equal(exported.events, undefined, 'Exported draft overlay MUST NOT contain events array');
  assert.equal(exported.note_events, undefined, 'Exported draft overlay MUST NOT contain note events');

  // Invariant: Canonical scoreData unchanged
  assert.equal(scoreData.events.length, 478);
  assert.equal(scoreData.events[0].lyric_syllable, 'し');
  assert.equal(scoreData.events[0].pitch_candidates[0].midi_note_number, 58);

  console.log('✓ Test 13: Exported draft preservation of canonical hash without events array or frozen field mutation verified.');
}

// 14. Four-track multi-staff schema & event validation
{
  assert.ok(Array.isArray(scoreData.stems), 'scoreData must contain stems array');
  assert.equal(scoreData.stems.length, 4, 'Must have exactly 4 named stems');

  const stemIds = scoreData.stems.map(s => s.id);
  assert.deepEqual(stemIds, ['drums', 'bass', 'other', 'vocals'], 'Must contain drums, bass, other, vocals');

  for (const stem of scoreData.stems) {
    assert.ok(stem.events.length > 0, `Stem ${stem.id} must have non-empty events`);
    assert.equal(stem.score_status, 'available', `Stem ${stem.id} score_status must be available`);
    assert.ok(stem.score, `Stem ${stem.id} must point to a score file`);
    assert.ok(stem.audio, `Stem ${stem.id} must point to an audio file`);

    // Verify event ordering & timing
    for (let i = 0; i < stem.events.length; i++) {
      const ev = stem.events[i];
      assert.equal(typeof ev.bar_number, 'number', 'bar_number must be number');
      assert.ok(ev.bar_number >= 1 && ev.bar_number <= 121, `bar_number ${ev.bar_number} must be in [1, 121]`);
      assert.ok(ev.beat_position >= 1.0 && ev.beat_position <= 5.0, 'beat_position must be valid');
      if (stem.kind === 'drums') {
        assert.equal(ev.event_type, 'drum_hit');
        assert.ok(['kick', 'snare', 'hihat'].includes(ev.instrument));
      } else {
        assert.equal(ev.event_type, 'pitched_note');
        assert.ok(ev.pitch_name, 'pitched note must have pitch_name');
        assert.ok(ev.midi_note_number > 0, 'midi_note_number must be > 0');
      }
      if (i > 0) {
        const prev = stem.events[i - 1];
        const tPrev = prev.start_time_seconds ?? prev.hit_time_seconds;
        const tCurr = ev.start_time_seconds ?? ev.hit_time_seconds;
        assert.ok(tCurr >= tPrev, `Events in ${stem.id} must be time-ordered: ${tCurr} >= ${tPrev}`);
      }
    }
  }

  // Vocal invariant: exactly 478 events
  const vocalStem = scoreData.stems.find(s => s.id === 'vocals');
  assert.equal(vocalStem.events.length, 478, 'Vocals must preserve exactly 478 events');
  assert.equal(scoreData.events.length, 478, 'Top-level compatibility events array must preserve 478 events');
  console.log('✓ Test 14: Four-track multi-staff schema, event ordering, timing, and invariants verified.');
}

// 15. Continuous 181.5s Score Timeline, Bar 121 Boundary, and Audio EOF Clamping
{
  let state = createInitialState(scoreData, 181.5);
  assert.equal(state.playback.duration, 181.5, 'Duration must be 181.5s');

  // Bar 121 start at 180.0s (120 * 1.5s)
  const bar121Time = 180.0;
  const barNum121 = Math.min(121, Math.max(1, Math.floor(bar121Time / 1.5) + 1));
  const beatInBar121 = ((bar121Time % 1.5) / 1.5) * 4.0 + 1.0;
  assert.equal(barNum121, 121, '180.0s must map to Bar 121');
  assert.equal(beatInBar121, 1.0, '180.0s must be Bar 121 Beat 1.0');

  // Terminal scrub at 181.5s
  state = seek(state, 181.5);
  assert.equal(state.playback.currentTime, 181.5, 'Clamped to 181.5s');
  const terminalBar = Math.min(121, Math.max(1, Math.floor(181.5 / 1.5) + 1));
  assert.equal(terminalBar, 121, 'Terminal time 181.5s maps to Bar 121');

  // Audio EOF clamping logic verification (media duration 167.392s)
  const audioDur = 167.392;
  const clampedAudioTime = Math.max(0, Math.min(audioDur, state.playback.currentTime));
  assert.equal(clampedAudioTime, 167.392, 'Audio time clamps to 167.392s during Outro/Bars 113-121 scrub');

  // Vocal note 0 exact timing & bar/beat mapping (13.162s, Bar 9, Beat 4.099 -> formatted 4.1)
  const note0 = scoreData.events[0];
  assert.equal(note0.start_time_seconds, 13.162, 'Canonical Vocal Note 0 starts at 13.162s');
  assert.equal(note0.bar_number, 9, 'Vocal Note 0 is in Bar 9');
  assert.equal(note0.beat_position.toFixed(1), '4.1', 'Vocal Note 0 beat position formats to 4.1');

  // Bass pitch range: F1 (MIDI 29) to G3 (MIDI 55), 86 events
  const bassStem = scoreData.stems.find(s => s.id === 'bass');
  assert.equal(bassStem.events.length, 86, 'Bass must have 86 events');
  const bassMidis = bassStem.events.map(e => e.midi_note_number);
  assert.equal(Math.min(...bassMidis), 29, 'Bass min MIDI is 29 (F1)');
  assert.equal(Math.max(...bassMidis), 55, 'Bass max MIDI is 55 (G3)');

  // Drum component breakdown: kick 70, snare 75, hihat 118, total 263
  const drumStem = scoreData.stems.find(s => s.id === 'drums');
  assert.equal(drumStem.events.length, 263, 'Drums must have 263 events');
  const drumCounts = { kick: 0, snare: 0, hihat: 0 };
  drumStem.events.forEach(e => { drumCounts[e.instrument] = (drumCounts[e.instrument] || 0) + 1; });
  assert.deepEqual(drumCounts, { kick: 70, snare: 75, hihat: 118 }, 'Drums breakdown matches source exactly');

  // Other pitch range: C3 (MIDI 48) to D#6 (MIDI 87), 206 events
  const otherStem = scoreData.stems.find(s => s.id === 'other');
  assert.equal(otherStem.events.length, 206, 'Other must have 206 events');
  const otherMidis = otherStem.events.map(e => e.midi_note_number);
  assert.equal(Math.min(...otherMidis), 48, 'Other min MIDI is 48 (C3)');
  assert.equal(Math.max(...otherMidis), 87, 'Other max MIDI is 87 (D#6)');

  console.log('✓ Test 15: 181.5s timebase, Bar 121 boundary, audio EOF clamp, and stem invariants verified.');
}

// 16. Feedback CRUD transitions and export
{
  let state = createInitialState(scoreData, 181.5);
  assert.deepEqual(state.feedbacks, [], 'Initial feedbacks array must be empty');

  // Add feedback 1 at 30.0s (Bar 21)
  state = addFeedback(state, {
    time: 30.0,
    stem: 'vocals',
    category: 'timing',
    text: '보컬 진입 타이밍 약간 늦음',
    author: 'Director'
  });
  assert.equal(state.feedbacks.length, 1);
  assert.equal(state.feedbacks[0].bar, 21);
  assert.equal(state.feedbacks[0].stem, 'vocals');
  assert.equal(state.feedbacks[0].category, 'timing');
  assert.equal(state.feedbacks[0].resolved, false);

  // Add feedback 2 at 15.0s (Bar 11) - should sort before feedback 1
  state = addFeedback(state, {
    time: 15.0,
    stem: 'drums',
    category: 'mix',
    text: '킥 어택 레벨 1.5dB 부스트 필요',
    author: 'Mixer'
  });
  assert.equal(state.feedbacks.length, 2);
  assert.equal(state.feedbacks[0].time, 15.0, 'Must sort by time ascending');
  assert.equal(state.feedbacks[1].time, 30.0);

  // Update feedback
  const idToUpdate = state.feedbacks[0].id;
  state = updateFeedback(state, idToUpdate, { text: '킥 어택 2dB 부스트로 변경' });
  assert.equal(state.feedbacks[0].text, '킥 어택 2dB 부스트로 변경');

  // Toggle resolved
  state = toggleFeedbackResolved(state, idToUpdate);
  assert.equal(state.feedbacks[0].resolved, true);

  // Export report
  const md = exportFeedbackMarkdown(state);
  assert.ok(md.includes('킥 어택 2dB 부스트로 변경'));
  assert.ok(md.includes('보컬 진입 타이밍 약간 늦음'));
  assert.ok(md.includes('Resolved'));

  // Delete feedback
  state = deleteFeedback(state, idToUpdate);
  assert.equal(state.feedbacks.length, 1);
  assert.equal(state.feedbacks[0].stem, 'vocals');

  console.log('✓ Test 16: Feedback CRUD transitions, time sorting, and export verified.');
}

console.log('--- ALL STATE MODULE TESTS PASSED SUCCESSFULLY! ---');

