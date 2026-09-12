/**
 * premium-core.mjs
 * Mathematical calculations, timing boundaries, timecode formatters,
 * and data normalization functions for Stardust Score Workbench.
 */

export const SCORE_TOTAL_DURATION = 181.5;
export const AUDIO_EOF_DURATION = 167.392;
export const TEMPO_BPM = 160;
export const SECONDS_PER_BAR = 1.5; // 4/4 at 160 BPM: 60 / 160 * 4 = 1.5s
export const TOTAL_MEASURES = 121;

/**
 * Accurately calculates measure, beat, and fraction for any playback time in [0, 181.5].
 * Properly handles measure 121 boundary at 181.5s as END (fraction = 1.0, beat = 5.0).
 */
export function scorePosition(value) {
  const n = Number(value);
  const time = Number.isFinite(n)
    ? Math.max(0, Math.min(SCORE_TOTAL_DURATION, n))
    : 0;

  const atEnd = time >= SCORE_TOTAL_DURATION;
  const bar = atEnd ? TOTAL_MEASURES : Math.min(TOTAL_MEASURES, Math.floor(time / SECONDS_PER_BAR) + 1);
  const fraction = atEnd
    ? 1.0
    : Math.max(0, Math.min(0.9999, (time - (bar - 1) * SECONDS_PER_BAR) / SECONDS_PER_BAR));

  return {
    time,
    bar,
    fraction,
    beat: 1.0 + fraction * 4.0,
    atEnd
  };
}

/**
 * Formats seconds into standard MM:SS.SS timecode
 */
export function scoreTimecode(seconds) {
  if (isNaN(seconds) || seconds === null || seconds < 0) seconds = 0;
  const clamped = Math.min(SCORE_TOTAL_DURATION, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = (clamped % 60).toFixed(2);
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(5, '0');
  return `${mStr}:${sStr}`;
}

/**
 * Normalizes feedback input object with strict boundary and schema validation
 */
export function normalizeFeedback(raw = {}, defaultAuthor = 'Reviewer') {
  const time = Math.max(0, Math.min(SCORE_TOTAL_DURATION, Number(raw.time) || 0));
  const pos = scorePosition(time);

  const VALID_STEMS = ['all', 'vocals', 'drums', 'bass', 'other'];
  const VALID_CATEGORIES = ['vocals', 'timing', 'pitch', 'mix', 'lyrics', 'general'];

  return {
    id: raw.id || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    time: Number(time.toFixed(3)),
    bar: pos.bar,
    beat: Number(pos.beat.toFixed(2)),
    atEnd: pos.atEnd,
    stem: VALID_STEMS.includes(raw.stem) ? raw.stem : 'all',
    category: VALID_CATEGORIES.includes(raw.category) ? raw.category : 'general',
    text: String(raw.text || '').trim(),
    author: String(raw.author || defaultAuthor).trim() || 'Reviewer',
    createdAt: raw.createdAt || new Date().toISOString(),
    resolved: Boolean(raw.resolved)
  };
}
