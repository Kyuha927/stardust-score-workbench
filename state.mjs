/**
 * state.mjs
 * Pure, DOM-free state management with immutable transitions for Stardust score and lyrics workbench.
 */

export const CANONICAL_SCORE_DATA_SHA256 = 'd5f7959789994462c0e666bfa62035814c4138403aaa22bcf9d6bae8c05a957b';

export const VERIFIED_COUNTS = {
  totalNotes: 478,
  lyricNotes: 279,
  nullNotes: 199,
  lyricLines: 29,
  totalPages: 3,
  tempoBpm: 160.0,
  key: 'G minor',
  timeSignature: '4/4'
};

/**
 * Verifies that a downstream manifest did not silently discard an upstream
 * source readback. A manifest without a readback remains compatible with
 * legacy bundles; once a readback exists, every upstream stem must be present
 * locally with the same id.
 */
export function validateSourceInventoryParity(sourceManifest = {}) {
  const readbackStems = Array.isArray(sourceManifest.source_readback?.stems)
    ? sourceManifest.source_readback.stems
    : [];
  const localStems = Array.isArray(sourceManifest.stems) && sourceManifest.stems.length > 0
    ? sourceManifest.stems
    : Array.isArray(sourceManifest.tracks)
      ? sourceManifest.tracks
      : [];

  if (readbackStems.length === 0) {
    return {
      ok: true,
      code: null,
      upstreamStemCount: 0,
      localStemCount: localStems.length,
      missingIds: [],
      unexpectedIds: []
    };
  }

  const upstreamIds = readbackStems.map(stem => stem?.id).filter(Boolean);
  const localIds = localStems.map(stem => stem?.id).filter(Boolean);
  const missingIds = upstreamIds.filter(id => !localIds.includes(id));
  const unexpectedIds = localIds.filter(id => !upstreamIds.includes(id));
  const ok = sourceManifest.source_readback?.status === 'VERIFIED'
    && sourceManifest.status === 'FLOW_STEMS_VERIFIED'
    && upstreamIds.length === localIds.length
    && missingIds.length === 0
    && unexpectedIds.length === 0;

  return {
    ok,
    code: ok ? null : 'SOURCE_INVENTORY_MISMATCH',
    upstreamStemCount: upstreamIds.length,
    localStemCount: localIds.length,
    missingIds,
    unexpectedIds
  };
}

/**
 * Normalizes the available musical sources into one renderable score track per
 * stem. A legacy bundle may only have a flat `events` array; that data remains
 * the lead-vocal track until named stem score data is supplied.
 */
export function createScoreTrackDefinitions(scoreData = {}, sourceManifest = {}) {
  const explicitScoreTracks = Array.isArray(scoreData.stems) && scoreData.stems.length > 0
    ? scoreData.stems
    : Array.isArray(scoreData.tracks) && scoreData.tracks.length > 0
      ? scoreData.tracks
      : [];
  const manifestTracks = Array.isArray(sourceManifest.stems) && sourceManifest.stems.length > 0
    ? sourceManifest.stems
    : Array.isArray(sourceManifest.tracks)
      ? sourceManifest.tracks
      : [];
  const declaredTracks = explicitScoreTracks.length > 0 ? explicitScoreTracks : manifestTracks;

  if (declaredTracks.length === 0) {
    return [{
      id: 'lead-vocal',
      label: 'Lead Vocal',
      kind: 'vocal',
      events: Array.isArray(scoreData.events) ? scoreData.events : [],
      scorePagePattern: 'assets/pages/stardust-lead-score-page-{page}.svg',
      scorePages: [],
      score: null,
      audio: null,
      status: 'available'
    }];
  }

  const hasDeclaredVocalTrack = declaredTracks.some(track => (
    track?.kind === 'vocal' || track?.id === 'lead-vocal' || track?.id === 'vocals'
  ));

  return declaredTracks.map((track = {}, index) => {
    const id = track.id || `stem-${index + 1}`;
    const isVocalTrack = id === 'lead-vocal' || id === 'vocals' || track.kind === 'vocal';
    const isLegacyLead = isVocalTrack || (
      !hasDeclaredVocalTrack && index === 0 && explicitScoreTracks.length === 0
    );
    const events = Array.isArray(track.events)
      ? track.events
      : isLegacyLead && Array.isArray(scoreData.events)
        ? scoreData.events
        : [];

    return {
      id,
      label: track.label || track.name || `Stem ${index + 1}`,
      kind: track.kind || 'instrument',
      events,
      scorePagePattern: track.score_page_pattern || track.scorePagePattern || null,
      scorePages: Array.isArray(track.score_pages)
        ? track.score_pages
        : Array.isArray(track.scorePages)
          ? track.scorePages
          : [],
      score: track.score || null,
      audio: track.audio || null,
      scoreStatus: track.score_status || track.scoreStatus || (events.length > 0 ? 'available' : 'pending_transcription'),
      status: track.status || 'declared'
    };
  });
}

/**
 * Whether a source has supplied notation data that can truthfully be shown as
 * a staff. Audio presence alone is deliberately not enough: an audio stem
 * without score data must not be rendered as if it has notation.
 */
export function hasScoreNotationSource(track = {}) {
  return track.scoreStatus === 'available'
    || (Array.isArray(track.events) && track.events.length > 0)
    || Boolean(track.score)
    || Boolean(track.scorePagePattern)
    || (Array.isArray(track.scorePages) && track.scorePages.length > 0);
}

/**
 * Select the source rows shown in the score view. Genuine notation is always
 * shown first, followed by the verified audio-only sources in manifest order.
 * This keeps one- through three-source views truthful even when a requested
 * instrumental stem has not supplied transcription data yet.
 */
export function selectScoreTracksForDisplay(tracks = [], selection = 'all') {
  const sources = Array.isArray(tracks) ? tracks : [];
  const requestedCount = selection === 'all'
    ? sources.length
    : Math.max(1, Math.min(sources.length, Number.parseInt(selection, 10) || sources.length));

  // Canonical presentation order: Vocals (lead) first, followed by Drums, Bass, Other
  const isVocal = (t) => t.kind === 'vocal' || t.id === 'vocals' || t.id === 'lead-vocal';
  const vocals = sources.filter(isVocal);
  const instruments = sources.filter((t) => !isVocal(t));
  const ordered = [...vocals, ...instruments];

  const notationSources = ordered.filter(hasScoreNotationSource);
  const audioOnlySources = ordered.filter((track) => !hasScoreNotationSource(track));

  return [...notationSources, ...audioOnlySources].slice(0, requestedCount);
}

/**
 * Validates whether range A and B form a valid playback window.
 */
export function isRangeValid(rangeA, rangeB, duration = Infinity) {
  if (rangeA === null || rangeA === undefined || rangeB === null || rangeB === undefined) {
    return false;
  }
  const a = Number(rangeA);
  const b = Number(rangeB);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return false;
  }
  if (a < 0) return false;
  if (b > duration && Number.isFinite(duration)) return false;
  return a < b;
}

/**
 * Finds the index of the active lyric line for the given timestamp.
 */
export function findLineIndexAtTime(lyricLines = [], time = 0.0) {
  if (!Array.isArray(lyricLines) || lyricLines.length === 0) return -1;
  for (let i = 0; i < lyricLines.length; i++) {
    const line = lyricLines[i];
    if (time >= line.start_time_seconds && time <= line.end_time_seconds) {
      return i;
    }
  }
  // If in a gap between lines, find if we are preceding the next line
  for (let i = 0; i < lyricLines.length - 1; i++) {
    if (time > lyricLines[i].end_time_seconds && time < lyricLines[i + 1].start_time_seconds) {
      return i;
    }
  }
  if (time > lyricLines[lyricLines.length - 1].end_time_seconds) {
    return lyricLines.length - 1;
  }
  return -1;
}

/**
 * Finds the index of the active note event for the given timestamp.
 */
export function findEventIndexAtTime(events = [], time = 0.0) {
  if (!Array.isArray(events) || events.length === 0) return -1;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (time >= ev.start_time_seconds && time <= ev.end_time_seconds) {
      return i;
    }
  }
  return -1;
}

/**
 * Creates the initial application state.
 */
export function createInitialState(scoreData = {}, audioDuration = 181.5) {
  const events = scoreData.events || [];
  const lyricLines = scoreData.lyric_lines || [];
  const exportMeta = scoreData.export_metadata || {};
  const pieceMeta = scoreData.piece_metadata || {};

  const totalPages = exportMeta.score_pages_count || 3;

  return {
    data: {
      schema: scoreData.schema || 'canonflow.score-lyric-bundle.v1',
      title: scoreData.title || 'Stardust',
      piece_metadata: pieceMeta,
      source_provenance: scoreData.source_provenance || {},
      export_metadata: exportMeta,
      invariants_verified: scoreData.invariants_verified || {},
      events: events,
      lyric_lines: lyricLines,
      blackout_regions: scoreData.blackout_regions || []
    },
    counts: {
      totalNotes: events.length || exportMeta.total_source_events || 478,
      lyricNotes: exportMeta.lyric_note_count || 279,
      nullNotes: exportMeta.null_note_count || 199,
      lyricLines: lyricLines.length || exportMeta.lyric_lines_count || 29,
      totalPages: totalPages,
      tempoBpm: pieceMeta.tempo_bpm || 160.0,
      key: pieceMeta.key || 'G minor',
      timeSignature: pieceMeta.time_signature || '4/4',
      canonicalSha256: CANONICAL_SCORE_DATA_SHA256
    },
    playback: {
      currentTime: 0.0,
      isPlaying: false,
      duration: audioDuration,
      loop: false,
      rangeA: null,
      rangeB: null,
      activeLineIndex: -1,
      activeEventIndex: -1
    },
    score: {
      currentPage: 1,
      totalPages: totalPages,
      zoom: 1.0
    },
    drafts: {}, // Map of line_id -> { display_text, alignment_text }
    selectedLineId: lyricLines[0]?.line_id || null,
    feedbacks: [] // List of feedback items: { id, time, bar, beat, stem, category, text, author, createdAt, resolved }
  };
}

/**
 * Pure transition: Play
 */
export function play(state) {
  return {
    ...state,
    playback: {
      ...state.playback,
      isPlaying: true
    }
  };
}

/**
 * Pure transition: Pause
 */
export function pause(state) {
  return {
    ...state,
    playback: {
      ...state.playback,
      isPlaying: false
    }
  };
}

/**
 * Pure transition: Toggle play/pause
 */
export function togglePlay(state) {
  return state.playback.isPlaying ? pause(state) : play(state);
}

/**
 * Pure transition: Stop
 * "Stop returns to range A when a valid range is active, otherwise 0."
 */
export function stop(state) {
  const { rangeA, rangeB, duration } = state.playback;
  const valid = isRangeValid(rangeA, rangeB, duration);
  const targetTime = valid ? rangeA : 0.0;

  const activeLineIndex = findLineIndexAtTime(state.data.lyric_lines, targetTime);
  const activeEventIndex = findEventIndexAtTime(state.data.events, targetTime);

  return {
    ...state,
    playback: {
      ...state.playback,
      isPlaying: false,
      currentTime: targetTime,
      activeLineIndex,
      activeEventIndex
    }
  };
}

/**
 * Pure transition: Seek to explicit time.
 * Clamps targetTime to [0, duration].
 */
export function seek(state, targetTime) {
  const duration = state.playback.duration || Infinity;
  let clampedTime = Math.max(0, Math.min(Number(targetTime) || 0, duration));

  const activeLineIndex = findLineIndexAtTime(state.data.lyric_lines, clampedTime);
  const activeEventIndex = findEventIndexAtTime(state.data.events, clampedTime);

  return {
    ...state,
    playback: {
      ...state.playback,
      currentTime: clampedTime,
      activeLineIndex,
      activeEventIndex
    }
  };
}

/**
 * Pure transition: setTime (called during playback updates).
 * Enforces range boundaries:
 * - When looping is ON and newTime >= rangeB: wrap back to rangeA.
 * - When looping is OFF and newTime >= rangeB: stop playback at rangeB.
 */
export function setTime(state, newTime) {
  const duration = state.playback.duration || Infinity;
  let t = Math.max(0, Math.min(Number(newTime) || 0, duration));
  const { rangeA, rangeB, loop, isPlaying } = state.playback;
  const rangeActive = isRangeValid(rangeA, rangeB, duration);

  let nextPlaying = isPlaying;
  let finalTime = t;

  if (rangeActive && t >= rangeB) {
    if (loop) {
      finalTime = rangeA;
      nextPlaying = true;
    } else {
      finalTime = rangeB;
      nextPlaying = false;
    }
  }

  const activeLineIndex = findLineIndexAtTime(state.data.lyric_lines, finalTime);
  const activeEventIndex = findEventIndexAtTime(state.data.events, finalTime);

  return {
    ...state,
    playback: {
      ...state.playback,
      isPlaying: nextPlaying,
      currentTime: finalTime,
      activeLineIndex,
      activeEventIndex
    }
  };
}

/**
 * Pure transition: Set Range A.
 */
export function setRangeA(state, aVal) {
  const val = aVal === null || aVal === '' ? null : Math.max(0, Number(aVal));
  return {
    ...state,
    playback: {
      ...state.playback,
      rangeA: val
    }
  };
}

/**
 * Pure transition: Set Range B.
 */
export function setRangeB(state, bVal) {
  const duration = state.playback.duration || Infinity;
  const val = bVal === null || bVal === '' ? null : Math.min(duration, Math.max(0, Number(bVal)));
  return {
    ...state,
    playback: {
      ...state.playback,
      rangeB: val
    }
  };
}

/**
 * Pure transition: Set Range A at current playhead.
 */
export function setRangeAAtPlayhead(state) {
  return setRangeA(state, state.playback.currentTime);
}

/**
 * Pure transition: Set Range B at current playhead.
 */
export function setRangeBAtPlayhead(state) {
  return setRangeB(state, state.playback.currentTime);
}

/**
 * Pure transition: Clear A/B Range.
 */
export function clearRange(state) {
  return {
    ...state,
    playback: {
      ...state.playback,
      rangeA: null,
      rangeB: null
    }
  };
}

/**
 * Pure transition: Set loop state.
 */
export function setLoop(state, loopEnabled) {
  return {
    ...state,
    playback: {
      ...state.playback,
      loop: Boolean(loopEnabled)
    }
  };
}

/**
 * Pure transition: Toggle loop.
 */
export function toggleLoop(state) {
  return setLoop(state, !state.playback.loop);
}

/**
 * Pure transition: Set current score page (clamped [1, totalPages]).
 */
export function setPage(state, pageNum) {
  const total = state.score.totalPages || 3;
  const clamped = Math.max(1, Math.min(Number(pageNum) || 1, total));
  return {
    ...state,
    score: {
      ...state.score,
      currentPage: clamped
    }
  };
}

/**
 * Pure transition: Prev page.
 */
export function prevPage(state) {
  return setPage(state, state.score.currentPage - 1);
}

/**
 * Pure transition: Next page.
 */
export function nextPage(state) {
  return setPage(state, state.score.currentPage + 1);
}

/**
 * Pure transition: Select line by index and seek to start.
 */
export function selectLineByIndex(state, lineIndex) {
  const lines = state.data.lyric_lines || [];
  if (lineIndex < 0 || lineIndex >= lines.length) return state;
  const line = lines[lineIndex];
  const seeked = seek(state, line.start_time_seconds);
  return {
    ...seeked,
    selectedLineId: line.line_id,
    playback: {
      ...seeked.playback,
      activeLineIndex: lineIndex
    }
  };
}

/**
 * Pure transition: Select line by line_id.
 */
export function selectLineById(state, lineId) {
  const lines = state.data.lyric_lines || [];
  const idx = lines.findIndex(l => l.line_id === lineId);
  if (idx === -1) return state;
  return selectLineByIndex(state, idx);
}

/**
 * Pure transition: Update draft overlay for a lyric line.
 * Canonical data remains completely frozen!
 */
export function updateDraftLine(state, lineId, { display_text, alignment_text }) {
  if (!lineId) return state;
  const existing = state.drafts[lineId] || {};
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [lineId]: {
        display_text: display_text !== undefined ? display_text : existing.display_text,
        alignment_text: alignment_text !== undefined ? alignment_text : existing.alignment_text
      }
    }
  };
}

/**
 * Pure transition: Reset draft overlay for a lyric line.
 */
export function resetDraftLine(state, lineId) {
  if (!state.drafts[lineId]) return state;
  const newDrafts = { ...state.drafts };
  delete newDrafts[lineId];
  return {
    ...state,
    drafts: newDrafts
  };
}

/**
 * Pure transition: Reset all drafts.
 */
export function resetAllDrafts(state) {
  return {
    ...state,
    drafts: {}
  };
}

/**
 * Export draft overlay JSON object.
 * Preserves canonical bundle hash/provenance.
 * Contains draft_lyric_line_overrides ONLY.
 * Does NOT contain events array or mutate frozen fields.
 */
export function exportDraftOverlay(state, scoreData = state.data) {
  return {
    schema: 'canonflow.score-lyric-draft-overlay.v1',
    canonical_bundle_sha256: CANONICAL_SCORE_DATA_SHA256,
    canonical_provenance: scoreData.source_provenance || {},
    piece_metadata: scoreData.piece_metadata || {},
    export_metadata: {
      generated_at: new Date().toISOString(),
      tool_task_id: 'stardust-r01-score-lyrics-tool-20260911-r1',
      total_draft_overrides: Object.keys(state.drafts).length
    },
    draft_lyric_line_overrides: { ...state.drafts }
  };
}

/**
 * Pure transition: Add a feedback item.
 * Items are kept sorted by time ascending.
 */
export function addFeedback(state, feedback = {}) {
  const time = Math.max(0, Number(feedback.time ?? state.playback.currentTime) || 0);
  const bar = feedback.bar ?? (Math.floor(time / 1.5) + 1);
  const beat = feedback.beat ?? (((time % 1.5) / 1.5) * 4.0 + 1.0);
  const item = {
    id: feedback.id || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    time: Number(time.toFixed(3)),
    bar: Math.max(1, Math.min(121, Math.round(bar))),
    beat: Number(Number(beat).toFixed(2)),
    stem: feedback.stem || 'all',
    category: feedback.category || 'general',
    text: String(feedback.text || '').trim(),
    author: feedback.author || 'Reviewer',
    createdAt: feedback.createdAt || new Date().toISOString(),
    resolved: Boolean(feedback.resolved)
  };

  const nextFeedbacks = [...(state.feedbacks || []), item];
  nextFeedbacks.sort((a, b) => a.time - b.time);

  return {
    ...state,
    feedbacks: nextFeedbacks
  };
}

/**
 * Pure transition: Update an existing feedback item by id.
 */
export function updateFeedback(state, id, updates = {}) {
  if (!id) return state;
  const list = state.feedbacks || [];
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) return state;

  const current = list[idx];
  const nextItem = {
    ...current,
    ...updates,
    id: current.id, // preserve id
    time: updates.time !== undefined ? Number(Number(updates.time).toFixed(3)) : current.time,
    text: updates.text !== undefined ? String(updates.text).trim() : current.text
  };

  const nextFeedbacks = [...list];
  nextFeedbacks[idx] = nextItem;
  nextFeedbacks.sort((a, b) => a.time - b.time);

  return {
    ...state,
    feedbacks: nextFeedbacks
  };
}

/**
 * Pure transition: Delete a feedback item by id.
 */
export function deleteFeedback(state, id) {
  if (!id) return state;
  return {
    ...state,
    feedbacks: (state.feedbacks || []).filter(item => item.id !== id)
  };
}

/**
 * Pure transition: Toggle feedback resolved state.
 */
export function toggleFeedbackResolved(state, id) {
  const item = (state.feedbacks || []).find(f => f.id === id);
  if (!item) return state;
  return updateFeedback(state, id, { resolved: !item.resolved });
}

/**
 * Pure transition: Load existing feedbacks (e.g. from localStorage).
 */
export function loadFeedbacks(state, feedbackList = []) {
  if (!Array.isArray(feedbackList)) return state;
  const validated = feedbackList
    .filter(f => f && typeof f.text === 'string' && f.text.trim().length > 0)
    .map(f => ({
      id: f.id || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      time: Math.max(0, Number(f.time) || 0),
      bar: Math.max(1, Math.min(121, Number(f.bar) || 1)),
      beat: Number(Number(f.beat || 1.0).toFixed(2)),
      stem: f.stem || 'all',
      category: f.category || 'general',
      text: String(f.text).trim(),
      author: f.author || 'Reviewer',
      createdAt: f.createdAt || new Date().toISOString(),
      resolved: Boolean(f.resolved)
    }));
  validated.sort((a, b) => a.time - b.time);
  return {
    ...state,
    feedbacks: validated
  };
}

/**
 * Export feedbacks to structured Markdown report.
 */
export function exportFeedbackMarkdown(state) {
  const items = state.feedbacks || [];
  const lines = [
    `# Stardust Score & Production Feedback Report`,
    `Generated: ${new Date().toISOString()}`,
    `Total Feedbacks: ${items.length}`,
    `Canonical Bundle SHA-256: \`${CANONICAL_SCORE_DATA_SHA256}\``,
    ``,
    `| # | Timecode | Bar · Beat | Track | Category | Author | Status | Feedback |`,
    `|---|---|---|---|---|---|---|---|`
  ];

  items.forEach((item, idx) => {
    const mins = Math.floor(item.time / 60);
    const secs = (item.time % 60).toFixed(2).padStart(5, '0');
    const tc = `${String(mins).padStart(2, '0')}:${secs}`;
    const status = item.resolved ? '✓ Resolved' : 'Open';
    const textSafe = item.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${idx + 1} | ${tc} | Bar ${item.bar} · B${item.beat} | ${item.stem} | ${item.category} | ${item.author} | ${status} | ${textSafe} |`);
  });

  return lines.join('\n');
}
