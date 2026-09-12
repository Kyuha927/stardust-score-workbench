/**
 * premium-ui.mjs
 * High-DPI DAW Timeline renderer, accessible modal controller,
 * dynamic context menu measurement, and GPU-accelerated playhead painter.
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

/**
 * Safe LocalStorage helpers resilient to privacy/quota restrictions
 */
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

/**
 * Factory for Workbench polish controllers
 */
export function createWorkbenchPolish(el, options = {}) {
  const { closeModal, saveModal, redrawTimeline } = options;
  let activeFocusOrigin = null;

  // 1. Dynamic Context Menu Measurement & Positioning
  function openMenu(clientX, clientY) {
    if (!el.scoreContextMenu) return;
    const menu = el.scoreContextMenu;

    // Make visible but transparent to measure actual rendered size
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

    // Set focus on primary action
    const primaryItem = menu.querySelector('.context-menu-item.primary') || menu.querySelector('.context-menu-item');
    if (primaryItem) primaryItem.focus();
  }

  function closeMenu() {
    if (!el.scoreContextMenu) return;
    el.scoreContextMenu.style.display = 'none';
  }

  // 2. W3C Accessible Modal Dialog Controller
  function showModal() {
    if (!el.feedbackModalBackdrop) return;
    activeFocusOrigin = document.activeElement;

    el.feedbackModalBackdrop.style.display = 'flex';
    el.feedbackModalBackdrop.setAttribute('aria-hidden', 'false');

    // Trap focus inside modal
    setTimeout(() => {
      if (el.feedbackTextarea) el.feedbackTextarea.focus();
    }, 40);
  }

  function hideModal({ force = false } = {}) {
    if (!el.feedbackModalBackdrop) return true;
    if (el.feedbackModalBackdrop.style.display === 'none') return true;

    if (!force && el.feedbackTextarea && el.feedbackTextarea.value.trim().length > 0) {
      if (!confirm('작성 중인 피드백 내용이 있습니다. 닫으시겠습니까?')) {
        return false;
      }
    }

    el.feedbackModalBackdrop.style.display = 'none';
    el.feedbackModalBackdrop.setAttribute('aria-hidden', 'true');

    if (activeFocusOrigin && typeof activeFocusOrigin.focus === 'function') {
      try { activeFocusOrigin.focus(); } catch (err) {}
    }
    return true;
  }

  // 3. Tab switching preserving flex layout
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

    // Preserve display: flex so children (list and bottom editor) distribute vertically
    if (el.paneLyrics) {
      el.paneLyrics.style.display = isLyrics ? 'flex' : 'none';
    }
    if (el.paneFeedbacks) {
      el.paneFeedbacks.style.display = isLyrics ? 'none' : 'flex';
    }
  }

  // 4. High-DPI Multi-Layer DAW Timeline Canvas
  function drawTimeline(lyricLines = [], audioDuration = AUDIO_EOF_DURATION) {
    const canvas = el.timelineCanvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 140;

    // Retina / High-DPI backing store
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const duration = SCORE_TOTAL_DURATION;

    // ── Layer 1: Measure Ruler (0 to 24px) ──
    ctx.fillStyle = 'rgba(21, 24, 29, 0.85)';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 23, w, 1);

    for (let bar = 1; bar <= 121; bar++) {
      const t = (bar - 1) * 1.5;
      const x = (t / duration) * w;

      if ((bar - 1) % 8 === 0 || bar === 1 || bar === 121) {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.8)';
        ctx.fillRect(x, 0, 1, 24);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.font = '600 9px ui-monospace, monospace';
        if (bar === 121) {
          ctx.fillText('m.121 (END)', Math.max(0, x - 54), 16);
        } else {
          ctx.fillText(`m.${bar}`, x + 3, 16);
        }
      } else if ((bar - 1) % 4 === 0) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.fillRect(x, 12, 1, 12);
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.fillRect(x, 17, 1, 7);
      }
    }

    // ── Layer 2: Section Color Bands (25 to 50px) ──
    SECTIONS.forEach(sec => {
      const t1 = (sec.startBar - 1) * 1.5;
      const t2 = sec.endBar * 1.5;
      const x1 = (t1 / duration) * w;
      const x2 = (t2 / duration) * w;
      const secW = Math.max(2, x2 - x1);

      ctx.fillStyle = sec.color;
      ctx.fillRect(x1, 25, secW, 25);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x1, 25, 1, 25);

      if (secW > 28) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 9px sans-serif';
        ctx.fillText(sec.name, x1 + 4, 41);
      }
    });

    // ── Layer 3: Japanese Vocal Phrase Blocks (52 to 90px) ──
    ctx.fillStyle = 'rgba(15, 18, 22, 0.6)';
    ctx.fillRect(0, 52, w, 38);

    lyricLines.forEach((line, i) => {
      const xStart = (line.start_time_seconds / duration) * w;
      const xEnd = (line.end_time_seconds / duration) * w;
      const blockW = Math.max(3, xEnd - xStart);

      ctx.fillStyle = i % 2 === 0 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(139, 92, 246, 0.35)';
      ctx.fillRect(xStart, 54, blockW, 34);

      ctx.fillStyle = 'rgba(165, 180, 252, 0.8)';
      ctx.fillRect(xStart, 54, 1.5, 34);

      if (blockW > 36) {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
        ctx.font = '9px "Hiragino Mincho ProN", "Yu Mincho", serif';
        const snippet = line.display_text ? line.display_text.slice(0, Math.floor(blockW / 12)) : '';
        ctx.fillText(snippet, xStart + 4, 75);
      }
    });

    // ── Layer 4: Audio Track Waveform Area & Outro Silence Region (92 to 138px) ──
    ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
    ctx.fillRect(0, 92, w, 46);

    const audioEndSec = audioDuration || AUDIO_EOF_DURATION;
    const xAudioEnd = (audioEndSec / duration) * w;

    // Active audio stem indication
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(0, 93, xAudioEnd, 44);

    // Subtle audio energy guideline
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 115);
    ctx.lineTo(xAudioEnd, 115);
    ctx.stroke();

    // Audio EOF boundary line
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(xAudioEnd - 1, 92, 2, 46);

    // Outro silence area after audio EOF (167.39s to 181.50s)
    const silenceW = Math.max(0, w - xAudioEnd);
    if (silenceW > 0) {
      // Diagonal hatch pattern for silence
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fillRect(xAudioEnd, 92, silenceW, 46);

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.lineWidth = 1;
      for (let hx = xAudioEnd; hx < w + 40; hx += 12) {
        ctx.beginPath();
        ctx.moveTo(hx, 92);
        ctx.lineTo(hx - 20, 138);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(248, 113, 113, 0.9)';
      ctx.font = '600 9px monospace';
      ctx.fillText('Audio EOF (167.39s) → Silence to Bar 121', xAudioEnd + 6, 118);
    }
  }

  // 5. GPU-accelerated Playhead Painter (Zero Layout Reflow)
  function paintTimeline(currentTime, { announce = false } = {}) {
    const duration = SCORE_TOTAL_DURATION;
    const pct = Math.max(0, Math.min(1, currentTime / duration));

    // Move via transform translate3d instead of style.left
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

  // 6. Feedback Item Decoration Helper
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
