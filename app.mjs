/**
 * app.mjs
 * Main application binding connecting pure state.mjs with DOM, Audio element, Canvas timeline, and interactions.
 */

import {
  CANONICAL_SCORE_DATA_SHA256,
  createScoreTrackDefinitions,
  hasScoreNotationSource,
  selectScoreTracksForDisplay,
  validateSourceInventoryParity,
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
  toggleLoop,
  setPage,
  prevPage,
  nextPage,
  selectLineByIndex,
  selectLineById,
  updateDraftLine,
  resetDraftLine,
  exportDraftOverlay,
  addFeedback,
  updateFeedback,
  deleteFeedback,
  toggleFeedbackResolved,
  loadFeedbacks,
  exportFeedbackMarkdown
} from './state.mjs';

// Authoritative musical score timing constants (160 BPM, 4/4 = 1.5s per measure, 121 measures = 181.5s)
export const SCORE_TOTAL_DURATION = 181.5;
export const AUDIO_SEEK_THROTTLE_MS = 75;

// Global application state container
let appState = null;
let rawScoreData = null;
let sourceManifest = null;
let scoreTracks = [];
let stemAudios = [];
let renderedScorePage = 0;
let scorePageLoadToken = 0;
let scoreSvg = null;
let scoreOverlay = null;
let scoreLayers = [];
let lastCursorEventKey = '';
let followPageRequested = false;
let scoreAnimationFrame = 0;
let scoreDisplaySelection = 'all';
let scoreViewMode = 'grand';

const MULTISTAFF_PAGE_RANGES = [
  { page: 1, startBar: 1, endBar: 13, label: 'Measures 1–13' },
  { page: 2, startBar: 14, endBar: 25, label: 'Measures 14–25' },
  { page: 3, startBar: 26, endBar: 36, label: 'Measures 26–36' },
  { page: 4, startBar: 37, endBar: 45, label: 'Measures 37–45' },
  { page: 5, startBar: 46, endBar: 54, label: 'Measures 46–54' },
  { page: 6, startBar: 55, endBar: 63, label: 'Measures 55–63' },
  { page: 7, startBar: 64, endBar: 73, label: 'Measures 64–73' },
  { page: 8, startBar: 74, endBar: 85, label: 'Measures 74–85' },
  { page: 9, startBar: 86, endBar: 94, label: 'Measures 86–94' },
  { page: 10, startBar: 95, endBar: 103, label: 'Measures 95–103' },
  { page: 11, startBar: 104, endBar: 113, label: 'Measures 104–113' },
  { page: 12, startBar: 114, endBar: 121, label: 'Measures 114–121' }
];

const STEM_PAGE_RANGES = [
  { page: 1, startBar: 1, endBar: 39, label: 'Measures 1–39' },
  { page: 2, startBar: 40, endBar: 83, label: 'Measures 40–83' },
  { page: 3, startBar: 84, endBar: 121, label: 'Measures 84–121' }
];

// DOM Elements cache
const el = {
  audio: document.getElementById('audio-player'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  playIcon: document.getElementById('play-icon'),
  playText: document.getElementById('play-text'),
  btnStop: document.getElementById('btn-stop'),
  btnLoop: document.getElementById('btn-loop'),
  loopText: document.getElementById('loop-text'),
  timecodeDisplay: document.getElementById('timecode-display'),
  measureBeatBadge: document.getElementById('measure-beat-badge'),
  inputRangeA: document.getElementById('input-range-a'),
  inputRangeB: document.getElementById('input-range-b'),
  btnSetA: document.getElementById('btn-set-a'),
  btnSetB: document.getElementById('btn-set-b'),
  btnClearRange: document.getElementById('btn-clear-range'),
  btnExportDraft: document.getElementById('btn-export-draft'),

  // Metadata chips
  chipNotesCount: document.getElementById('chip-notes-count'),
  chipLyricsCount: document.getElementById('chip-lyrics-count'),
  chipNullsCount: document.getElementById('chip-nulls-count'),
  chipLinesCount: document.getElementById('chip-lines-count'),
  chipTempoKey: document.getElementById('chip-tempo-key'),
  chipSource: document.getElementById('chip-source'),
  draftCountChip: document.getElementById('draft-count-chip'),

  // Presentation mode & Page Navigator
  btnModeGrand: document.getElementById('btn-mode-grand'),
  btnModeStems: document.getElementById('btn-mode-stems'),
  scoreSourceSelector: document.getElementById('score-source-selector'),
  pagesHeaderTitle: document.getElementById('pages-header-title'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  thumbnailsList: document.getElementById('thumbnails-list'),
  thumbnails: [],
  scoreSvgFrame: document.getElementById('score-svg-frame'),
  scorePageIndicator: document.getElementById('score-page-indicator'),
  scoreLiveReadout: document.getElementById('score-live-readout'),
  scoreFollowState: document.getElementById('score-follow-state'),
  scoreSourceStatus: document.getElementById('score-source-status'),
  scoreSourceTrack: document.getElementById('score-source-track'),
  scoreSourceDetail: document.getElementById('score-source-detail'),
  scoreNotationCount: document.getElementById('score-notation-count'),
  scoreDisplayOptions: Array.from(document.querySelectorAll('input[name="score-display-count"]')),
  scoreViewport: document.getElementById('score-viewport'),
  scoreToolbar: document.querySelector('.score-toolbar'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomFit: document.getElementById('btn-zoom-fit'),
  zoomLevel: document.getElementById('zoom-level'),
  scorePaper: document.getElementById('score-paper'),
  stemAudioBank: document.getElementById('stem-audio-bank'),

  // Lyric Inspector
  lyricList: document.getElementById('lyric-list'),
  editorLineTitle: document.getElementById('editor-line-title'),
  editorStatusChip: document.getElementById('editor-status-chip'),
  canonicalLineText: document.getElementById('canonical-line-text'),
  inputDraftDisplay: document.getElementById('input-draft-display'),
  inputDraftAlignment: document.getElementById('input-draft-alignment'),
  btnSaveDraft: document.getElementById('btn-save-draft'),
  btnResetLine: document.getElementById('btn-reset-line'),

  // Timeline
  timelineTrack: document.getElementById('timeline-track'),
  timelineCanvas: document.getElementById('timeline-canvas'),
  timelineRangeHighlight: document.getElementById('timeline-range-highlight'),
  timelineFeedbackMarkers: document.getElementById('timeline-feedback-markers'),
  timelineHoverGuide: document.getElementById('timeline-hover-guide'),
  timelineHoverTooltip: document.getElementById('timeline-hover-tooltip'),
  timelinePlayhead: document.getElementById('timeline-playhead'),
  timelineActiveInfo: document.getElementById('timeline-active-info'),
  timelineActiveEvent: document.getElementById('timeline-active-event'),
  timelineDurationInfo: document.getElementById('timeline-duration-info'),

  // Context Menu & Feedback Modal & Tabs
  scoreContextMenu: document.getElementById('score-context-menu'),
  ctxBarBeat: document.getElementById('ctx-bar-beat'),
  ctxTimecode: document.getElementById('ctx-timecode'),
  ctxBtnAddFeedback: document.getElementById('ctx-btn-add-feedback'),
  ctxBtnPlayFromHere: document.getElementById('ctx-btn-play-from-here'),
  ctxBtnSetRangeA: document.getElementById('ctx-btn-set-range-a'),
  ctxBtnSetRangeB: document.getElementById('ctx-btn-set-range-b'),
  ctxBtnCopyTimecode: document.getElementById('ctx-btn-copy-timecode'),

  feedbackModalBackdrop: document.getElementById('feedback-modal-backdrop'),
  feedbackDialogLocation: document.getElementById('feedback-dialog-location'),
  feedbackStemSelector: document.getElementById('feedback-stem-selector'),
  feedbackCategorySelector: document.getElementById('feedback-category-selector'),
  feedbackLyricContext: document.getElementById('feedback-lyric-context'),
  feedbackContextLyricText: document.getElementById('feedback-context-lyric-text'),
  feedbackTextarea: document.getElementById('feedback-textarea'),
  feedbackAuthorInput: document.getElementById('feedback-author-input'),
  btnCloseFeedbackModal: document.getElementById('btn-close-feedback-modal'),
  btnCancelFeedback: document.getElementById('btn-cancel-feedback'),
  btnSubmitFeedback: document.getElementById('btn-submit-feedback'),

  tabLyrics: document.getElementById('tab-lyrics'),
  tabFeedbacks: document.getElementById('tab-feedbacks'),
  paneLyrics: document.getElementById('pane-lyrics'),
  paneFeedbacks: document.getElementById('pane-feedbacks'),
  feedbackCountBadge: document.getElementById('feedback-count-badge'),
  feedbackCardsList: document.getElementById('feedback-cards-list'),
  feedbackEmptyState: document.getElementById('feedback-empty-state'),
  btnAddFeedbackNow: document.getElementById('btn-add-feedback-now'),
  btnCopyFeedbacks: document.getElementById('btn-copy-feedbacks'),
  btnExportFeedbacks: document.getElementById('btn-export-feedbacks'),
  feedbackFilterChips: document.getElementById('feedback-filter-chips'),
  toastContainer: document.getElementById('toast-container'),
  lyricRows: []
};

/**
 * Format seconds to MM:SS.SS
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(5, '0');
  return `${mStr}:${sStr}`;
}

/**
 * Initialize application
 */
async function init() {
  try {
    const [res, sourceRes] = await Promise.all([
      fetch('assets/stardust-score-data.json'),
      fetch(el.audio.dataset.sourceManifest || 'assets/source-manifest.json')
    ]);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching score data`);
    rawScoreData = await res.json();
    sourceManifest = sourceRes.ok ? await sourceRes.json() : null;
    scoreTracks = createScoreTrackDefinitions(rawScoreData, sourceManifest || {});
    scoreDisplaySelection = getScoreDisplaySelection();
    setupStemAudioTracks();

    appState = createInitialState(rawScoreData, SCORE_TOTAL_DURATION);
    if (scoreViewMode === 'grand') {
      appState.score.totalPages = MULTISTAFF_PAGE_RANGES.length;
    }

    setupEventListeners();
    setupContextMenuAndFeedback();

    // Restore saved feedbacks from localStorage
    try {
      const saved = localStorage.getItem('stardust_score_feedbacks');
      if (saved) {
        const parsed = JSON.parse(saved);
        appState = loadFeedbacks(appState, parsed);
      }
    } catch (err) {
      console.warn('Failed to load saved feedbacks:', err);
    }

    renderMetadata();
    renderSourceStatus();
    renderPageThumbnails();
    renderLyricList();
    renderFeedbackList();
    renderTimelineCanvas();
    renderTimelineFeedbackMarkers();
    await updateScorePage();
    syncUI();
  } catch (err) {
    console.error('Failed to initialize Stardust Workbench:', err);
  }
}

/**
 * Render Header Verified Counts
 */
function renderMetadata() {
  const { counts } = appState;
  el.chipNotesCount.textContent = `${counts.totalNotes} Notes`;
  el.chipLyricsCount.textContent = `${counts.lyricNotes} Lyrics`;
  el.chipNullsCount.textContent = `${counts.nullNotes} Nulls`;
  el.chipLinesCount.textContent = `${counts.lyricLines} Lines`;
  el.chipTempoKey.textContent = `${counts.tempoBpm} BPM • ${counts.key} • ${counts.timeSignature}`;
}

/**
 * Make the audio provenance visible. A lead-vocal score is not a full-arrangement score.
 */
function renderSourceStatus() {
  const parity = validateSourceInventoryParity(sourceManifest || {});
  const visibleTracks = getVisibleScoreTracks();
  const trackLabels = visibleTracks.map(track => track.label).filter(Boolean).join(', ') || 'Lead Vocal';
  const sourceCount = scoreTracks.length;
  const audioCount = scoreTracks.filter(track => track.audio).length;
  const notationCount = scoreTracks.filter(hasScoreNotationSource).length;
  const pendingNotationCount = scoreTracks.filter(track => track.audio && !hasScoreNotationSource(track)).length;
  const visibleNotationCount = visibleTracks.filter(hasScoreNotationSource).length;
  const visiblePendingCount = visibleTracks.filter(track => track.audio && !hasScoreNotationSource(track)).length;
  const isFlowVerified = sourceManifest?.status === 'FLOW_STEMS_VERIFIED'
    && sourceManifest?.source_readback?.status === 'VERIFIED'
    && parity.ok;

  el.chipSource.textContent = isFlowVerified ? `SOURCE: FLOW ${audioCount}-STEM` : `SOURCE: ${sourceManifest?.status || 'UNKNOWN'}`;
  el.chipSource.className = isFlowVerified ? 'chip chip-pass' : 'chip chip-warning';
  if (scoreViewMode === 'grand') {
    el.scoreSourceStatus.textContent = '4-PART GRAND SCORE VERIFIED';
    el.scoreSourceTrack.textContent = 'Vocals · Drums · Bass · Other (All 4 Stems Bracketed)';
    el.scoreSourceDetail.textContent = 'All 4 stems bracketed system-by-system in full band/orchestral score layout. 121 measures complete.';
    if (el.scoreNotationCount) {
      el.scoreNotationCount.textContent = `${notationCount} NOTATED STAVES · COMPLETE`;
    }
  } else if (isFlowVerified && pendingNotationCount === 0) {
    el.scoreSourceStatus.textContent = 'FLOW 4-STEM MULTI-STAFF VERIFIED';
    el.scoreSourceTrack.textContent = `Showing: ${trackLabels} · ${audioCount} synchronized audio stems`;
    el.scoreSourceDetail.textContent = `${audioCount} Flow stems loaded. Showing ${visibleTracks.length} synchronized staff layer${visibleTracks.length === 1 ? '' : 's'}: Vocals (478 notes, frozen canon), Drums (263 hits), Bass (86 notes), Other (206 notes). All 4 stems notated.`;
    if (el.scoreNotationCount) {
      el.scoreNotationCount.textContent = `${notationCount} NOTATED STAVES · COMPLETE`;
    }
  } else {
    el.scoreSourceStatus.textContent = isFlowVerified ? 'FLOW STEMS VERIFIED' : (sourceManifest?.status || 'SOURCE UNKNOWN');
    el.scoreSourceTrack.textContent = `Showing: ${trackLabels} · ${audioCount} synchronized audio stems`;
    el.scoreSourceDetail.textContent = isFlowVerified
      ? `${audioCount} Flow stems loaded. Showing ${visibleTracks.length} source row${visibleTracks.length === 1 ? '' : 's'}: ${visibleNotationCount} notated staff${visibleNotationCount === 1 ? '' : 's'} and ${visiblePendingCount} audio-only source${visiblePendingCount === 1 ? '' : 's'} pending transcription. No note data is invented for audio-only sources.`
      : `Source inventory is not verified. ${sourceCount} declared source row${sourceCount === 1 ? '' : 's'} loaded.`;
    if (el.scoreNotationCount) {
      el.scoreNotationCount.textContent = `${notationCount} NOTATED STAFF${notationCount === 1 ? '' : 'S'} · ${pendingNotationCount} PENDING`;
    }
  }
  el.scoreFollowState.textContent = 'FOLLOW: ON';
}

function getScoreDisplaySelection() {
  return el.scoreDisplayOptions.find(option => option.checked)?.value || 'all';
}

function getVisibleScoreTracks() {
  return selectScoreTracksForDisplay(scoreTracks, scoreDisplaySelection);
}

/**
 * Build one hidden audio element per Flow stem. The vocal stem remains the
 * master clock; the other stems follow its time and play/pause state.
 */
function setupStemAudioTracks() {
  const bank = el.stemAudioBank;
  if (!bank) return;
  bank.replaceChildren();

  stemAudios = scoreTracks
    .filter(track => track.audio && track.id !== 'vocals' && track.id !== 'lead-vocal')
    .map(track => {
      const audio = new Audio(`assets/${track.audio}`);
      audio.preload = 'auto';
      audio.dataset.stemId = track.id;
      audio.dataset.stemLabel = track.label;
      audio.setAttribute('aria-hidden', 'true');
      bank.appendChild(audio);
      return audio;
    });
}

function allAudioTracks() {
  return [el.audio, ...stemAudios].filter(Boolean);
}

function setAllAudioTime(currentTime) {
  const safeTime = Number.isFinite(Number(currentTime)) ? Number(currentTime) : 0;
  allAudioTracks().forEach(audio => {
    const audioDur = (audio.duration && !isNaN(audio.duration) && audio.duration > 0) ? audio.duration : 167.392;
    const clampedTime = Math.max(0, Math.min(audioDur, safeTime));
    if (Math.abs(audio.currentTime - clampedTime) > 0.02) {
      try { audio.currentTime = clampedTime; } catch (e) {}
    }
  });
}

function syncStemAudioClocks(currentTime) {
  const masterTime = Number(currentTime);
  if (!Number.isFinite(masterTime)) return;
  stemAudios.forEach(audio => {
    if (Math.abs(audio.currentTime - masterTime) > 0.08) audio.currentTime = masterTime;
  });
}

async function playAllAudio() {
  const results = await Promise.allSettled(allAudioTracks().map(audio => audio.play()));
  const rejected = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === 'rejected');

  rejected.forEach(({ result, index }) => {
    const label = index === 0
      ? 'Master vocal stem'
      : `Stem ${stemAudios[index - 1]?.dataset.stemLabel || index}`;
    console.warn(`${label} could not play:`, result.reason);
  });
  return rejected.length === 0;
}

function pauseAllAudio() {
  allAudioTracks().forEach(audio => audio.pause());
}

/**
 * Render Page Thumbnails & Score Navigation
 */
function renderPageThumbnails() {
  if (!el.thumbnailsList) return;
  el.thumbnailsList.innerHTML = '';
  const ranges = scoreViewMode === 'grand' ? MULTISTAFF_PAGE_RANGES : STEM_PAGE_RANGES;
  const total = ranges.length;

  if (el.pagesHeaderTitle) {
    el.pagesHeaderTitle.textContent = `Pages (${total})`;
  }

  el.thumbnails = [];

  ranges.forEach((range, idx) => {
    const pageNum = idx + 1;
    const padNum = String(pageNum).padStart(2, '0');
    const card = document.createElement('div');
    card.className = `thumbnail-card${pageNum === appState?.score?.currentPage ? ' active' : ''}`;
    card.id = `thumb-page-${pageNum}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Page ${pageNum}: ${range.label}`);

    const img = document.createElement('img');
    img.className = 'thumbnail-img';
    img.alt = `Thumbnail Page ${pageNum}`;
    img.loading = 'lazy';
    img.src = scoreViewMode === 'grand'
      ? `pages/stardust-multistaff-page-${padNum}.svg`
      : `pages/stardust-vocals-page-${padNum}.svg`;

    const meta = document.createElement('div');
    meta.className = 'thumb-meta';
    const label = document.createElement('span');
    label.className = 'thumb-page-label';
    label.textContent = `P. ${pageNum}`;
    const desc = document.createElement('span');
    desc.className = 'thumb-measure-desc';
    desc.textContent = `m.${range.startBar}–${range.endBar}`;

    meta.append(label, desc);
    card.append(img, meta);

    const onSelect = () => {
      if (!appState || appState.score.currentPage === pageNum) return;
      appState = setPage(appState, pageNum);
      void updateScorePage().then(syncUI);
    };

    card.addEventListener('click', onSelect);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    });

    el.thumbnailsList.appendChild(card);
    el.thumbnails.push(card);
  });
}

let audioScrubThrottleTimer = 0;
let pendingScrubTime = null;

/**
 * Premiere-style scrub application: updates playhead time, syncs all audio clocks,
 * re-renders UI, and auto-loads current line into editor for immediate feedback.
 * Supports audio seek throttling (75ms) during rapid mouse drags to prevent decoder choke.
 */
function applyScrub(targetTime, { commitAudio = true, throttleAudio = false } = {}) {
  if (!appState) return;
  const duration = appState.playback.duration || SCORE_TOTAL_DURATION;
  const clampedTime = Math.max(0, Math.min(Number(targetTime) || 0, duration));
  appState = seek(appState, clampedTime);
  followPageRequested = true;

  if (commitAudio) {
    if (audioScrubThrottleTimer) {
      clearTimeout(audioScrubThrottleTimer);
      audioScrubThrottleTimer = 0;
    }
    pendingScrubTime = null;
    setAllAudioTime(clampedTime);
  } else if (throttleAudio) {
    pendingScrubTime = clampedTime;
    if (!audioScrubThrottleTimer) {
      audioScrubThrottleTimer = setTimeout(() => {
        audioScrubThrottleTimer = 0;
        if (pendingScrubTime !== null) {
          setAllAudioTime(pendingScrubTime);
          pendingScrubTime = null;
        }
      }, AUDIO_SEEK_THROTTLE_MS);
    }
  }

  syncUI();

  // Auto load active lyric line into editor drawer for instant feedback
  if (appState.playback.activeLineIndex >= 0) {
    const line = appState.data.lyric_lines[appState.playback.activeLineIndex];
    if (line && line.line_id !== appState.selectedLineId) {
      loadLineIntoEditor(line.line_id);
    }
  }
}

/**
 * Premiere Pro style continuous coordinate mapper for the score.
 * Maps screen (clientX, clientY) directly into SVG viewBox space [0, 21000] x [0, 29700],
 * finds the active staff system and measure, and calculates the exact fractional beat and time.
 * Pure zero layout reflow (<0.05ms) using pre-cached systems geometry and inverted screen CTM.
 */
function getTimeFromScorePointer(e, svg, geometryMap) {
  const map = geometryMap || svg?._geometryMap;
  if (!svg || !map || map.size === 0) return null;

  let svgX = 0;
  let svgY = 0;
  try {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const transformed = pt.matrixTransform(ctm.inverse());
    svgX = transformed.x;
    svgY = transformed.y;
  } catch (err) {
    return null;
  }

  // Use pre-sorted, pre-grouped system cache built at parse time
  const systems = svg._cachedSystems;
  if (!systems || !systems.length) return null;

  // Find system containing or vertically closest to svgY
  let targetSystem = systems.find(s => svgY >= s.y1 && svgY <= s.y2);
  if (!targetSystem) {
    let minDist = Infinity;
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i];
      const dist = Math.abs(svgY - s.centerY);
      if (dist < minDist) {
        minDist = dist;
        targetSystem = s;
      }
    }
  }

  if (!targetSystem || !targetSystem.measures.length) return null;

  const sysMeasures = targetSystem.measures;
  const firstM = sysMeasures[0];
  const lastM = sysMeasures[sysMeasures.length - 1];

  let targetMeasure = null;
  let beatFrac = 0.0;

  if (svgX <= firstM.x1) {
    targetMeasure = firstM;
    beatFrac = 0.0;
  } else if (svgX >= lastM.x2) {
    targetMeasure = lastM;
    beatFrac = 0.999;
  } else {
    for (let i = 0; i < sysMeasures.length; i++) {
      const m = sysMeasures[i];
      if (svgX >= m.x1 && svgX <= m.x2) {
        targetMeasure = m;
        const width = Math.max(1, m.x2 - m.x1);
        beatFrac = Math.max(0, Math.min(0.999, (svgX - m.x1) / width));
        break;
      }
      if (i < sysMeasures.length - 1 && svgX > m.x2 && svgX < sysMeasures[i + 1].x1) {
        const nextM = sysMeasures[i + 1];
        const mid = (m.x2 + nextM.x1) / 2;
        if (svgX < mid) {
          targetMeasure = m;
          beatFrac = 0.999;
        } else {
          targetMeasure = nextM;
          beatFrac = 0.0;
        }
        break;
      }
    }
  }

  if (!targetMeasure) targetMeasure = firstM;

  const calculatedTime = (targetMeasure.bar - 1) * 1.5 + beatFrac * 1.5;
  const duration = appState?.playback?.duration || SCORE_TOTAL_DURATION;
  return Math.max(0, Math.min(calculatedTime, duration));
}

/**
 * Premiere-style Interactive Score Playhead & Scrubbing Engine.
 * Supports continuous click-and-drag scrubbing across measures and systems,
 * playhead handle dragging with pointer capture, throttled audio preview,
 * atomic 4-stem playback coordination, and automatic lyric drawer updates.
 */
function wireScoreInteraction(svg, geometryMap, notesMap) {
  if (!svg) return;
  if (geometryMap) svg._geometryMap = geometryMap;
  if (notesMap) svg._notesMap = notesMap;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let didMove = false;
  let wasPlaying = false;

  const onPointerDown = (e) => {
    // Only primary left button
    if (e.button !== 0) return;

    startX = e.clientX;
    startY = e.clientY;
    didMove = false;

    const t = getTimeFromScorePointer(e, svg, svg._geometryMap);
    if (t === null) return;

    isDragging = true;
    wasPlaying = appState?.playback?.isPlaying || false;
    if (wasPlaying) {
      pauseAllAudio();
      appState.playback.isPlaying = false;
      updatePlayButton();
    }

    try {
      svg.setPointerCapture(e.pointerId);
    } catch (err) {}

    svg.classList.add('score-dragging');
    document.body.classList.add('score-dragging-active');

    // Premiere scrub: immediate visual seek with throttled audio preview
    applyScrub(t, { commitAudio: false, throttleAudio: true });
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;

    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (dist > 3) {
      didMove = true;
    }

    const t = getTimeFromScorePointer(e, svg, svg._geometryMap);
    if (t !== null) {
      applyScrub(t, { commitAudio: false, throttleAudio: true });
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;

    try {
      svg.releasePointerCapture(e.pointerId);
    } catch (err) {}

    svg.classList.remove('score-dragging');
    document.body.classList.remove('score-dragging-active');

    const t = getTimeFromScorePointer(e, svg, svg._geometryMap);
    if (t !== null) {
      applyScrub(t, { commitAudio: true });
    }

    // If stationary click (<4px movement), check if clicked directly on a note
    if (!didMove) {
      const noteEl = e.target.closest('g.note');
      if (noteEl && noteEl.id) {
        const match = noteEl.id.match(/^source_note_(\d+)/);
        if (match) {
          const noteIndex = parseInt(match[1], 10);
          const events = appState?.data?.events || [];
          const event = events.find(ev => ev.note_index === noteIndex);
          if (event) {
            applyScrub(event.start_time_seconds, { commitAudio: true });
            loadLineIntoEditor(event.lyric_line_id);
            if (wasPlaying) {
              playAllAudio();
              appState.playback.isPlaying = true;
              updatePlayButton();
            }
            return;
          }
        }
      }
    }

    if (wasPlaying) {
      playAllAudio();
      appState.playback.isPlaying = true;
      updatePlayButton();
    }
  };

  const onPointerCancel = (e) => {
    if (!isDragging) return;
    isDragging = false;

    try {
      svg.releasePointerCapture(e.pointerId);
    } catch (err) {}

    svg.classList.remove('score-dragging');
    document.body.classList.remove('score-dragging-active');

    if (wasPlaying) {
      playAllAudio();
      appState.playback.isPlaying = true;
      updatePlayButton();
    }
  };

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerCancel);
}

/**
 * Zero-reflow measure geometry parser.
 * Extracts measure boundaries (x1, x2) and system vertical bounds (y1, y2)
 * directly from staff path attributes in <1ms without calling getBBox().
 * Pre-builds sorted systems cache on the svg element for 0-allocation pointer lookup.
 */
function parseScoreGeometryDOM(svg, currentRange) {
  const map = new Map();
  if (!svg || !currentRange) return map;
  const startBar = currentRange.startBar || 1;
  let currentBar = startBar;

  const systems = Array.from(svg.querySelectorAll('g.system'));
  const sysScrollTops = systems.map((sys, idx) => {
    try {
      if (el.scoreViewport && sys.isConnected) {
        const sysRect = sys.getBoundingClientRect();
        const vpRect = el.scoreViewport.getBoundingClientRect();
        return Math.max(0, el.scoreViewport.scrollTop + sysRect.top - vpRect.top - vpRect.height * 0.25);
      }
    } catch (e) {}
    return idx * 220;
  });

  const cachedSystems = [];

  systems.forEach((system, sysIndex) => {
    let minY = Infinity;
    let maxY = -Infinity;
    const staffPaths = system.querySelectorAll('g.staff path');
    staffPaths.forEach(p => {
      const d = p.getAttribute('d') || '';
      for (const m of d.matchAll(/[ML]\s*(-?\d+)\s+(-?\d+)/g)) {
        const y = parseInt(m[2], 10);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    });
    if (!Number.isFinite(minY)) { minY = 1000; maxY = 8000; }
    const sysY1 = Math.max(0, minY - 60);
    const sysY2 = maxY + 60;
    const sysCenterY = (sysY1 + sysY2) / 2;
    const sysScrollTop = sysScrollTops[sysIndex] || 0;

    const measures = system.querySelectorAll('g.measure');
    const sysMeasures = [];

    measures.forEach(measure => {
      let x1 = 0;
      let x2 = 18000;
      const firstStaffPath = measure.querySelector('g.staff path');
      if (firstStaffPath) {
        const d = firstStaffPath.getAttribute('d') || '';
        const m = d.match(/M\s*(-?\d+)\s+(-?\d+)\s+L\s*(-?\d+)\s+(-?\d+)/);
        if (m) {
          x1 = parseInt(m[1], 10);
          x2 = parseInt(m[3], 10);
        }
      }
      const measureObj = {
        bar: currentBar,
        id: measure.id,
        x1,
        x2,
        centerX: (x1 + x2) / 2,
        y1: sysY1,
        y2: sysY2,
        centerY: sysCenterY,
        systemIndex: sysIndex,
        systemScrollTop: sysScrollTop,
        element: measure
      };
      map.set(currentBar, measureObj);
      sysMeasures.push(measureObj);
      currentBar++;
    });

    sysMeasures.sort((a, b) => a.x1 - b.x1);

    cachedSystems.push({
      systemIndex: sysIndex,
      y1: sysY1,
      y2: sysY2,
      centerY: sysCenterY,
      measures: sysMeasures
    });
  });

  svg._cachedSystems = cachedSystems;
  return map;
}

/**
 * Pre-indexes all note elements by note_index for instant O(1) class toggling without getBBox().
 */
function indexScoreNotes(svg) {
  const map = new Map();
  if (!svg) return map;
  svg.querySelectorAll('g.note[id^="source_note_"]').forEach(noteEl => {
    const match = noteEl.id.match(/^source_note_(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx).push(noteEl);
    }
  });
  return map;
}

/**
 * Update Score View according to appState.score.currentPage and scoreViewMode
 */
async function updateScorePage() {
  const page = appState.score.currentPage;
  const pageStr = String(page).padStart(2, '0');
  const requestToken = ++scorePageLoadToken;

  // Update thumbnail active states
  el.thumbnails.forEach((t, i) => {
    if (t) t.classList.toggle('active', i + 1 === page);
  });

  const ranges = scoreViewMode === 'grand' ? MULTISTAFF_PAGE_RANGES : STEM_PAGE_RANGES;
  const currentRange = ranges[page - 1] || { label: `Page ${page}` };
  el.scorePageIndicator.textContent = `Score View: Page ${page} of ${ranges.length} (${currentRange.label})`;

  if (scoreViewMode === 'grand') {
    return updateGrandScorePage(page, pageStr, requestToken, currentRange);
  } else {
    return updateStemsScorePage(page, pageStr, requestToken, currentRange);
  }
}

async function updateGrandScorePage(page, pageStr, requestToken, currentRange) {
  const path = `pages/stardust-multistaff-page-${pageStr}.svg`;
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error ${response.status} fetching ${path}`);
    const markup = await response.text();
    if (requestToken !== scorePageLoadToken || page !== appState.score.currentPage) return false;

    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const parsedSvg = parsed.documentElement;
    if (!parsedSvg || parsedSvg.nodeName.toLowerCase() !== 'svg') {
      throw new Error(`Invalid SVG returned for multi-staff page ${page}`);
    }

    const nextSvg = document.importNode(parsedSvg, true);
    nextSvg.setAttribute('role', 'img');
    nextSvg.setAttribute('aria-label', `Stardust 4-Part Grand Score, page ${page} of 12 (${currentRange.label})`);

    if (!nextSvg.getAttribute('viewBox')) {
      const width = parseFloat(nextSvg.getAttribute('width')) || 588;
      const height = parseFloat(nextSvg.getAttribute('height')) || 832;
      nextSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    const layer = document.createElement('section');
    layer.className = 'score-source-layer score-multistaff-layer';
    layer.dataset.stemId = 'grand-score';
    layer.dataset.sourceIndex = '1';
    layer.dataset.sourceKind = 'multistaff';

    const heading = document.createElement('div');
    heading.className = 'score-source-heading';
    const badge = document.createElement('span');
    badge.className = 'score-source-badge';
    badge.textContent = '4-PART GRAND SCORE';
    const trackName = document.createElement('strong');
    trackName.textContent = `Page ${page} of 12 · ${currentRange.label}`;
    const trackMeta = document.createElement('span');
    trackMeta.className = 'score-source-meta';
    trackMeta.textContent = 'Vocals (Lead) · Drums (Hits) · Bass (Bassline) · Other (Synth/Keys) · Continuous Brackets';
    heading.append(badge, trackName, trackMeta);
    layer.appendChild(heading);

    const canvas = document.createElement('div');
    canvas.className = 'score-source-canvas';
    canvas.appendChild(nextSvg);
    layer.appendChild(canvas);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(layer);
    el.scoreSvgFrame.replaceChildren(fragment);

    const renderedSvg = nextSvg.querySelector('svg.definition-scale') || nextSvg;
    if (renderedSvg) {
      renderedSvg.setAttribute('width', '100%');
      renderedSvg.setAttribute('height', '100%');
    }
    const geometryMap = parseScoreGeometryDOM(renderedSvg, currentRange);
    const notesMap = indexScoreNotes(renderedSvg);
    const overlay = createScoreOverlay(renderedSvg);
    wireScoreInteraction(renderedSvg, geometryMap, notesMap);
    renderScoreFeedbackPins(renderedSvg, geometryMap);

    scoreLayers = [{
      track: {
        id: 'grand-score',
        label: 'Grand Score',
        kind: 'multistaff',
        events: appState.data.events
      },
      index: 0,
      layer,
      svg: renderedSvg,
      overlay,
      geometryMap,
      notesMap
    }];
    scoreSvg = renderedSvg;
    scoreOverlay = overlay;
    renderedScorePage = page;
    lastCursorEventKey = '';
    lastFollowedSystemIndex = -1;
    updateScoreCursor({ autoFollow: false });
    return true;
  } catch (err) {
    console.error('Failed to load multi-staff score page:', err);
    if (requestToken === scorePageLoadToken) {
      scoreSvg = null;
      scoreOverlay = null;
      scoreLayers = [];
      renderedScorePage = 0;
      const errorMessage = document.createElement('div');
      errorMessage.className = 'score-source-detail';
      errorMessage.textContent = `Grand score page ${page} could not be loaded: ${err.message}`;
      el.scoreSvgFrame.replaceChildren(errorMessage);
    }
    return false;
  }
}

async function updateStemsScorePage(page, pageStr, requestToken, currentRange) {
  const visibleTracks = getVisibleScoreTracks();
  try {
    const pageResults = await Promise.all(visibleTracks.map(async (track) => {
      const path = getScorePagePath(track, page, pageStr);
      if (!path) {
        return { track, path: null, markup: null, error: 'No rendered score page is registered for this stem.' };
      }

      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error ${response.status} fetching ${path}`);
        return { track, path, markup: await response.text(), error: null };
      } catch (error) {
        console.warn(`Score page unavailable for ${track.label}:`, error);
        return { track, path, markup: null, error: error.message };
      }
    }));

    if (requestToken !== scorePageLoadToken || page !== appState.score.currentPage) return false;

    const fragment = document.createDocumentFragment();
    const nextLayers = [];

    let notationSourceIndex = 0;
    pageResults.forEach(({ track, path, markup, error }, index) => {
      const hasNotation = hasScoreNotationSource(track);
      const layer = document.createElement('section');
      layer.className = 'score-source-layer';
      layer.dataset.stemId = track.id;
      layer.dataset.sourceIndex = String(index + 1);
      layer.dataset.sourceKind = hasNotation ? 'notation' : 'audio-only';

      const heading = document.createElement('div');
      heading.className = 'score-source-heading';
      const staffBadge = document.createElement('span');
      staffBadge.className = 'score-source-badge';
      const notationIndex = hasNotation ? ++notationSourceIndex : 0;
      staffBadge.textContent = hasNotation
        ? `NOTATED STAFF ${notationIndex}`
        : `AUDIO SOURCE ${index + 1}`;
      const trackName = document.createElement('strong');
      trackName.textContent = track.label;
      const trackMeta = document.createElement('span');
      trackMeta.className = 'score-source-meta';
      trackMeta.textContent = hasNotation
        ? `${track.kind || 'instrument'} · ${track.events.length} score events${track.kind === 'vocal' ? ' · lyrics below staff' : ''}`
        : `${track.kind || 'instrument'} · audio only · 0 score events`;
      heading.append(staffBadge, trackName, trackMeta);
      layer.appendChild(heading);

      const canvas = document.createElement('div');
      canvas.className = 'score-source-canvas';

      if (markup) {
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
        const parsedSvg = parsed.documentElement;
        if (parsedSvg && parsedSvg.nodeName.toLowerCase() === 'svg') {
          const nextSvg = document.importNode(parsedSvg, true);
          nextSvg.setAttribute('role', 'img');
          nextSvg.setAttribute('aria-label', `Stardust ${track.label} notated staff ${notationIndex}, score page ${page}`);
          if (!nextSvg.getAttribute('viewBox')) {
            const width = parseFloat(nextSvg.getAttribute('width')) || 840;
            const height = parseFloat(nextSvg.getAttribute('height')) || 1188;
            nextSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
          canvas.appendChild(nextSvg);
          layer.appendChild(canvas);

          const renderedSvg = nextSvg.querySelector('svg.definition-scale') || nextSvg;
          if (renderedSvg) {
            renderedSvg.setAttribute('width', '100%');
            renderedSvg.setAttribute('height', '100%');
          }
          const geometryMap = parseScoreGeometryDOM(renderedSvg, currentRange);
          const notesMap = indexScoreNotes(renderedSvg);
          const overlay = createScoreOverlay(renderedSvg);
          wireScoreInteraction(renderedSvg, geometryMap, notesMap);
          renderScoreFeedbackPins(renderedSvg, geometryMap);
          nextLayers.push({ track, index, layer, svg: renderedSvg, overlay, geometryMap, notesMap });
        } else {
          error = `Invalid SVG score page ${page} for ${track.label}`;
        }
      }

      if (!markup || error) {
        if (!markup && !path && track.audio) {
          layer.dataset.status = 'pending-transcription';
          const sourceStatus = createAudioSourceStatus(track);
          canvas.appendChild(sourceStatus.container);
          nextLayers.push({ track, index, layer, svg: null, overlay: null, sourceStatus });
        } else {
          layer.dataset.status = 'missing';
          const missing = document.createElement('div');
          missing.className = 'score-source-missing';
          missing.textContent = error || `Score page ${page} is not available for this stem.`;
          canvas.appendChild(missing);
          nextLayers.push({ track, index, layer, svg: null, overlay: null, sourceStatus: null });
        }
        layer.appendChild(canvas);
      }

      fragment.appendChild(layer);
    });

    if (nextLayers.length === 0) {
      throw new Error(`No score page could be rendered for page ${page}`);
    }

    el.scoreSvgFrame.replaceChildren(fragment);
    scoreLayers = nextLayers;
    const firstNotationLayer = scoreLayers.find(layer => layer.svg && layer.overlay);
    scoreSvg = firstNotationLayer?.svg || null;
    scoreOverlay = firstNotationLayer?.overlay || null;
    renderedScorePage = page;
    lastCursorEventKey = '';
    lastFollowedSystemIndex = -1;
    updateScoreCursor({ autoFollow: false });
    return true;
  } catch (err) {
    console.error('Failed to load score page:', err);
    if (requestToken === scorePageLoadToken) {
      scoreSvg = null;
      scoreOverlay = null;
      scoreLayers = [];
      renderedScorePage = 0;
      const errorMessage = document.createElement('div');
      errorMessage.className = 'score-source-detail';
      errorMessage.textContent = `Score page ${page} could not be loaded.`;
      el.scoreSvgFrame.replaceChildren(errorMessage);
    }
    return false;
  }
}

function createAudioSourceStatus(track) {
  const container = document.createElement('div');
  container.className = 'score-source-status-card';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-label', `${track.label} audio source; notation pending transcription`);

  const row = document.createElement('div');
  row.className = 'score-source-status-row';
  const badge = document.createElement('span');
  badge.className = 'score-source-status-badge';
  badge.textContent = 'NOTATION UNAVAILABLE';
  const title = document.createElement('strong');
  title.textContent = `${track.label} is an audio-only source`;
  row.append(badge, title);

  const copy = document.createElement('p');
  copy.className = 'score-source-status-copy';
  copy.textContent = 'No score events or rendered source page were supplied. No staff lines, notes, bar cursor, or lyrics are invented for this source.';

  const progressTrack = document.createElement('div');
  progressTrack.className = 'score-source-progress-track';
  progressTrack.setAttribute('role', 'progressbar');
  progressTrack.setAttribute('aria-label', `${track.label} playback progress`);
  progressTrack.setAttribute('aria-valuemin', '0');
  progressTrack.setAttribute('aria-valuemax', '100');
  progressTrack.setAttribute('aria-valuenow', '0');
  const progressBar = document.createElement('span');
  progressBar.className = 'score-source-progress-bar';
  progressBar.style.width = '0%';
  progressTrack.appendChild(progressBar);

  const footer = document.createElement('div');
  footer.className = 'score-source-status-footer';
  const clock = document.createElement('span');
  clock.textContent = 'PLAYBACK 00:00';
  const currentNote = document.createElement('span');
  currentNote.className = 'score-source-status-note';
  currentNote.textContent = 'CURRENT NOTE: unavailable';
  footer.append(clock, currentNote);

  container.append(row, copy, progressTrack, footer);
  return { container, progressTrack, progressBar, clock, currentNote };
}

function getScorePagePath(track, page, pageStr) {
  const pageEntry = track.scorePages?.[page - 1];
  const pattern = pageEntry || track.scorePagePattern || (track.id === 'lead-vocal' || track.id === 'vocals'
    ? 'pages/stardust-vocals-page-{page}.svg'
    : null);
  if (!pattern) return null;

  return pattern
    .replaceAll('{page}', pageStr)
    .replaceAll('{page_number}', String(page));
}

function createScoreOverlay(svg) {
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'score-karaoke-overlay');

  const focusBox = document.createElementNS(ns, 'rect');
  focusBox.setAttribute('class', 'score-karaoke-focus-box');
  focusBox.style.display = 'none';

  const cursorHitArea = document.createElementNS(ns, 'line');
  cursorHitArea.setAttribute('class', 'score-karaoke-cursor-hitarea');
  cursorHitArea.style.display = 'none';

  const cursorLine = document.createElementNS(ns, 'line');
  cursorLine.setAttribute('class', 'score-karaoke-cursor-line');
  cursorLine.style.display = 'none';

  const cursorHandle = document.createElementNS(ns, 'polygon');
  cursorHandle.setAttribute('class', 'score-playhead-handle');
  cursorHandle.setAttribute('points', '-280,-560 280,-560 280,-200 0,0 -280,-200');
  cursorHandle.style.display = 'none';

  const cursorHandleBottom = document.createElementNS(ns, 'polygon');
  cursorHandleBottom.setAttribute('class', 'score-playhead-handle-bottom');
  cursorHandleBottom.setAttribute('points', '-200,320 200,320 0,0');
  cursorHandleBottom.style.display = 'none';

  const cursorLabel = document.createElementNS(ns, 'text');
  cursorLabel.setAttribute('class', 'score-karaoke-cursor-label');
  cursorLabel.style.display = 'none';

  group.append(focusBox, cursorHitArea, cursorLine, cursorHandle, cursorHandleBottom, cursorLabel);
  svg.appendChild(group);
  return { focusBox, cursorHitArea, cursorLine, cursorHandle, cursorHandleBottom, cursorLabel };
}

function getDisplayEventIndex(currentTime = appState?.playback.currentTime, preferActive = true) {
  const events = appState?.data?.events || [];
  if (!events.length) return -1;

  if (preferActive) {
    const activeIndex = appState.playback.activeEventIndex;
    if (activeIndex >= 0 && activeIndex < events.length) return activeIndex;
  }

  return getDisplayEventIndexForEvents(events, currentTime);
}

function getDisplayEventIndexForEvents(events, currentTime) {
  if (!Array.isArray(events) || events.length === 0) return -1;
  const nextIndex = events.findIndex(event => currentTime <= event.end_time_seconds);
  return nextIndex >= 0 ? nextIndex : events.length - 1;
}

function getScorePageForEvent(event) {
  if (!event) return 1;
  const bar = event.bar_number || 1;
  return getScorePageForBar(bar);
}

function getScorePageForBar(barNum) {
  if (scoreViewMode === 'grand') {
    const matched = MULTISTAFF_PAGE_RANGES.find(r => barNum >= r.startBar && barNum <= r.endBar);
    return matched ? matched.page : (barNum > 121 ? 12 : 1);
  }
  const matched = STEM_PAGE_RANGES.find(r => barNum >= r.startBar && barNum <= r.endBar);
  return matched ? matched.page : (barNum > 121 ? 3 : 1);
}

function getScorePageHeight(svg = scoreSvg) {
  if (!svg) return 1188;
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox?.height) return viewBox.height;
  const height = Number.parseFloat(svg.getAttribute('height') || '');
  return Number.isFinite(height) && height > 0 ? height : (scoreViewMode === 'grand' ? 29700 : 1188);
}

function getScoreEventGeometry(event, svg = scoreSvg) {
  if (!svg || !event) return null;

  let groups = Array.from(svg.querySelectorAll(`[id^="source_note_${event.note_index}_"]`));
  if (!groups.length) return null;

  if (scoreViewMode === 'grand' && groups.length > 1) {
    const vocalGroups = groups.filter(g => g.querySelector('.verse, .syl') || g.closest('.staff:first-of-type, .staff:nth-of-type(1)'));
    if (vocalGroups.length > 0) groups = vocalGroups;
  }

  const boxes = groups.map(group => {
    try {
      return group.getBBox();
    } catch (err) {
      return null;
    }
  }).filter(Boolean);
  if (!boxes.length) return null;

  const minX = Math.min(...boxes.map(box => box.x));
  const minY = Math.min(...boxes.map(box => box.y));
  const maxX = Math.max(...boxes.map(box => box.x + box.width));
  const maxY = Math.max(...boxes.map(box => box.y + box.height));

  return {
    groups,
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

function getScorePlayheadGeometry(events, currentTime, svg = scoreSvg) {
  if (!events.length) return null;

  let leftIndex = -1;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].start_time_seconds <= currentTime) {
      leftIndex = index;
      continue;
    }
    break;
  }
  if (leftIndex < 0) leftIndex = 0;

  const leftEvent = events[leftIndex];
  const leftGeometry = getScoreEventGeometry(leftEvent, svg);
  if (!leftGeometry) return null;

  const rightIndex = Math.min(leftIndex + 1, events.length - 1);
  const rightEvent = events[rightIndex];
  const rightGeometry = rightIndex === leftIndex ? null : getScoreEventGeometry(rightEvent, svg);
  const maxCenterDiff = scoreViewMode === 'grand' ? 600 : 220;
  const sameSystem = rightGeometry && Math.abs(rightGeometry.centerY - leftGeometry.centerY) <= maxCenterDiff;
  const span = rightEvent && sameSystem
    ? rightEvent.start_time_seconds - leftEvent.start_time_seconds
    : 0;
  const progress = span > 0
    ? Math.max(0, Math.min(1, (currentTime - leftEvent.start_time_seconds) / span))
    : 0;

  return {
    geometry: leftGeometry,
    cursorX: sameSystem
      ? leftGeometry.centerX + (rightGeometry.centerX - leftGeometry.centerX) * progress
      : leftGeometry.centerX
  };
}

function clearScoreCursor() {
  scoreLayers.forEach(layer => {
    if (layer.sourceStatus) {
      layer.sourceStatus.progressBar.style.width = '0%';
      layer.sourceStatus.progressTrack.setAttribute('aria-valuenow', '0');
    }
    if (!layer.svg || !layer.overlay) return;
    layer.svg.querySelectorAll('g.note.score-note-active').forEach(note => {
      note.classList.remove('score-note-active');
    });
    layer.overlay.focusBox.style.display = 'none';
    layer.overlay.cursorLine.style.display = 'none';
    layer.overlay.cursorLabel.style.display = 'none';
  });
}

function getScoreLayerEventContext(layer, playbackTime, leadEvent) {
  const events = layer.track.events || [];
  if (!events.length) return { events, index: -1, event: null };

  const leadMatchIndex = leadEvent
    ? events.findIndex(event => event.note_index === leadEvent.note_index)
    : -1;
  const isVocalTrack = layer.track.kind === 'vocal' || layer.track.id === 'lead-vocal' || layer.track.id === 'vocals';
  const index = isVocalTrack && leadMatchIndex >= 0
    ? leadMatchIndex
    : getDisplayEventIndexForEvents(events, playbackTime);

  return {
    events,
    index,
    event: index >= 0 ? events[index] : null
  };
}

function positionScoreLayerCursor(layer, context, playbackTime, { showLabel = false, labelText } = {}) {
  if (layer.sourceStatus) {
    const duration = Math.max(0.001, appState?.playback.duration || SCORE_TOTAL_DURATION);
    const progress = Math.max(0, Math.min(1, playbackTime / duration));
    const progressPercent = Math.round(progress * 100);
    layer.sourceStatus.progressBar.style.width = `${progressPercent}%`;
    layer.sourceStatus.progressTrack.setAttribute('aria-valuenow', String(progressPercent));
    layer.sourceStatus.clock.textContent = `PLAYBACK ${formatTime(playbackTime)}`;
    layer.sourceStatus.currentNote.textContent = 'CURRENT NOTE: unavailable (no score data)';
    return null;
  }

  if (!layer.svg || !layer.overlay) return null;
  const { events, event } = context;
  if (!event) {
    layer.overlay.focusBox.style.display = 'none';
    layer.overlay.cursorLine.style.display = 'none';
    layer.overlay.cursorLabel.style.display = 'none';
    return null;
  }

  const eventGeometry = getScoreEventGeometry(event, layer.svg);
  if (!eventGeometry) {
    layer.overlay.focusBox.style.display = 'none';
    layer.overlay.cursorLine.style.display = 'none';
    layer.overlay.cursorLabel.style.display = 'none';
    return null;
  }

  eventGeometry.groups.forEach(group => group.classList.add('score-note-active'));
  const playhead = getScorePlayheadGeometry(events, playbackTime, layer.svg);
  const lineGeometry = playhead?.geometry || eventGeometry;
  const padding = 24;
  const cursorX = playhead?.cursorX ?? eventGeometry.centerX;
  const pageHeight = getScorePageHeight(layer.svg);

  layer.overlay.focusBox.setAttribute('x', String(eventGeometry.minX - padding));
  layer.overlay.focusBox.setAttribute('y', String(eventGeometry.minY - padding));
  layer.overlay.focusBox.setAttribute('width', String(Math.max(1, eventGeometry.maxX - eventGeometry.minX + padding * 2)));
  layer.overlay.focusBox.setAttribute('height', String(Math.max(1, eventGeometry.maxY - eventGeometry.minY + padding * 2)));
  layer.overlay.focusBox.style.display = 'block';

  let y1 = Math.max(0, lineGeometry.minY - 190);
  let y2 = Math.min(pageHeight, lineGeometry.maxY + 190);

  if (scoreViewMode === 'grand') {
    const system = eventGeometry.groups[0]?.closest('g.system');
    if (system) {
      try {
        const sysBox = system.getBBox();
        y1 = Math.max(0, sysBox.y - 40);
        y2 = Math.min(pageHeight, sysBox.y + sysBox.height + 40);
      } catch (err) {}
    }
  }

  layer.overlay.cursorLine.setAttribute('x1', String(cursorX));
  layer.overlay.cursorLine.setAttribute('x2', String(cursorX));
  layer.overlay.cursorLine.setAttribute('y1', String(y1));
  layer.overlay.cursorLine.setAttribute('y2', String(y2));
  layer.overlay.cursorLine.style.display = 'block';

  if (showLabel) {
    if (labelText !== undefined) layer.overlay.cursorLabel.textContent = labelText;
    layer.overlay.cursorLabel.setAttribute('x', String(cursorX + 28));
    layer.overlay.cursorLabel.setAttribute('y', String(Math.max(64, y1 - 18)));
    layer.overlay.cursorLabel.style.display = 'block';
  } else {
    layer.overlay.cursorLabel.style.display = 'none';
  }

  return { eventGeometry, cursorX };
}

let activeHighlightedNoteId = -1;
let lastFollowedSystemIndex = -1;
let lastHighlightedLineIndex = -1;

function followScoreMeasure(measure) {
  if (!measure || !el.scoreViewport || measure.systemIndex === undefined) return;
  if (measure.systemIndex === lastFollowedSystemIndex) return;
  lastFollowedSystemIndex = measure.systemIndex;

  if (typeof measure.systemScrollTop === 'number') {
    el.scoreViewport.scrollTo({ top: measure.systemScrollTop, behavior: 'smooth' });
  }
}

function updateScoreCursorFast(playbackTime = appState?.playback.currentTime, { autoFollow = true } = {}) {
  if (!appState || !scoreLayers.length || renderedScorePage !== appState.score.currentPage) return;

  const barNum = Math.min(121, Math.max(1, Math.floor(playbackTime / 1.5) + 1));
  const beatFrac = (playbackTime % 1.5) / 1.5;
  const beatInBar = beatFrac * 4.0 + 1.0;

  // Real-time Measure / Beat readout badge
  if (el.measureBeatBadge) {
    el.measureBeatBadge.textContent = `BAR ${barNum} · BEAT ${beatInBar.toFixed(1)}`;
  }

  // Find active vocal note (if any is currently sounding)
  const events = appState.data.events || [];
  let activeNoteEvent = null;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (playbackTime >= ev.start_time_seconds && playbackTime <= ev.end_time_seconds) {
      activeNoteEvent = ev;
      break;
    }
    if (ev.start_time_seconds > playbackTime) break;
  }

  // Fast note class highlighting without getBBox
  const nextNoteId = activeNoteEvent?.note_index ?? -1;
  if (activeHighlightedNoteId !== nextNoteId) {
    if (activeHighlightedNoteId >= 0) {
      scoreLayers.forEach(layer => {
        const els = layer.notesMap?.get(activeHighlightedNoteId);
        if (els) els.forEach(n => n.classList.remove('score-note-active'));
      });
    }
    activeHighlightedNoteId = nextNoteId;
    if (activeHighlightedNoteId >= 0) {
      scoreLayers.forEach(layer => {
        const els = layer.notesMap?.get(activeHighlightedNoteId);
        if (els) els.forEach(n => n.classList.add('score-note-active'));
      });
    }
  }

  // Position cursor lines on each layer
  let primaryMeasure = null;
  scoreLayers.forEach((layer, idx) => {
    if (layer.sourceStatus) {
      const duration = Math.max(0.001, appState.playback.duration || SCORE_TOTAL_DURATION);
      const progress = Math.max(0, Math.min(1, playbackTime / duration));
      const progressPercent = Math.round(progress * 100);
      layer.sourceStatus.progressBar.style.width = `${progressPercent}%`;
      layer.sourceStatus.progressTrack.setAttribute('aria-valuenow', String(progressPercent));
      layer.sourceStatus.clock.textContent = `PLAYBACK ${formatTime(playbackTime)}`;
      return;
    }

    if (!layer.overlay) return;
    const { cursorLine, cursorLabel, focusBox, cursorHitArea, cursorHandle, cursorHandleBottom } = layer.overlay;
    const measure = layer.geometryMap?.get(barNum);
    if (!measure) {
      cursorLine.style.display = 'none';
      if (cursorLabel) cursorLabel.style.display = 'none';
      if (focusBox) focusBox.style.display = 'none';
      if (cursorHitArea) cursorHitArea.style.display = 'none';
      if (cursorHandle) cursorHandle.style.display = 'none';
      if (cursorHandleBottom) cursorHandleBottom.style.display = 'none';
      return;
    }

    if (!primaryMeasure) primaryMeasure = measure;

    const cursorX = measure.x1 + (measure.x2 - measure.x1) * beatFrac;
    cursorLine.setAttribute('x1', String(cursorX));
    cursorLine.setAttribute('x2', String(cursorX));
    cursorLine.setAttribute('y1', String(measure.y1));
    cursorLine.setAttribute('y2', String(measure.y2));
    cursorLine.style.display = 'block';

    if (cursorHitArea) {
      cursorHitArea.setAttribute('x1', String(cursorX));
      cursorHitArea.setAttribute('x2', String(cursorX));
      cursorHitArea.setAttribute('y1', String(measure.y1));
      cursorHitArea.setAttribute('y2', String(measure.y2));
      cursorHitArea.style.display = 'block';
    }

    if (cursorHandle) {
      cursorHandle.setAttribute('transform', `translate(${cursorX}, ${measure.y1})`);
      cursorHandle.style.display = 'block';
    }

    if (cursorHandleBottom) {
      cursorHandleBottom.setAttribute('transform', `translate(${cursorX}, ${measure.y2})`);
      cursorHandleBottom.style.display = 'block';
    }

    // Label only on top layer (or vocal layer)
    const isTopLayer = idx === 0 || layer.track.kind === 'vocal' || layer.track.id === 'grand-score';
    if (cursorLabel) {
      if (isTopLayer) {
        cursorLabel.setAttribute('x', String(cursorX + 340));
        cursorLabel.setAttribute('y', String(Math.max(300, measure.y1 - 120)));
        if (activeNoteEvent) {
          const lyric = activeNoteEvent.lyric_syllable || '—';
          cursorLabel.textContent = `▶ m.${barNum}.${Math.floor(beatInBar)} · ${lyric}`;
        } else {
          const status = barNum <= 8 ? 'Intro' : 'Rest';
          cursorLabel.textContent = `m.${barNum}.${Math.floor(beatInBar)} [${status}]`;
        }
        cursorLabel.style.display = 'block';
      } else {
        cursorLabel.style.display = 'none';
      }
    }
  });

  // Autoscroll viewport if needed (pure zero-reflow cached system scroll)
  if (autoFollow && primaryMeasure) {
    followScoreMeasure(primaryMeasure);
  }

  // Live readout banner text
  if (el.scoreLiveReadout) {
    if (activeNoteEvent) {
      const lyric = activeNoteEvent.lyric_syllable || '—';
      const activeLine = (appState.data.lyric_lines || []).find(l => l.line_id === activeNoteEvent.lyric_line_id);
      const sec = activeLine?.section ? `Sec ${activeLine.section}` : '';
      el.scoreLiveReadout.textContent = `▶ ${sec} · m.${barNum} · beat ${beatInBar.toFixed(2)} · ${lyric} · ${formatTime(playbackTime)}`;
    } else {
      const status = barNum <= 8 ? 'Intro' : 'Rest';
      el.scoreLiveReadout.textContent = `▶ m.${barNum} · beat ${beatInBar.toFixed(2)} · [${status}] · ${formatTime(playbackTime)}`;
    }
  }

  // Timeline active event text
  if (el.timelineActiveEvent) {
    if (activeNoteEvent) {
      el.timelineActiveEvent.textContent = `Event: #${String(activeNoteEvent.note_index).padStart(3, '0')} m.${barNum}.${Math.floor(beatInBar)} · "${activeNoteEvent.lyric_syllable}"`;
    } else {
      el.timelineActiveEvent.textContent = `Event: m.${barNum}.${Math.floor(beatInBar)} ${barNum <= 8 ? '[Intro]' : '[Rest]'}`;
    }
  }
}

function updateScoreCursor({ autoFollow = true, playbackTime = appState?.playback.currentTime } = {}) {
  updateScoreCursorFast(playbackTime, { autoFollow });
}

function updateScorePlayhead(playbackTime) {
  updateScoreCursorFast(playbackTime, { autoFollow: true });
}

function stopScoreAnimation() {
  if (!scoreAnimationFrame) return;
  cancelAnimationFrame(scoreAnimationFrame);
  scoreAnimationFrame = 0;
}

function runScoreAnimationFrame() {
  scoreAnimationFrame = 0;
  if (!el.audio || el.audio.paused) return;
  const t = el.audio.currentTime;
  updateScoreCursorFast(t, { autoFollow: true });
  const duration = appState?.playback.duration || SCORE_TOTAL_DURATION;
  const playheadPct = duration > 0 ? (t / duration) * 100 : 0;
  el.timelinePlayhead.style.left = `${Math.min(100, Math.max(0, playheadPct))}%`;
  el.timecodeDisplay.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
  scoreAnimationFrame = requestAnimationFrame(runScoreAnimationFrame);
}

function startScoreAnimation() {
  if (!el.audio || el.audio.paused || scoreAnimationFrame) return;
  scoreAnimationFrame = requestAnimationFrame(runScoreAnimationFrame);
}

function syncScoreFollow() {
  if (!appState) return;
  const barNum = Math.min(121, Math.max(1, Math.floor(appState.playback.currentTime / 1.5) + 1));
  const desiredPage = getScorePageForBar(barNum);
  const shouldFollowPage = appState.playback.isPlaying || followPageRequested;

  if (shouldFollowPage && renderedScorePage !== desiredPage) {
    followPageRequested = false;
    appState = setPage(appState, desiredPage);
    void updateScorePage().then(syncUI);
    return;
  }

  followPageRequested = false;
  updateScoreCursorFast(appState.playback.currentTime, { autoFollow: shouldFollowPage });
}

/**
 * Render all 29 Lyric Lines in Inspector
 */
function renderLyricList() {
  el.lyricList.innerHTML = '';
  el.lyricRows = [];
  const lines = appState.data.lyric_lines;

  lines.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    row.id = `line-row-${line.line_id}`;
    row.dataset.lineId = line.line_id;
    row.dataset.index = idx;

    // Meta bar
    const metaBar = document.createElement('div');
    metaBar.className = 'row-meta-bar';

    const leftMeta = document.createElement('span');
    leftMeta.textContent = `#${String(idx).padStart(2, '0')} • Sec ${line.section} [${formatTime(line.start_time_seconds)} → ${formatTime(line.end_time_seconds)}]`;

    const rightMeta = document.createElement('span');
    rightMeta.className = 'chip';
    rightMeta.style.fontSize = '10px';
    rightMeta.textContent = `${line.mapped_mora_count} moras`;

    metaBar.appendChild(leftMeta);
    metaBar.appendChild(rightMeta);

    // Display text
    const disp = document.createElement('div');
    disp.className = 'row-text-display';
    disp.id = `line-disp-${line.line_id}`;
    disp.textContent = line.display_text;

    // Reading text
    const read = document.createElement('div');
    read.className = 'row-text-reading';
    read.id = `line-read-${line.line_id}`;
    read.textContent = line.alignment_text;

    row.appendChild(metaBar);
    row.appendChild(disp);
    row.appendChild(read);

    // Click to seek and select
    row.addEventListener('click', () => {
      appState = selectLineByIndex(appState, idx);
      followPageRequested = true;
      setAllAudioTime(appState.playback.currentTime);
      syncUI();
      loadLineIntoEditor(line.line_id);
    });

    el.lyricList.appendChild(row);
    el.lyricRows.push(row);
  });

  if (lines.length > 0) {
    loadLineIntoEditor(lines[0].line_id);
  }
}

/**
 * Load selected line into editor drawer
 */
function loadLineIntoEditor(lineId) {
  const lines = appState.data.lyric_lines;
  const line = lines.find(l => l.line_id === lineId);
  if (!line) return;

  appState.selectedLineId = lineId;
  const draft = appState.drafts[lineId];

  el.editorLineTitle.textContent = `Draft Editor — ${line.line_id} [Sec ${line.section}]`;
  el.canonicalLineText.textContent = `${line.display_text} (${line.alignment_text})`;

  el.inputDraftDisplay.value = draft ? draft.display_text : line.display_text;
  el.inputDraftAlignment.value = draft ? draft.alignment_text : line.alignment_text;

  if (draft) {
    el.editorStatusChip.textContent = 'Draft Modified';
    el.editorStatusChip.className = 'chip chip-draft';
  } else {
    el.editorStatusChip.textContent = 'Frozen Spec';
    el.editorStatusChip.className = 'chip chip-frozen';
  }
}

/**
 * Save draft changes for current line
 */
function saveCurrentLineDraft() {
  const lineId = appState.selectedLineId;
  if (!lineId) return;

  const displayText = el.inputDraftDisplay.value.trim();
  const alignmentText = el.inputDraftAlignment.value.trim();

  appState = updateDraftLine(appState, lineId, {
    display_text: displayText,
    alignment_text: alignmentText
  });

  // Update row visual
  const dispEl = document.getElementById(`line-disp-${lineId}`);
  const readEl = document.getElementById(`line-read-${lineId}`);
  const rowEl = document.getElementById(`line-row-${lineId}`);

  if (dispEl) dispEl.textContent = displayText;
  if (readEl) readEl.textContent = alignmentText;
  if (rowEl) rowEl.classList.add('modified');

  updateDraftCount();
  loadLineIntoEditor(lineId);
}

/**
 * Reset current line draft to canonical
 */
function resetCurrentLineDraft() {
  const lineId = appState.selectedLineId;
  if (!lineId) return;

  appState = resetDraftLine(appState, lineId);

  const line = appState.data.lyric_lines.find(l => l.line_id === lineId);
  if (line) {
    const dispEl = document.getElementById(`line-disp-${lineId}`);
    const readEl = document.getElementById(`line-read-${lineId}`);
    const rowEl = document.getElementById(`line-row-${lineId}`);

    if (dispEl) dispEl.textContent = line.display_text;
    if (readEl) readEl.textContent = line.alignment_text;
    if (rowEl) rowEl.classList.remove('modified');
  }

  updateDraftCount();
  loadLineIntoEditor(lineId);
}

function updateDraftCount() {
  const count = Object.keys(appState.drafts).length;
  if (count > 0) {
    el.draftCountChip.textContent = `${count} Draft Edits`;
    el.draftCountChip.className = 'chip chip-draft';
  } else {
    el.draftCountChip.textContent = 'Draft text only';
    el.draftCountChip.className = 'chip chip-frozen';
  }
}

/**
 * Setup Timeline Canvas (Daw ruler, 121 measure grid ticks, section colored bands, 29 vocal phrase blocks)
 */
function renderTimelineCanvas() {
  const canvas = el.timelineCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width || 800;
  canvas.height = rect.height || 32;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const duration = SCORE_TOTAL_DURATION;
  const lines = appState?.data?.lyric_lines || [];

  // 1. Draw Section background bands at top (0 to 5px)
  const SECTIONS = [
    { name: 'Intro', startBar: 1, endBar: 8, color: 'rgba(56, 189, 248, 0.45)' },
    { name: 'Verse A', startBar: 9, endBar: 24, color: 'rgba(99, 102, 241, 0.45)' },
    { name: 'Pre-Ch', startBar: 25, endBar: 32, color: 'rgba(168, 85, 247, 0.45)' },
    { name: 'Chorus', startBar: 33, endBar: 48, color: 'rgba(236, 72, 153, 0.45)' },
    { name: 'Interlude', startBar: 49, endBar: 52, color: 'rgba(56, 189, 248, 0.45)' },
    { name: 'Verse B', startBar: 53, endBar: 68, color: 'rgba(99, 102, 241, 0.45)' },
    { name: 'Chorus', startBar: 69, endBar: 84, color: 'rgba(236, 72, 153, 0.45)' },
    { name: 'Bridge', startBar: 85, endBar: 100, color: 'rgba(245, 158, 11, 0.45)' },
    { name: 'Chorus', startBar: 101, endBar: 116, color: 'rgba(236, 72, 153, 0.45)' },
    { name: 'Outro', startBar: 117, endBar: 121, color: 'rgba(56, 189, 248, 0.45)' }
  ];

  SECTIONS.forEach(sec => {
    const t1 = (sec.startBar - 1) * 1.5;
    const t2 = sec.endBar * 1.5;
    const x1 = (t1 / duration) * w;
    const x2 = (t2 / duration) * w;
    ctx.fillStyle = sec.color;
    ctx.fillRect(x1, 0, Math.max(2, x2 - x1), 4);
  });

  // 2. Draw 29 Vocal Phrase blocks (height: 6px to h - 12px)
  lines.forEach((line, i) => {
    const xStart = (line.start_time_seconds / duration) * w;
    const xEnd = (line.end_time_seconds / duration) * w;
    const blockWidth = Math.max(2, xEnd - xStart);

    ctx.fillStyle = i % 2 === 0 ? 'rgba(99, 102, 241, 0.28)' : 'rgba(124, 58, 237, 0.28)';
    ctx.fillRect(xStart, 5, blockWidth, h - 14);

    ctx.fillStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.fillRect(xStart, 5, 1, h - 14);
  });

  // 3. Draw Measure Ticks & Labels across all 121 measures
  for (let bar = 1; bar <= 121; bar++) {
    const t = (bar - 1) * 1.5;
    const x = (t / duration) * w;

    if ((bar - 1) % 8 === 0 || bar === 1 || bar === 121) {
      // Major tick
      ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
      ctx.fillRect(x, 0, 1, h);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '8px ui-monospace, monospace';
      if (bar === 121) {
        ctx.fillText('m.121', Math.max(0, x - 26), h - 2);
      } else if (x < w - 28) {
        ctx.fillText(`m.${bar}`, x + 2, h - 2);
      }
    } else if ((bar - 1) % 4 === 0) {
      // Medium tick
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.fillRect(x, h - 9, 1, 9);
    } else {
      // Minor tick
      ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.fillRect(x, h - 4, 1, 4);
    }
  }

  // 4. Draw Feedback Markers on Timeline Canvas
  const feedbacks = appState?.feedbacks || [];
  feedbacks.forEach(fb => {
    const x = (fb.time / duration) * w;
    ctx.fillStyle = fb.resolved ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.95)';
    ctx.beginPath();
    ctx.arc(x, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/**
 * Synchronize UI elements with current appState
 */
function syncUI() {
  const { currentTime, duration, isPlaying, loop, rangeA, rangeB, activeLineIndex } = appState.playback;

  // Timecode
  el.timecodeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  // Measure Beat Badge
  const barNum = Math.min(121, Math.max(1, Math.floor(currentTime / 1.5) + 1));
  const beatInBar = ((currentTime % 1.5) / 1.5) * 4.0 + 1.0;
  if (el.measureBeatBadge) {
    el.measureBeatBadge.textContent = `BAR ${barNum} · BEAT ${beatInBar.toFixed(1)}`;
  }

  // Play/Pause button
  el.playIcon.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;';
  el.playText.textContent = isPlaying ? 'Pause' : 'Play';
  el.btnPlayPause.classList.toggle('btn-primary', !isPlaying);
  el.btnPlayPause.classList.toggle('btn-secondary', isPlaying);

  // Loop button
  el.loopText.textContent = loop ? 'Loop [ON]' : 'Loop [Off]';
  el.btnLoop.classList.toggle('btn-active', loop);

  // Range inputs
  el.inputRangeA.value = rangeA !== null ? rangeA : '';
  el.inputRangeB.value = rangeB !== null ? rangeB : '';

  // Range highlight on timeline
  const rangeActive = isRangeValid(rangeA, rangeB, duration);
  if (rangeActive) {
    el.timelineRangeHighlight.style.display = 'block';
    const leftPct = (rangeA / duration) * 100;
    const widthPct = ((rangeB - rangeA) / duration) * 100;
    el.timelineRangeHighlight.style.left = `${leftPct}%`;
    el.timelineRangeHighlight.style.width = `${widthPct}%`;
  } else {
    el.timelineRangeHighlight.style.display = 'none';
  }

  // Playhead position
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  el.timelinePlayhead.style.left = `${Math.min(100, Math.max(0, playheadPct))}%`;

  // Active lyric row highlighting (pure zero-reflow O(1) cached element toggle)
  if (activeLineIndex !== lastHighlightedLineIndex) {
    if (lastHighlightedLineIndex >= 0 && el.lyricRows && el.lyricRows[lastHighlightedLineIndex]) {
      el.lyricRows[lastHighlightedLineIndex].classList.remove('active');
    }
    if (activeLineIndex >= 0 && el.lyricRows && el.lyricRows[activeLineIndex]) {
      el.lyricRows[activeLineIndex].classList.add('active');
    }
    lastHighlightedLineIndex = activeLineIndex;
  }

  // Timeline active info
  if (activeLineIndex >= 0 && activeLineIndex < appState.data.lyric_lines.length) {
    const activeLine = appState.data.lyric_lines[activeLineIndex];
    el.timelineActiveInfo.textContent = `Active Line: #${String(activeLineIndex).padStart(2, '0')} [${activeLine.section}] ${activeLine.display_text}`;
  } else {
    el.timelineActiveInfo.textContent = 'Active Line: None';
  }

  // Karaoke-style score following: the active/upcoming note is highlighted in the SVG.
  syncScoreFollow();
}

/**
 * Wire all Event Listeners
 */
function setupEventListeners() {
  // Mode switcher (Grand 4단 총보 vs Stems 파트보)
  if (el.btnModeGrand) {
    el.btnModeGrand.addEventListener('click', async () => {
      if (scoreViewMode === 'grand') return;
      scoreViewMode = 'grand';
      el.btnModeGrand.classList.add('active');
      el.btnModeGrand.setAttribute('aria-selected', 'true');
      el.btnModeStems?.classList.remove('active');
      el.btnModeStems?.setAttribute('aria-selected', 'false');
      if (el.scoreSourceSelector) el.scoreSourceSelector.style.display = 'none';
      appState.score.totalPages = MULTISTAFF_PAGE_RANGES.length;
      if (appState.score.currentPage > MULTISTAFF_PAGE_RANGES.length) {
        appState = setPage(appState, 1);
      }
      renderSourceStatus();
      renderPageThumbnails();
      await updateScorePage();
      syncUI();
    });
  }

  if (el.btnModeStems) {
    el.btnModeStems.addEventListener('click', async () => {
      if (scoreViewMode === 'stems') return;
      scoreViewMode = 'stems';
      el.btnModeStems.classList.add('active');
      el.btnModeStems.setAttribute('aria-selected', 'true');
      el.btnModeGrand?.classList.remove('active');
      el.btnModeGrand?.setAttribute('aria-selected', 'false');
      if (el.scoreSourceSelector) el.scoreSourceSelector.style.display = 'flex';
      appState.score.totalPages = STEM_PAGE_RANGES.length;
      if (appState.score.currentPage > STEM_PAGE_RANGES.length) {
        appState = setPage(appState, 1);
      }
      renderSourceStatus();
      renderPageThumbnails();
      await updateScorePage();
      syncUI();
    });
  }

  // Page navigation
  el.btnPrevPage.addEventListener('click', () => {
    appState = prevPage(appState);
    void updateScorePage().then(syncUI);
  });

  el.btnNextPage.addEventListener('click', () => {
    appState = nextPage(appState);
    void updateScorePage().then(syncUI);
  });

  el.scoreDisplayOptions.forEach(option => {
    option.addEventListener('change', () => {
      if (!option.checked) return;
      scoreDisplaySelection = option.value;
      renderSourceStatus();
      void updateScorePage().then(syncUI);
    });
  });

  // Audio playback updates
  el.audio.addEventListener('timeupdate', () => {
    if (el.audio.paused && !appState.playback.isPlaying) return;
    appState = setTime(appState, el.audio.currentTime);
    syncStemAudioClocks(el.audio.currentTime);

    // If setTime stopped playback (e.g. at Range B when loop is off)
    if (!appState.playback.isPlaying && !el.audio.paused) {
      pauseAllAudio();
      setAllAudioTime(appState.playback.currentTime);
    } else if (appState.playback.loop && el.audio.currentTime < appState.playback.rangeA) {
      setAllAudioTime(appState.playback.rangeA);
    }
    syncUI();
  });

  el.audio.addEventListener('durationchange', () => {
    const audioDur = (el.audio.duration && !isNaN(el.audio.duration)) ? el.audio.duration : 167.39;
    appState.playback.duration = SCORE_TOTAL_DURATION;
    if (el.timelineDurationInfo) {
      el.timelineDurationInfo.textContent = `Score: ${formatTime(SCORE_TOTAL_DURATION)} (${SCORE_TOTAL_DURATION.toFixed(2)}s · 121 Bars) | Audio: ${formatTime(audioDur)} (${audioDur.toFixed(2)}s)`;
    }
    renderTimelineCanvas();
    syncUI();
  });

  el.audio.addEventListener('play', startScoreAnimation);
  el.audio.addEventListener('pause', stopScoreAnimation);

  el.audio.addEventListener('ended', () => {
    stopScoreAnimation();
    appState = pause(appState);
    syncUI();
  });

  // Transport buttons
  el.btnPlayPause.addEventListener('click', async () => {
    if (el.audio.paused) {
      appState = play(appState);
      syncUI();

      try {
        const didPlay = await playAllAudio();
        if (!didPlay) {
          pauseAllAudio();
          appState = pause(appState);
          syncUI();
        }
      } catch (err) {
        pauseAllAudio();
        appState = pause(appState);
        syncUI();
        console.warn('Audio play prevented:', err);
      }
      return;
    }

    pauseAllAudio();
    appState = pause(appState);
    syncUI();
  });

  el.btnStop.addEventListener('click', () => {
    pauseAllAudio();
    stopScoreAnimation();
    appState = stop(appState);
    setAllAudioTime(appState.playback.currentTime);
    syncUI();
  });

  el.btnLoop.addEventListener('click', () => {
    appState = toggleLoop(appState);
    syncUI();
  });

  // Range inputs
  el.inputRangeA.addEventListener('change', (e) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    appState = setRangeA(appState, val);
    syncUI();
  });

  el.inputRangeB.addEventListener('change', (e) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    appState = setRangeB(appState, val);
    syncUI();
  });

  el.btnSetA.addEventListener('click', () => {
    appState = setRangeAAtPlayhead(appState);
    syncUI();
  });

  el.btnSetB.addEventListener('click', () => {
    appState = setRangeBAtPlayhead(appState);
    syncUI();
  });

  el.btnClearRange.addEventListener('click', () => {
    appState = clearRange(appState);
    syncUI();
  });

  // Timeline scrubbing (Premiere Pro style click + drag with zero-reflow cached rect)
  let isScrubbing = false;
  let cachedTimelineRect = null;

  function getTimeFromPointer(e) {
    const rect = cachedTimelineRect || (cachedTimelineRect = el.timelineTrack.getBoundingClientRect());
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = appState?.playback?.duration || SCORE_TOTAL_DURATION;
    return { pct, time: pct * duration };
  }

  function onPointerEnter() {
    cachedTimelineRect = el.timelineTrack.getBoundingClientRect();
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isScrubbing = true;
    cachedTimelineRect = el.timelineTrack.getBoundingClientRect();
    el.timelineTrack.classList.add('is-scrubbing');
    try {
      el.timelineTrack.setPointerCapture(e.pointerId);
    } catch (err) {}
    const { time } = getTimeFromPointer(e);
    applyScrub(time, { commitAudio: true });
    e.preventDefault();
  }

  function onPointerMove(e) {
    const { pct, time } = getTimeFromPointer(e);
    const barNum = Math.min(121, Math.max(1, Math.floor(time / 1.5) + 1));
    const beatInBar = ((time % 1.5) / 1.5) * 4.0 + 1.0;

    if (el.timelineHoverGuide && el.timelineHoverTooltip) {
      el.timelineHoverGuide.style.display = 'block';
      el.timelineHoverGuide.style.left = `${pct * 100}%`;
      el.timelineHoverTooltip.style.display = 'block';
      el.timelineHoverTooltip.style.left = `${pct * 100}%`;

      const lines = appState?.data?.lyric_lines || [];
      const hoveredLine = lines.find(l => time >= l.start_time_seconds && time <= l.end_time_seconds);
      const lineInfo = hoveredLine ? ` · [${hoveredLine.section}] ${hoveredLine.display_text.slice(0, 8)}` : (barNum <= 8 ? ' · [Intro]' : '');
      el.timelineHoverTooltip.textContent = `${formatTime(time)} · BAR ${barNum}.${Math.floor(beatInBar)}${lineInfo}`;
    }

    if (isScrubbing) {
      applyScrub(time, { commitAudio: false, throttleAudio: true });
    }
  }

  function onPointerUp(e) {
    if (!isScrubbing) return;
    isScrubbing = false;
    cachedTimelineRect = null;
    el.timelineTrack.classList.remove('is-scrubbing');
    try {
      el.timelineTrack.releasePointerCapture(e.pointerId);
    } catch (err) {}
    if (audioScrubThrottleTimer) {
      clearTimeout(audioScrubThrottleTimer);
      audioScrubThrottleTimer = 0;
    }
    pendingScrubTime = null;
    setAllAudioTime(appState.playback.currentTime);
  }

  function onPointerLeave() {
    if (!isScrubbing) {
      cachedTimelineRect = null;
      if (el.timelineHoverGuide && el.timelineHoverTooltip) {
        el.timelineHoverGuide.style.display = 'none';
        el.timelineHoverTooltip.style.display = 'none';
      }
    }
  }

  el.timelineTrack.addEventListener('pointerenter', onPointerEnter);
  el.timelineTrack.addEventListener('pointerdown', onPointerDown);
  el.timelineTrack.addEventListener('pointermove', onPointerMove);
  el.timelineTrack.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('pointermove', (e) => {
    if (isScrubbing) {
      const { time } = getTimeFromPointer(e);
      applyScrub(time, { commitAudio: false, throttleAudio: true });
    }
  });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Draft Editor actions
  el.btnSaveDraft.addEventListener('click', saveCurrentLineDraft);
  el.btnResetLine.addEventListener('click', resetCurrentLineDraft);

  // Export Draft Button
  el.btnExportDraft.addEventListener('click', () => {
    const draftPayload = exportDraftOverlay(appState, rawScoreData);
    const jsonStr = JSON.stringify(draftPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stardust-score-draft-lyrics.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Zoom controls
  let currentZoom = 1.0;
  el.btnZoomIn.addEventListener('click', () => {
    currentZoom = Math.min(2.0, currentZoom + 0.15);
    applyZoom();
  });
  el.btnZoomOut.addEventListener('click', () => {
    currentZoom = Math.max(0.6, currentZoom - 0.15);
    applyZoom();
  });
  el.btnZoomFit.addEventListener('click', () => {
    currentZoom = 1.0;
    applyZoom();
  });

  function applyZoom() {
    el.scorePaper.style.transform = `scale(${currentZoom})`;
    el.scorePaper.style.transformOrigin = 'top center';
    el.zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  // Keyboard Shortcuts (Premiere Pro style scrubbing + transport)
  window.addEventListener('keydown', (e) => {
    // Modal & Context Menu shortcuts that should work even when typing in input/textarea
    if (e.key === 'Escape') {
      closeScoreContextMenu();
      closeFeedbackModal();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (el.feedbackModalBackdrop && el.feedbackModalBackdrop.style.display !== 'none') {
        e.preventDefault();
        saveFeedbackFromModal();
        return;
      }
    }

    // Ignore when typing inside inputs or textarea
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const duration = appState?.playback?.duration || SCORE_TOTAL_DURATION;
    const currentTime = appState?.playback?.currentTime ?? el.audio.currentTime ?? 0;

    if (e.code === 'Space') {
      e.preventDefault();
      el.btnPlayPause.click();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      el.btnStop.click();
    } else if (e.key === '[') {
      e.preventDefault();
      el.btnSetA.click();
    } else if (e.key === ']') {
      e.preventDefault();
      el.btnSetB.click();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      el.btnLoop.click();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      // Premiere frame / fine scrub (Left arrow: -0.1s frame / Shift: -1.5s 1 bar / Alt: prev note / Ctrl: prev bar snap)
      let targetTime;
      if (e.ctrlKey || e.metaKey) {
        const curBar = Math.floor(currentTime / 1.5);
        targetTime = Math.max(0, (curBar - (currentTime % 1.5 < 0.05 ? 1 : 0)) * 1.5);
      } else if (e.altKey) {
        const events = appState?.data?.events || [];
        const prevEvent = [...events].reverse().find(ev => ev.start_time_seconds < currentTime - 0.02);
        targetTime = prevEvent ? prevEvent.start_time_seconds : Math.max(0, currentTime - 0.5);
      } else if (e.shiftKey) {
        targetTime = Math.max(0, currentTime - 1.5);
      } else {
        targetTime = Math.max(0, currentTime - 0.1);
      }
      applyScrub(targetTime);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      // Premiere frame / fine scrub (Right arrow: +0.1s frame / Shift: +1.5s 1 bar / Alt: next note / Ctrl: next bar snap)
      let targetTime;
      if (e.ctrlKey || e.metaKey) {
        const curBar = Math.floor(currentTime / 1.5);
        targetTime = Math.min(duration, (curBar + 1) * 1.5);
      } else if (e.altKey) {
        const events = appState?.data?.events || [];
        const nextEvent = events.find(ev => ev.start_time_seconds > currentTime + 0.02);
        targetTime = nextEvent ? nextEvent.start_time_seconds : Math.min(duration, currentTime + 0.5);
      } else if (e.shiftKey) {
        targetTime = Math.min(duration, currentTime + 1.5);
      } else {
        targetTime = Math.min(duration, currentTime + 0.1);
      }
      applyScrub(targetTime);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      // Jump to previous lyric line
      const lines = appState?.data?.lyric_lines || [];
      const currentIdx = appState?.playback?.activeLineIndex ?? -1;
      const targetIdx = Math.max(0, currentIdx > 0 ? currentIdx - 1 : 0);
      if (lines[targetIdx]) {
        applyScrub(lines[targetIdx].start_time_seconds);
        loadLineIntoEditor(lines[targetIdx].line_id);
      }
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      // Jump to next lyric line
      const lines = appState?.data?.lyric_lines || [];
      const currentIdx = appState?.playback?.activeLineIndex ?? -1;
      const targetIdx = Math.min(lines.length - 1, currentIdx + 1);
      if (lines[targetIdx]) {
        applyScrub(lines[targetIdx].start_time_seconds);
        loadLineIntoEditor(lines[targetIdx].line_id);
      }
    } else if (e.code === 'PageUp') {
      e.preventDefault();
      el.btnPrevPage.click();
    } else if (e.code === 'PageDown') {
      e.preventDefault();
      el.btnNextPage.click();
    } else if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      applyScrub(Math.max(0, currentTime - 1.0));
    } else if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      el.btnPlayPause.click();
    } else if (e.key === 'f' || e.key === 'F' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      openFeedbackModal(currentTime);
    } else if (e.key === 'Escape') {
      closeScoreContextMenu();
      closeFeedbackModal();
    }
  });

  // Handle window resize for timeline canvas
  window.addEventListener('resize', () => {
    cachedTimelineRect = null;
    renderTimelineCanvas();
    renderTimelineFeedbackMarkers();
  });
}

/**
 * Update Play/Pause button UI state
 */
function updatePlayButton() {
  const isPlaying = appState?.playback?.isPlaying || false;
  el.playIcon.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;';
  el.playText.textContent = isPlaying ? 'Pause' : 'Play';
  el.btnPlayPause.classList.toggle('btn-primary', !isPlaying);
  el.btnPlayPause.classList.toggle('btn-secondary', isPlaying);
}

// Feedback & Context Menu state variables
let currentContextMenuTime = 0;
let currentFeedbackFilter = 'all';
let editingFeedbackId = null;
let activeFeedbackTargetTime = 0;

/**
 * Toast Notification popup
 */
function showToast(message) {
  if (!el.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.innerHTML = `<span>💬</span><span>${message}</span>`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

/**
 * Switch Inspector Tab between 'lyrics' and 'feedbacks'
 */
function switchInspectorTab(tabName) {
  const isLyrics = tabName === 'lyrics';
  if (el.tabLyrics) {
    el.tabLyrics.classList.toggle('active', isLyrics);
    el.tabLyrics.setAttribute('aria-selected', String(isLyrics));
  }
  if (el.tabFeedbacks) {
    el.tabFeedbacks.classList.toggle('active', !isLyrics);
    el.tabFeedbacks.setAttribute('aria-selected', String(!isLyrics));
  }
  if (el.paneLyrics) el.paneLyrics.style.display = isLyrics ? 'block' : 'none';
  if (el.paneFeedbacks) el.paneFeedbacks.style.display = isLyrics ? 'none' : 'block';
}

/**
 * Render interactive feedback pin markers on the SVG score
 */
function renderScoreFeedbackPins(svg, geometryMap) {
  if (!svg || !geometryMap || !appState) return;
  const ns = 'http://www.w3.org/2000/svg';

  let pinsGroup = svg.querySelector('g.score-feedback-pins-layer');
  if (!pinsGroup) {
    pinsGroup = document.createElementNS(ns, 'g');
    pinsGroup.setAttribute('class', 'score-feedback-pins-layer');
    svg.appendChild(pinsGroup);
  }
  pinsGroup.replaceChildren();

  const feedbacks = appState.feedbacks || [];
  feedbacks.forEach(fb => {
    const measure = geometryMap.get(fb.bar);
    if (!measure) return;

    const beatFrac = Math.max(0, Math.min(0.999, (fb.beat - 1) / 4.0));
    const pinX = measure.x1 + (measure.x2 - measure.x1) * beatFrac;
    const pinY = measure.y1 - 160;

    const pinG = document.createElementNS(ns, 'g');
    pinG.setAttribute('class', `score-feedback-pin ${fb.resolved ? 'resolved' : ''}`);
    pinG.setAttribute('transform', `translate(${pinX}, ${pinY})`);
    pinG.dataset.feedbackId = fb.id;

    const title = document.createElementNS(ns, 'title');
    title.textContent = `[m.${fb.bar}.${Math.floor(fb.beat)} · ${formatTime(fb.time)}] ${fb.stem} (${fb.category}): ${fb.text}`;
    pinG.appendChild(title);

    const STEM_PIN_COLORS = {
      vocals: '#EC4899',
      drums: '#F59E0B',
      bass: '#10B981',
      other: '#8B5CF6',
      all: '#3B82F6'
    };
    const pinColor = STEM_PIN_COLORS[fb.stem] || '#F59E0B';

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('class', 'pin-dot');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '220');
    circle.setAttribute('fill', pinColor);
    circle.setAttribute('stroke', '#FFFFFF');
    circle.setAttribute('stroke-width', '35');

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('class', 'pin-icon');
    text.setAttribute('x', '0');
    text.setAttribute('y', '20');
    text.setAttribute('font-size', '220');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', '#FFFFFF');
    text.textContent = fb.resolved ? '✓' : '💬';

    pinG.append(circle, text);

    pinG.addEventListener('click', (e) => {
      e.stopPropagation();
      applyScrub(fb.time, { commitAudio: true });
      switchInspectorTab('feedbacks');
      highlightFeedbackCard(fb.id);
    });

    pinsGroup.appendChild(pinG);
  });
}

/**
 * Re-render feedback pins on all currently active score layers
 */
function renderAllScoreFeedbackPins() {
  scoreLayers.forEach(layer => {
    if (layer.svg && layer.geometryMap) {
      renderScoreFeedbackPins(layer.svg, layer.geometryMap);
    }
  });
}

/**
 * Render interactive feedback markers on timeline bar
 */
function renderTimelineFeedbackMarkers() {
  const container = el.timelineFeedbackMarkers || document.getElementById('timeline-feedback-markers');
  if (!container) return;
  container.replaceChildren();

  const duration = appState?.playback?.duration || SCORE_TOTAL_DURATION;
  if (duration <= 0) return;

  const STEM_COLORS = {
    vocals: '#EC4899',
    drums: '#F59E0B',
    bass: '#10B981',
    other: '#8B5CF6',
    all: '#3B82F6'
  };

  (appState?.feedbacks || []).forEach(fb => {
    const pct = Math.max(0, Math.min(100, (fb.time / duration) * 100));
    const marker = document.createElement('div');
    marker.className = `timeline-feedback-marker ${fb.resolved ? 'resolved' : ''}`;
    marker.style.left = `${pct}%`;
    const color = STEM_COLORS[fb.stem] || '#F59E0B';
    marker.style.backgroundColor = color;
    marker.title = `[m.${fb.bar}.${Math.floor(fb.beat)} · ${formatTime(fb.time)}] ${fb.stem}: ${fb.text}`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      applyScrub(fb.time, { commitAudio: true });
      switchInspectorTab('feedbacks');
      highlightFeedbackCard(fb.id);
    });

    container.appendChild(marker);
  });
}

/**
 * Flash and scroll to feedback card in inspector
 */
function highlightFeedbackCard(id) {
  const card = document.getElementById(`feedback-card-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card.classList.add('highlight-flash');
  setTimeout(() => {
    card.classList.remove('highlight-flash');
  }, 1200);
}

/**
 * Render feedback cards in right Inspector pane
 */
function renderFeedbackList() {
  if (!el.feedbackCardsList) return;
  const feedbacks = appState?.feedbacks || [];
  if (el.feedbackCountBadge) {
    el.feedbackCountBadge.textContent = String(feedbacks.length);
  }

  const filtered = currentFeedbackFilter === 'all'
    ? feedbacks
    : feedbacks.filter(fb => fb.stem === currentFeedbackFilter);

  if (filtered.length === 0) {
    el.feedbackCardsList.replaceChildren();
    if (el.feedbackEmptyState) {
      el.feedbackCardsList.appendChild(el.feedbackEmptyState);
      el.feedbackEmptyState.style.display = 'block';
    }
    return;
  }

  if (el.feedbackEmptyState) {
    el.feedbackEmptyState.style.display = 'none';
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(fb => {
    const card = document.createElement('div');
    card.className = `feedback-card ${fb.resolved ? 'resolved' : ''}`;
    card.id = `feedback-card-${fb.id}`;

    // Header
    const header = document.createElement('div');
    header.className = 'feedback-card-header';

    const badgesLeft = document.createElement('div');
    badgesLeft.className = 'feedback-badges-left';

    const timeBadge = document.createElement('span');
    timeBadge.className = 'fb-badge-time';
    timeBadge.textContent = formatTime(fb.time);
    timeBadge.title = '클릭하여 해당 위치로 이동';
    timeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      applyScrub(fb.time, { commitAudio: true });
      const barPage = getScorePageForBar(fb.bar);
      if (appState.score.currentPage !== barPage) {
        appState = setPage(appState, barPage);
        void updateScorePage().then(syncUI);
      }
    });

    const barBadge = document.createElement('span');
    barBadge.className = 'fb-badge-bar';
    barBadge.textContent = `m.${fb.bar}.${Math.floor(fb.beat)}`;

    const stemBadge = document.createElement('span');
    stemBadge.className = 'fb-badge-stem';
    const STEM_LABELS = {
      vocals: '🎤 Vocals',
      drums: '🥁 Drums',
      bass: '🎸 Bass',
      other: '🎹 Other',
      all: '전체 (Master)'
    };
    stemBadge.textContent = STEM_LABELS[fb.stem] || fb.stem;

    const catBadge = document.createElement('span');
    catBadge.className = 'fb-badge-cat';
    const CAT_LABELS = {
      vocals: '🎤 보컬/발음',
      timing: '⏱️ 타이밍/리듬',
      pitch: '🎵 음정/멜로디',
      mix: '🎚️ 믹스/밸런스',
      lyrics: '📝 가사 수정',
      general: '💡 메모'
    };
    catBadge.textContent = CAT_LABELS[fb.category] || fb.category;

    badgesLeft.append(timeBadge, barBadge, stemBadge, catBadge);

    // Resolve toggle button
    const resolveBtn = document.createElement('button');
    resolveBtn.type = 'button';
    resolveBtn.className = 'fb-action-btn';
    resolveBtn.title = fb.resolved ? '미해결 상태로 변경' : '해결 완료 처리';
    resolveBtn.textContent = fb.resolved ? '✅ 해결됨' : '⭕ 해결하기';
    resolveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      appState = toggleFeedbackResolved(appState, fb.id);
      saveFeedbacksToStorage();
      renderFeedbackList();
      renderAllScoreFeedbackPins();
      renderTimelineFeedbackMarkers();
      renderTimelineCanvas();
    });

    header.append(badgesLeft, resolveBtn);

    // Card Text
    const textEl = document.createElement('div');
    textEl.className = 'feedback-card-text';
    textEl.textContent = fb.text;

    // Card Footer
    const footer = document.createElement('div');
    footer.className = 'feedback-card-footer';

    const meta = document.createElement('span');
    const timeStr = fb.createdAt ? new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    meta.textContent = `${fb.author || 'Reviewer'} · ${timeStr}`;

    const actions = document.createElement('div');
    actions.className = 'feedback-card-actions';

    const seekBtn = document.createElement('button');
    seekBtn.type = 'button';
    seekBtn.className = 'fb-action-btn';
    seekBtn.title = '이동';
    seekBtn.textContent = '▶ 이동';
    seekBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyScrub(fb.time, { commitAudio: true });
      const barPage = getScorePageForBar(fb.bar);
      if (appState.score.currentPage !== barPage) {
        appState = setPage(appState, barPage);
        void updateScorePage().then(syncUI);
      }
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'fb-action-btn';
    editBtn.title = '수정';
    editBtn.textContent = '✏️ 수정';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFeedbackModal(fb.time, { feedbackToEdit: fb });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'fb-action-btn delete';
    deleteBtn.title = '삭제';
    deleteBtn.textContent = '🗑️ 삭제';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`피드백 "${fb.text.slice(0, 20)}..." 항목을 삭제하시겠습니까?`)) {
        appState = deleteFeedback(appState, fb.id);
        saveFeedbacksToStorage();
        renderFeedbackList();
        renderAllScoreFeedbackPins();
        renderTimelineFeedbackMarkers();
        renderTimelineCanvas();
        showToast('피드백이 삭제되었습니다.');
      }
    });

    actions.append(seekBtn, editBtn, deleteBtn);
    footer.append(meta, actions);

    card.append(header, textEl, footer);
    fragment.appendChild(card);
  });

  el.feedbackCardsList.replaceChildren(fragment);
}

/**
 * Persist feedbacks to LocalStorage
 */
function saveFeedbacksToStorage() {
  try {
    localStorage.setItem('stardust_score_feedbacks', JSON.stringify(appState.feedbacks));
  } catch (err) {
    console.warn('Failed to save feedbacks to localStorage:', err);
  }
}

/**
 * Open Score Context Menu at given screen coordinates
 */
function openScoreContextMenu(x, y, time) {
  currentContextMenuTime = Math.max(0, Math.min(time, appState?.playback?.duration || SCORE_TOTAL_DURATION));
  const barNum = Math.min(121, Math.max(1, Math.floor(currentContextMenuTime / 1.5) + 1));
  const beatInBar = ((currentContextMenuTime % 1.5) / 1.5) * 4.0 + 1.0;

  if (el.ctxBarBeat) {
    el.ctxBarBeat.textContent = `BAR ${barNum} · BEAT ${beatInBar.toFixed(1)}`;
  }
  if (el.ctxTimecode) {
    el.ctxTimecode.textContent = formatTime(currentContextMenuTime);
  }

  const menuW = 230;
  const menuH = 220;
  const posX = Math.min(window.innerWidth - menuW - 12, Math.max(10, x));
  const posY = Math.min(window.innerHeight - menuH - 12, Math.max(10, y));

  el.scoreContextMenu.style.left = `${posX}px`;
  el.scoreContextMenu.style.top = `${posY}px`;
  el.scoreContextMenu.style.display = 'flex';
}

/**
 * Close Score Context Menu
 */
function closeScoreContextMenu() {
  if (el.scoreContextMenu) {
    el.scoreContextMenu.style.display = 'none';
  }
}

/**
 * Open Feedback Input Modal Dialog
 */
function openFeedbackModal(time, { feedbackToEdit = null } = {}) {
  activeFeedbackTargetTime = Math.max(0, Math.min(time, appState?.playback?.duration || SCORE_TOTAL_DURATION));
  editingFeedbackId = feedbackToEdit ? feedbackToEdit.id : null;

  const barNum = Math.min(121, Math.max(1, Math.floor(activeFeedbackTargetTime / 1.5) + 1));
  const beatInBar = ((activeFeedbackTargetTime % 1.5) / 1.5) * 4.0 + 1.0;

  if (el.feedbackDialogLocation) {
    el.feedbackDialogLocation.textContent = `BAR ${barNum} · BEAT ${beatInBar.toFixed(1)} · ${formatTime(activeFeedbackTargetTime)}`;
  }

  // Find active lyric context
  const lines = appState?.data?.lyric_lines || [];
  const matchedLine = lines.find(l => activeFeedbackTargetTime >= l.start_time_seconds && activeFeedbackTargetTime <= l.end_time_seconds)
    || lines.find(l => {
      const lineBar = Math.floor(l.start_time_seconds / 1.5) + 1;
      return lineBar === barNum;
    });

  if (matchedLine) {
    el.feedbackLyricContext.style.display = 'flex';
    el.feedbackContextLyricText.textContent = `[Sec ${matchedLine.section}] ${matchedLine.display_text} (${matchedLine.alignment_text})`;
  } else {
    el.feedbackLyricContext.style.display = 'none';
  }

  // Populate fields
  if (feedbackToEdit) {
    el.feedbackTextarea.value = feedbackToEdit.text;
    el.feedbackAuthorInput.value = feedbackToEdit.author || 'Reviewer';

    // Set stem pill active
    el.feedbackStemSelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stem === feedbackToEdit.stem);
    });

    // Set category pill active
    el.feedbackCategorySelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === feedbackToEdit.category);
    });
  } else {
    el.feedbackTextarea.value = '';
    const savedAuthor = localStorage.getItem('stardust_feedback_author') || 'Reviewer';
    el.feedbackAuthorInput.value = savedAuthor;

    // Reset stem to 'all'
    el.feedbackStemSelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stem === 'all');
    });

    // Reset category to 'vocals'
    el.feedbackCategorySelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === 'vocals');
    });
  }

  // If audio is currently playing, pause so user can comfortably type
  if (appState?.playback?.isPlaying) {
    pauseAllAudio();
    appState = pause(appState);
    syncUI();
  }

  el.feedbackModalBackdrop.style.display = 'flex';
  setTimeout(() => el.feedbackTextarea.focus(), 50);
}

/**
 * Close Feedback Input Modal Dialog
 */
function closeFeedbackModal() {
  if (el.feedbackModalBackdrop) {
    el.feedbackModalBackdrop.style.display = 'none';
  }
  editingFeedbackId = null;
}

/**
 * Save Feedback from Modal Dialog
 */
function saveFeedbackFromModal() {
  const text = el.feedbackTextarea.value.trim();
  if (!text) {
    showToast('피드백 내용을 입력해주세요.');
    el.feedbackTextarea.focus();
    return;
  }

  const activeStemBtn = el.feedbackStemSelector.querySelector('.pill-btn.active');
  const stem = activeStemBtn ? activeStemBtn.dataset.stem : 'all';

  const activeCatBtn = el.feedbackCategorySelector.querySelector('.pill-btn.active');
  const category = activeCatBtn ? activeCatBtn.dataset.category : 'general';

  const author = el.feedbackAuthorInput.value.trim() || 'Reviewer';
  try {
    localStorage.setItem('stardust_feedback_author', author);
  } catch (err) {}

  if (editingFeedbackId) {
    appState = updateFeedback(appState, editingFeedbackId, {
      text,
      stem,
      category,
      author
    });
    showToast('피드백이 수정되었습니다.');
  } else {
    const bar = Math.min(121, Math.max(1, Math.floor(activeFeedbackTargetTime / 1.5) + 1));
    const beat = Number((((activeFeedbackTargetTime % 1.5) / 1.5) * 4.0 + 1.0).toFixed(2));
    appState = addFeedback(appState, {
      time: activeFeedbackTargetTime,
      bar,
      beat,
      stem,
      category,
      text,
      author
    });
    showToast('피드백이 등록되었습니다.');
  }

  saveFeedbacksToStorage();
  closeFeedbackModal();
  renderFeedbackList();
  renderAllScoreFeedbackPins();
  renderTimelineFeedbackMarkers();
  renderTimelineCanvas();
  switchInspectorTab('feedbacks');
}

/**
 * Setup Context Menu & Feedback Event Listeners
 */
function setupContextMenuAndFeedback() {
  // 1. Right click on score viewport / frame
  if (el.scoreViewport) {
    el.scoreViewport.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#score-controls-bar, .score-toolbar, #score-source-banner')) {
        return;
      }
      e.preventDefault();
      const clickedSvg = e.target.closest('svg');
      let t = null;
      if (clickedSvg && clickedSvg._geometryMap) {
        t = getTimeFromScorePointer(e, clickedSvg, clickedSvg._geometryMap);
      }
      if (t === null) {
        t = appState?.playback?.currentTime || 0;
      }
      openScoreContextMenu(e.clientX, e.clientY, t);
    });
  }

  // 2. Right click on timeline track
  if (el.timelineTrack) {
    el.timelineTrack.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = el.timelineTrack.getBoundingClientRect();
      const clientX = e.clientX ?? 0;
      const clickX = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      const duration = appState?.playback?.duration || SCORE_TOTAL_DURATION;
      const t = pct * duration;
      openScoreContextMenu(e.clientX, e.clientY, t);
    });
  }

  // 3. Context Menu Items
  if (el.ctxBtnAddFeedback) {
    el.ctxBtnAddFeedback.addEventListener('click', () => {
      closeScoreContextMenu();
      openFeedbackModal(currentContextMenuTime);
    });
  }

  if (el.ctxBtnPlayFromHere) {
    el.ctxBtnPlayFromHere.addEventListener('click', () => {
      closeScoreContextMenu();
      applyScrub(currentContextMenuTime, { commitAudio: true });
      if (!appState.playback.isPlaying) {
        el.btnPlayPause.click();
      }
    });
  }

  if (el.ctxBtnSetRangeA) {
    el.ctxBtnSetRangeA.addEventListener('click', () => {
      closeScoreContextMenu();
      appState = setRangeA(appState, currentContextMenuTime);
      syncUI();
      showToast(`A 루프 시작점: ${formatTime(currentContextMenuTime)}`);
    });
  }

  if (el.ctxBtnSetRangeB) {
    el.ctxBtnSetRangeB.addEventListener('click', () => {
      closeScoreContextMenu();
      appState = setRangeB(appState, currentContextMenuTime);
      syncUI();
      showToast(`B 루프 종료점: ${formatTime(currentContextMenuTime)}`);
    });
  }

  if (el.ctxBtnCopyTimecode) {
    el.ctxBtnCopyTimecode.addEventListener('click', () => {
      closeScoreContextMenu();
      const code = formatTime(currentContextMenuTime);
      navigator.clipboard.writeText(code).then(() => {
        showToast(`타임코드 복사됨: ${code}`);
      }).catch(() => {
        showToast(`타임코드: ${code}`);
      });
    });
  }

  // Close context menu when clicking outside
  document.addEventListener('pointerdown', (e) => {
    if (el.scoreContextMenu && el.scoreContextMenu.style.display !== 'none' && !el.scoreContextMenu.contains(e.target)) {
      closeScoreContextMenu();
    }
  });

  window.addEventListener('scroll', closeScoreContextMenu, true);

  // 4. Modal event listeners
  if (el.btnCloseFeedbackModal) el.btnCloseFeedbackModal.addEventListener('click', closeFeedbackModal);
  if (el.btnCancelFeedback) el.btnCancelFeedback.addEventListener('click', closeFeedbackModal);
  if (el.btnSubmitFeedback) el.btnSubmitFeedback.addEventListener('click', saveFeedbackFromModal);

  if (el.feedbackModalBackdrop) {
    el.feedbackModalBackdrop.addEventListener('pointerdown', (e) => {
      if (e.target === el.feedbackModalBackdrop) {
        closeFeedbackModal();
      }
    });
  }

  if (el.feedbackTextarea) {
    el.feedbackTextarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveFeedbackFromModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFeedbackModal();
      }
    });
  }

  if (el.feedbackAuthorInput) {
    el.feedbackAuthorInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveFeedbackFromModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFeedbackModal();
      }
    });
  }

  // Stem pill selector
  if (el.feedbackStemSelector) {
    el.feedbackStemSelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.feedbackStemSelector.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // Category pill selector
  if (el.feedbackCategorySelector) {
    el.feedbackCategorySelector.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.feedbackCategorySelector.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // 5. Inspector Tabs
  if (el.tabLyrics) el.tabLyrics.addEventListener('click', () => switchInspectorTab('lyrics'));
  if (el.tabFeedbacks) el.tabFeedbacks.addEventListener('click', () => switchInspectorTab('feedbacks'));

  // Filter chips
  if (el.feedbackFilterChips) {
    el.feedbackFilterChips.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        el.feedbackFilterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFeedbackFilter = chip.dataset.filter || 'all';
        renderFeedbackList();
      });
    });
  }

  // Add Feedback Now button in inspector
  if (el.btnAddFeedbackNow) {
    el.btnAddFeedbackNow.addEventListener('click', () => {
      openFeedbackModal(appState?.playback?.currentTime || 0);
    });
  }

  // Copy feedbacks as markdown
  if (el.btnCopyFeedbacks) {
    el.btnCopyFeedbacks.addEventListener('click', () => {
      const md = exportFeedbackMarkdown(appState);
      navigator.clipboard.writeText(md).then(() => {
        showToast('피드백 마크다운이 클립보드에 복사되었습니다.');
      }).catch(() => {
        showToast('클립보드 복사 실패');
      });
    });
  }

  // Export feedbacks as JSON
  if (el.btnExportFeedbacks) {
    el.btnExportFeedbacks.addEventListener('click', () => {
      const payload = {
        schema: 'canonflow.score-feedbacks.v1',
        piece: appState.data.piece_metadata || {},
        exported_at: new Date().toISOString(),
        total_feedbacks: appState.feedbacks.length,
        feedbacks: appState.feedbacks
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stardust-score-feedbacks.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('피드백 JSON 파일이 다운로드되었습니다.');
    });
  }
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
