/*
 * consumer-ui.mjs
 * Consumer-facing shell for Stardust. Existing app IDs and event contracts are
 * preserved; advanced controls are simply moved out of the primary visual path.
 */

const root = document.documentElement;
root.classList.add('easy-consumer-ui');

const $ = (selector, scope = document) => scope.querySelector(selector);

const els = {
  topbarRight: $('.topbar-right'),
  loop: $('#btn-loop'),
  range: $('.range-controls'),
  exportDraft: $('#btn-export-draft'),
  metadataDrawer: $('#metadata-drawer'),
  topMetadata: $('.topbar-left > .metadata-pills'),
  mainStage: $('.main-stage'),
  pageNavigator: $('.page-navigator'),
  scoreToolbar: $('.score-toolbar'),
  scoreModeGrand: $('#btn-mode-grand'),
  scoreModeStems: $('#btn-mode-stems'),
  inspector: $('.lyric-inspector'),
  tabLyrics: $('#tab-lyrics'),
  tabFeedbacks: $('#tab-feedbacks'),
  paneLyrics: $('#pane-lyrics'),
  paneFeedbacks: $('#pane-feedbacks'),
  timeline: $('.bottom-timeline-bar'),
  timelineActiveInfo: $('#timeline-active-info'),
  feedbackModal: $('#feedback-modal-backdrop')
};

const runtimeStyle = document.createElement('style');
runtimeStyle.textContent = `
  .easy-inspector-scrim { border: 0; padding: 0; }
  @media (min-width: 901px) {
    html.easy-consumer-ui.inspector-open .easy-inspector-scrim { display: none !important; }
  }
`;
document.head.appendChild(runtimeStyle);

let previousFocus = null;

function makeButton(label, className = '') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `easy-consumer-btn ${className}`.trim();
  el.textContent = label;
  return el;
}

function isFeedbackModalOpen() {
  return Boolean(els.feedbackModal && getComputedStyle(els.feedbackModal).display !== 'none');
}

function setInspectorTab(tab = 'lyrics') {
  const lyrics = tab === 'lyrics';
  els.tabLyrics?.classList.toggle('active', lyrics);
  els.tabFeedbacks?.classList.toggle('active', !lyrics);
  els.tabLyrics?.setAttribute('aria-selected', String(lyrics));
  els.tabFeedbacks?.setAttribute('aria-selected', String(!lyrics));
  if (els.paneLyrics) els.paneLyrics.style.display = lyrics ? 'flex' : 'none';
  if (els.paneFeedbacks) els.paneFeedbacks.style.display = lyrics ? 'none' : 'flex';
}

function updateActionState() {
  const open = Boolean(els.inspector?.classList.contains('is-open'));
  const lyrics = els.tabLyrics?.getAttribute('aria-selected') === 'true';
  const feedbacks = els.tabFeedbacks?.getAttribute('aria-selected') === 'true';
  $('#easy-open-lyrics')?.setAttribute('aria-expanded', String(open && lyrics));
  $('#easy-open-feedbacks')?.setAttribute('aria-expanded', String(open && feedbacks));
}

function openInspector(tab = 'lyrics', sourceButton = null) {
  if (!els.inspector) return;
  previousFocus = sourceButton || (!els.inspector.classList.contains('is-open') ? document.activeElement : previousFocus);
  els.inspector.classList.add('is-open');
  els.inspector.setAttribute('aria-hidden', 'false');
  els.inspector.inert = false;
  root.classList.add('inspector-open');

  setInspectorTab(tab);
  if (tab === 'feedbacks') els.tabFeedbacks?.click();
  else els.tabLyrics?.click();
  updateActionState();
}

function closeInspector({ restoreFocus = true } = {}) {
  if (!els.inspector) return;
  els.inspector.classList.remove('is-open');
  els.inspector.setAttribute('aria-hidden', 'true');
  els.inspector.inert = true;
  if (!els.pageNavigator?.classList.contains('is-open')) root.classList.remove('inspector-open');
  updateActionState();

  if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
    previousFocus.focus({ preventScroll: true });
  }
}

function syncPageNavigatorState() {
  if (!els.pageNavigator) return;
  const overlayMode = window.innerWidth <= 900;
  els.pageNavigator.inert = overlayMode && !els.pageNavigator.classList.contains('is-open');
}

function openPages() {
  if (!els.pageNavigator) return;
  els.pageNavigator.classList.add('is-open');
  els.pageNavigator.inert = false;
  root.classList.add('inspector-open');
  $('.easy-pages-toggle')?.setAttribute('aria-expanded', 'true');
}

function closePages() {
  if (!els.pageNavigator) return;
  els.pageNavigator.classList.remove('is-open');
  if (!els.inspector?.classList.contains('is-open')) root.classList.remove('inspector-open');
  $('.easy-pages-toggle')?.setAttribute('aria-expanded', 'false');
  syncPageNavigatorState();
}

function buildInspectorShell() {
  if (!els.inspector || $('.easy-inspector-head', els.inspector)) return;

  const head = document.createElement('div');
  head.className = 'easy-inspector-head';

  const title = document.createElement('span');
  title.className = 'easy-inspector-title';
  title.textContent = '가사 · 피드백';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'easy-inspector-close';
  close.setAttribute('aria-label', '가사와 피드백 패널 닫기');
  close.textContent = '×';
  close.addEventListener('click', () => closeInspector());

  head.append(title, close);
  els.inspector.prepend(head);
  els.inspector.setAttribute('aria-hidden', 'true');
  els.inspector.inert = true;

  if (els.mainStage && !$('.easy-inspector-scrim', els.mainStage)) {
    const scrim = document.createElement('button');
    scrim.type = 'button';
    scrim.className = 'easy-inspector-scrim';
    scrim.setAttribute('aria-label', '열린 패널 닫기');
    scrim.addEventListener('click', () => {
      closeInspector({ restoreFocus: false });
      closePages();
    });
    els.mainStage.appendChild(scrim);
  }
}

function buildTopActions() {
  if (!els.topbarRight || $('.easy-consumer-actions', els.topbarRight)) return;

  const actions = document.createElement('div');
  actions.className = 'easy-consumer-actions';

  const lyrics = makeButton('📝 가사');
  lyrics.id = 'easy-open-lyrics';
  lyrics.setAttribute('aria-controls', 'pane-lyrics');
  lyrics.setAttribute('aria-expanded', 'false');
  lyrics.addEventListener('click', () => {
    const alreadyOpen = els.inspector?.classList.contains('is-open') && els.tabLyrics?.getAttribute('aria-selected') === 'true';
    if (alreadyOpen) closeInspector();
    else openInspector('lyrics', lyrics);
  });

  const feedbacks = makeButton('💬 피드백', 'primary');
  feedbacks.id = 'easy-open-feedbacks';
  feedbacks.setAttribute('aria-controls', 'pane-feedbacks');
  feedbacks.setAttribute('aria-expanded', 'false');
  feedbacks.addEventListener('click', () => {
    const alreadyOpen = els.inspector?.classList.contains('is-open') && els.tabFeedbacks?.getAttribute('aria-selected') === 'true';
    if (alreadyOpen) closeInspector();
    else openInspector('feedbacks', feedbacks);
  });

  const tools = document.createElement('details');
  tools.className = 'easy-tools-drawer';

  const summary = document.createElement('summary');
  summary.className = 'easy-consumer-summary';
  summary.textContent = '⋯ 더보기';
  summary.setAttribute('aria-label', '고급 기능과 파일 메뉴');

  const content = document.createElement('div');
  content.className = 'easy-tools-content';

  const title = document.createElement('div');
  title.className = 'easy-tools-title';
  title.textContent = '필요할 때만 쓰는 기능';
  content.appendChild(title);

  for (const node of [els.loop, els.range, els.exportDraft, els.topMetadata, els.metadataDrawer]) {
    if (node) content.appendChild(node);
  }

  tools.append(summary, content);
  actions.append(lyrics, feedbacks, tools);
  els.topbarRight.replaceChildren(actions);

  document.addEventListener('pointerdown', (event) => {
    if (tools.open && !tools.contains(event.target)) tools.removeAttribute('open');
  });
}

function buildPageToggle() {
  if (!els.scoreToolbar || $('.easy-pages-toggle', els.scoreToolbar)) return;
  const toggle = makeButton('▤ 페이지');
  toggle.classList.add('easy-pages-toggle');
  toggle.setAttribute('aria-controls', 'thumbnails-list');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    if (els.pageNavigator?.classList.contains('is-open')) closePages();
    else openPages();
  });
  els.scoreToolbar.prepend(toggle);
}

function simplifyLabels() {
  if (els.scoreModeGrand) {
    els.scoreModeGrand.textContent = '🎼 총보';
    els.scoreModeGrand.title = '전체 악보 보기';
  }
  if (els.scoreModeStems) {
    els.scoreModeStems.textContent = '📄 파트별';
    els.scoreModeStems.title = '보컬, 드럼, 베이스, 기타를 파트별로 보기';
  }
  const metadataSummary = $('#metadata-drawer > summary');
  if (metadataSummary) metadataSummary.textContent = '곡 정보 · 파일';
}

function buildSectionLabel() {
  if (!els.timeline || $('.easy-section-label', els.timeline)) return;
  const label = document.createElement('div');
  label.className = 'easy-section-label';
  label.textContent = '곡 진행';
  els.timeline.appendChild(label);

  if (!els.timelineActiveInfo) return;
  let last = '';
  const refresh = () => {
    const text = els.timelineActiveInfo.textContent || '';
    const match = text.match(/\[([^\]]+)\]/);
    const next = match?.[1]?.trim() || '곡 진행';
    if (next !== last) {
      label.textContent = next;
      last = next;
    }
  };
  new MutationObserver(refresh).observe(els.timelineActiveInfo, { childList: true, characterData: true, subtree: true });
  refresh();
}

const STEM_COLOR = {
  vocals: '#ec5d96',
  drums: '#e8a23a',
  bass: '#32b57b',
  other: '#8a70d6',
  all: '#4d91df'
};

function colorForStemLabel(text = '') {
  const t = text.toLowerCase();
  if (t.includes('vocal') || t.includes('보컬')) return STEM_COLOR.vocals;
  if (t.includes('drum') || t.includes('드럼')) return STEM_COLOR.drums;
  if (t.includes('bass') || t.includes('베이스')) return STEM_COLOR.bass;
  if (t.includes('master') || t.includes('전체')) return STEM_COLOR.all;
  if (t.includes('other') || t.includes('기타')) return STEM_COLOR.other;
  return STEM_COLOR.all;
}

function decorateFeedbackNode(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('.score-feedback-pin')) {
    const fill = node.querySelector('circle.pin-dot')?.getAttribute('fill');
    if (fill) node.style.setProperty('--feedback-color', fill);
  }
  if (node.matches('.feedback-card')) {
    const stemText = node.querySelector('.fb-badge-stem')?.textContent || '';
    node.style.setProperty('--feedback-color', colorForStemLabel(stemText));
  }
  node.querySelectorAll?.('.score-feedback-pin, .feedback-card').forEach(decorateFeedbackNode);
}

function observeDynamicFeedback() {
  const targets = [$('#score-svg-frame'), $('#feedback-cards-list')].filter(Boolean);
  if (!targets.length) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(decorateFeedbackNode);
  });
  for (const target of targets) {
    observer.observe(target, { childList: true, subtree: true });
    decorateFeedbackNode(target);
  }
}

function wireInspectorSignals() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.score-feedback-pin, .timeline-feedback-marker')) openInspector('feedbacks');
  }, true);

  els.tabLyrics?.addEventListener('click', () => queueMicrotask(() => {
    setInspectorTab('lyrics');
    updateActionState();
  }));
  els.tabFeedbacks?.addEventListener('click', () => queueMicrotask(() => {
    setInspectorTab('feedbacks');
    updateActionState();
  }));

  if (els.tabFeedbacks) {
    new MutationObserver(() => {
      if (els.tabFeedbacks.getAttribute('aria-selected') === 'true') {
        updateActionState();
        if (!isFeedbackModalOpen() && !els.inspector?.classList.contains('is-open')) openInspector('feedbacks');
      }
    }).observe(els.tabFeedbacks, { attributes: true, attributeFilter: ['aria-selected'] });
  }
}

function wireGlobalControls() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || isFeedbackModalOpen()) return;
    const tools = $('.easy-tools-drawer');
    if (tools?.open) {
      tools.removeAttribute('open');
      return;
    }
    if (els.inspector?.classList.contains('is-open')) {
      closeInspector();
      return;
    }
    if (els.pageNavigator?.classList.contains('is-open')) closePages();
  }, true);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closePages();
    syncPageNavigatorState();
  }, { passive: true });
}

buildInspectorShell();
buildTopActions();
buildPageToggle();
simplifyLabels();
buildSectionLabel();
observeDynamicFeedback();
wireInspectorSignals();
wireGlobalControls();
syncPageNavigatorState();
updateActionState();
