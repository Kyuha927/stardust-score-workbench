/**
 * premium-ui.mjs
 * Accessible modal/context-menu helpers and timeline/playhead rendering.
 * In consumer mode the timeline intentionally becomes a compact song-progress
 * strip instead of a multi-lane DAW editor.
 */

import {
  SCORE_TOTAL_DURATION,
  AUDIO_EOF_DURATION,
  scorePosition,
  scoreTimecode
} from './premium-core.mjs';

const STEM_COLORS = {
  vocals: '#EC4899',
  drums: '#F59E0B',
  bass: '#10B981',
  other: '#8B5CF6',
  all: '#3B82F6'
};

const SECTIONS = [
  { name: 'Intro', startBar: 1, endBar: 8, color: 'rgba(56, 189, 248, 0.26)' },
  { name: 'Verse A', startBar: 9, endBar: 24, color: 'rgba(99, 102, 241, 0.24)' },
  { name: 'Pre-Ch', startBar: 25, endBar: 32, color: 'rgba(168, 85, 247, 0.25)' },
  { name: 'Chorus', startBar: 33, endBar: 48, color: 'rgba(236, 72, 153, 0.26)' },
  { name: 'Interlude', startBar: 49, endBar: 52, color: 'rgba(56, 189, 248, 0.24)' },
  { name: 'Verse B', startBar: 53, endBar: 68, color: 'rgba(99, 102, 241, 0.24)' },
  { name: 'Chorus', startBar: 69, endBar: 84, color: 'rgba(236, 72, 153, 0.26)' },
  { name: 'Bridge', startBar: 85, endBar: 100, color: 'rgba(245, 158, 11, 0.24)' },
  { name: 'Chorus', startBar: 101, endBar: 116, color: 'rgba(236, 72, 153, 0.26)' },
  { name: 'Outro', startBar: 117, endBar: 121, color: 'rgba(56, 189, 248, 0.24)' }
];

export function safeStorageRead(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : fallback;
  } catch (err) {
    return fallback;
  }
}

export function safeStorageWrite(key, value) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width || 800);
  const h = Math.max(1, rect.height || 26);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawConsumerTimeline(canvas, lyricLines = []) {
  const { ctx, w, h } = prepareCanvas(canvas);
  const duration = SCORE_TOTAL_DURATION;

  ctx.fillStyle = '#15181d';
  ctx.fillRect(0, 0, w, h);

  // Musical sections provide gentle orientation without turning the strip into
  // an editor. Labels live in the UI overlay, not inside the tiny canvas.
  for (const sec of SECTIONS) {
    const start = ((sec.startBar - 1) * 1.5 / duration) * w;
    const end = (sec.endBar * 1.5 / duration) * w;
    ctx.fillStyle = sec.color;
    ctx.fillRect(start, 0, Math.max(1, end - start), h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(start, 0, 1, h);
  }

  // Vocal phrases are only a thin rhythm cue at the bottom edge.
  for (const line of lyricLines) {
    const x1 = (line.start_time_seconds / duration) * w;
    const x2 = (line.end_time_seconds / duration) * w;
    ctx.fillStyle = 'rgba(180, 196, 255, 0.42)';
    ctx.fillRect(x1, Math.max(0, h - 4), Math.max(2, x2 - x1), 3);
  }

  // Sparse measure landmarks. Eight or sixteen-bar density is enough for a
  // consumer progress bar and avoids visual static.
  const majorEvery = w < 720 ? 32 : 16;
  for (let bar = 1; bar <= 121; bar += majorEvery) {
    const x = (((bar - 1) * 1.5) / duration) * w;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, 0, 1, h);
  }
}

function drawDetailedTimeline(canvas, lyricLines = [], audioDuration = AUDIO_EOF_DURATION) {
  const { ctx, w, h } = prepareCanvas(canvas);
  const duration = SCORE_TOTAL_DURATION;

  ctx.fillStyle = 'rgba(21, 24, 29, 0.85)';
  ctx.fillRect(0, 0, w, Math.min(24, h));

  for (let bar = 1; bar <= 121; bar++) {
    const t = (bar - 1) * 1.5;
    const x = (t / duration) * w;

    if ((bar - 1) % 8 === 0 || bar === 1 || bar === 121) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.8)';
      ctx.fillRect(x, 0, 1, Math.min(24, h));
      if (h >= 24) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.font = '600 9px ui-monospace, monospace';
        if (bar === 121) ctx.fillText('m.121 (END)', Math.max(0, x - 54), 16);
        else ctx.fillText(`m.${bar}`, x + 3, 16);
      }
    } else if (h >= 24 && (bar - 1) % 4 === 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.fillRect(x, 12, 1, 12);
    }
  }

  if (h < 52) return;

  for (const sec of SECTIONS) {
    const t1 = (sec.startBar - 1) * 1.5;
    const t2 = sec.endBar * 1.5;
    const x1 = (t1 / duration) * w;
    const x2 = (t2 / duration) * w;
    const secW = Math.max(2, x2 - x1);
    ctx.fillStyle = sec.color;
    ctx.fillRect(x1, 25, secW, 25);
    if (secW > 28) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 9px sans-serif';
      ctx.fillText(sec.name, x1 + 4, 41);
    }
  }

  if (h < 92) return;

  ctx.fillStyle = 'rgba(15, 18, 22, 0.6)';
  ctx.fillRect(0, 52, w, Math.min(38, h - 52));

  lyricLines.forEach((line, i) => {
    const xStart = (line.start_time_seconds / duration) * w;
    const xEnd = (line.end_time_seconds / duration) * w;
    const blockW = Math.max(3, xEnd - xStart);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(139, 92, 246, 0.35)';
    ctx.fillRect(xStart, 54, blockW, Math.min(34, h - 54));
  });

  if (h < 120) return;

  ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
  ctx.fillRect(0, 92, w, h - 92);

  const audioEndSec = audioDuration || AUDIO_EOF_DURATION;
  const xAudioEnd = (audioEndSec / duration) * w;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.fillRect(0, 93, xAudioEnd, h - 94);
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(xAudioEnd - 1, 92, 2, h - 92);
}

export function createWorkbenchPolish(el, options = {}) {
  const { closeModal, saveModal, redrawTimeline } = options;
  let activeFocusOrigin = null;

  function openMenu(clientX, clientY) {
    if (!el.scoreContextMenu) return;
    const menu = el.scoreContextMenu;
    menu.style.visibility = 'hidden';
    menu.style.display = 'flex';

    const rect = menu.getBoundingClientRect();
    const menuW = rect.width || 220;
    const menuH = rect.height || 210;
    const pad = 12;
    const posX = Math.min(window.innerWidth - menuW - pad, Math.max(pad, clientX));
    const posY = Math.min(window.innerHeight - menuH - pad, Math.max(pad, clientY));

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.style.visibility = 'visible';

    const primaryItem = menu.querySelector('.context-menu-item.primary') || menu.querySelector('.context-menu-item');
    primaryItem?.focus();
  }

  function closeMenu() {
    if (!el.scoreContextMenu) return;
    el.scoreContextMenu.style.display = 'none';
  }

  function showModal() {
    if (!el.feedbackModalBackdrop) return;
    activeFocusOrigin = document.activeElement;
    el.feedbackModalBackdrop.style.display = 'flex';
    el.feedbackModalBackdrop.setAttribute('aria-hidden', 'false');
    setTimeout(() => el.feedbackTextarea?.focus(), 40);
  }

  function hideModal({ force = false } = {}) {
    if (!el.feedbackModalBackdrop) return true;
    if (el.feedbackModalBackdrop.style.display === 'none') return true;

    if (!force && el.feedbackTextarea && el.feedbackTextarea.value.trim().length > 0) {
      if (!confirm('작성 중인 피드백 내용이 있습니다. 닫으시겠습니까?')) return false;
    }

    el.feedbackModalBackdrop.style.display = 'none';
    el.feedbackModalBackdrop.setAttribute('aria-hidden', 'true');

    if (activeFocusOrigin && typeof activeFocusOrigin.focus === 'function') {
      try { activeFocusOrigin.focus(); } catch (err) {}
    }
    return true;
  }

  function selectInspectorTab(tabName) {
    const isLyrics = tabName === 'lyrics';
    if (el.tabLyrics) {
      el.tabLyrics.classList.toggle('active', isLyrics);
      el.tabLyrics.setAttribute('aria-selected', String(isLyrics));
    }
    if (el.tabFeedbacks) {
      el.tabFeedbacks.classList.toggle('active', !isLyrics);
      el.tabFeedbacks.setAttribute('aria-selected', String(!isLyrics));
    }
    if (el.paneLyrics) el.paneLyrics.style.display = isLyrics ? 'flex' : 'none';
    if (el.paneFeedbacks) el.paneFeedbacks.style.display = isLyrics ? 'none' : 'flex';
  }

  function drawTimeline(lyricLines = [], audioDuration = AUDIO_EOF_DURATION) {
    const canvas = el.timelineCanvas;
    if (!canvas) return;
    const consumer = document.documentElement.classList.contains('easy-consumer-ui');
    if (consumer) drawConsumerTimeline(canvas, lyricLines);
    else drawDetailedTimeline(canvas, lyricLines, audioDuration);
  }

  function paintTimeline(currentTime, { announce = false } = {}) {
    const duration = SCORE_TOTAL_DURATION;
    const pct = Math.max(0, Math.min(1, currentTime / duration));

    if (el.timelinePlayhead) {
      const trackWidth = el.timelineTrack ? el.timelineTrack.clientWidth : 800;
      const x = pct * trackWidth;
      el.timelinePlayhead.style.left = '0px';
      el.timelinePlayhead.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    if (announce && el.timelineTrack) {
      el.timelineTrack.setAttribute('aria-valuenow', currentTime.toFixed(2));
    }
  }

  function decorateFeedback(element, fb) {
    if (!element || !fb) return;
    const color = STEM_COLORS[fb.stem] || '#3B82F6';
    element.style.setProperty('--feedback-color', color);
  }

  return {
    openMenu,
    closeMenu,
    showModal,
    hideModal,
    selectInspectorTab,
    drawTimeline,
    paintTimeline,
    decorateFeedback
  };
}
