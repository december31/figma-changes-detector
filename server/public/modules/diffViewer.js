// public/modules/diffViewer.js
// Fullscreen Comparison View (Side-by-Side & Split Slider) Logic

import { state } from './state.js';
import { getStatusPillMeta, showInfo } from './utils.js';
import { loadComponentHistory } from './history.js';

export function initDiffViewer() {
  const tabButtons = document.querySelectorAll('.compare-mode-switch .btn-tab');
  const sideBySideView = document.getElementById('sideBySideView');
  const sliderView = document.getElementById('sliderView');
  const diffSlider = document.getElementById('diffSlider');
  const compareModal = document.getElementById('compareModal');
  const closeCompareModalBtn = document.getElementById('closeCompareModalBtn');
  const openCompareModalBtn = document.getElementById('openCompareModalBtn');

  function switchDiffTab(mode) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (sideBySideView) sideBySideView.classList.toggle('hidden', mode !== 'side-by-side');
    if (sliderView) sliderView.classList.toggle('hidden', mode !== 'slider');
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchDiffTab(btn.dataset.mode));
  });

  if (diffSlider) {
    diffSlider.addEventListener('input', (e) => {
      updateSliderPosition(e.target.value);
    });
    updateSliderPosition(diffSlider.value || 50);
  }

  if (closeCompareModalBtn) {
    closeCompareModalBtn.addEventListener('click', () => {
      closeCompareModal();
    });
  }

  if (openCompareModalBtn) {
    openCompareModalBtn.addEventListener('click', () => {
      if (!state.activeComponentId) {
        showInfo('Please select or fetch a component to inspect in fullscreen comparison.');
        return;
      }
      const comp = state.watchedComponents.find(c => c.id === state.activeComponentId);
      if (comp) {
        openCompareModal(comp, comp.latestFetch, comp.previousFetch);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && compareModal && !compareModal.classList.contains('hidden')) {
      closeCompareModal();
    }
  });
}

export function openCompareModal(component, currentFetch = null, previousFetch = null) {
  const compareModal = document.getElementById('compareModal');
  if (!compareModal) return;

  compareModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const curr = currentFetch || (component ? component.latestFetch : null);
  const prev = previousFetch || (component ? component.previousFetch : null);

  setupComparisonView(component, prev, curr);

  if (component && component.id) {
    loadComponentHistory(component.id, curr ? curr.id : null);
  }
}

export function closeCompareModal() {
  const compareModal = document.getElementById('compareModal');
  if (compareModal) {
    compareModal.classList.add('hidden');
  }
  document.body.style.overflow = '';
}

export function updateSliderPosition(percent) {
  const sliderImageAWrapper = document.getElementById('sliderImageAWrapper');
  const sliderDividerLine = document.getElementById('sliderDividerLine');
  const pct = Math.min(100, Math.max(0, Number(percent)));

  if (sliderImageAWrapper) {
    sliderImageAWrapper.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  }
  if (sliderDividerLine) {
    sliderDividerLine.style.left = `${pct}%`;
  }
}

export function setupComparisonView(component, prevFetch, currFetch) {
  const compareSubtitle = document.getElementById('compareSubtitle');
  const compareCompBadge = document.getElementById('compareCompBadge');
  const compareStatusPill = document.getElementById('compareStatusPill');
  const identicalNoticeBanner = document.getElementById('identicalNoticeBanner');
  const identicalNoticeDetails = document.getElementById('identicalNoticeDetails');
  const baselineNoticeBanner = document.getElementById('baselineNoticeBanner');
  const emptyNoticeBanner = document.getElementById('emptyNoticeBanner');

  const diffImageA = document.getElementById('diffImageA');
  const diffImageB = document.getElementById('diffImageB');
  const diffEmptyA = document.getElementById('diffEmptyA');
  const diffLabelA = document.getElementById('diffLabelA');
  const diffLabelB = document.getElementById('diffLabelB');
  const sliderImageA = document.getElementById('sliderImageA');
  const sliderImageB = document.getElementById('sliderImageB');

  if (component && compareCompBadge) {
    compareCompBadge.textContent = `${component.name} (${component.node_id})`;
  }

  // Case 1: No current fetch at all (unfetched component)
  if (!currFetch) {
    if (emptyNoticeBanner) emptyNoticeBanner.classList.remove('hidden');
    if (identicalNoticeBanner) identicalNoticeBanner.classList.add('hidden');
    if (baselineNoticeBanner) baselineNoticeBanner.classList.add('hidden');
    if (compareSubtitle) {
      compareSubtitle.textContent = 'No snapshots available for this component yet.';
      compareSubtitle.style.color = 'var(--text-muted)';
    }
    if (compareStatusPill) compareStatusPill.classList.add('hidden');
    if (diffImageA) diffImageA.src = '';
    if (diffImageB) diffImageB.src = '';
    if (sliderImageA) sliderImageA.src = '';
    if (sliderImageB) sliderImageB.src = '';
    return;
  }

  if (emptyNoticeBanner) emptyNoticeBanner.classList.add('hidden');

  // Update Status Pill
  if (compareStatusPill) {
    const pillMeta = getStatusPillMeta(currFetch);
    compareStatusPill.textContent = pillMeta.text;
    compareStatusPill.className = `change-pill ${pillMeta.cls}`;
    compareStatusPill.classList.remove('hidden');
  }

  const currTime = new Date(currFetch.fetched_at).toLocaleString();

  // Case 2: Baseline render (no previous fetch to compare)
  if (!prevFetch || currFetch.change_status === 'baseline') {
    if (baselineNoticeBanner) baselineNoticeBanner.classList.remove('hidden');
    if (identicalNoticeBanner) identicalNoticeBanner.classList.add('hidden');
    if (compareSubtitle) {
      compareSubtitle.textContent = `Initial baseline snapshot recorded at ${currTime} (Fetch #${currFetch.id}). No previous fetch to compare against yet.`;
      compareSubtitle.style.color = 'var(--accent-blue)';
    }

    if (diffImageA) {
      diffImageA.src = '';
      diffImageA.classList.add('hidden');
    }
    if (diffEmptyA) diffEmptyA.classList.remove('hidden');
    if (diffLabelA) diffLabelA.textContent = 'No previous snapshot';

    if (diffImageB) {
      diffImageB.src = currFetch.image_path;
      diffImageB.classList.remove('hidden');
    }
    if (diffLabelB) diffLabelB.textContent = `Fetch #${currFetch.id} (${currTime})`;

    if (sliderImageA) sliderImageA.src = currFetch.image_path;
    if (sliderImageB) sliderImageB.src = currFetch.image_path;
    return;
  }

  // Case 3: Comparison between previous and current fetch
  if (baselineNoticeBanner) baselineNoticeBanner.classList.add('hidden');
  if (diffEmptyA) diffEmptyA.classList.add('hidden');
  if (diffImageA) diffImageA.classList.remove('hidden');
  if (diffImageB) diffImageB.classList.remove('hidden');

  const prevTime = new Date(prevFetch.fetched_at).toLocaleString();

  if (currFetch.change_status === 'changed') {
    if (compareSubtitle) {
      compareSubtitle.textContent = `Visual changes detected: ${currFetch.diff_percentage}% pixel difference (${Number(currFetch.diff_pixels || 0).toLocaleString()} px) vs Fetch #${prevFetch.id}`;
      compareSubtitle.style.color = 'var(--accent-red)';
    }
    if (identicalNoticeBanner) {
      identicalNoticeBanner.classList.add('hidden');
    }
  } else {
    if (compareSubtitle) {
      compareSubtitle.textContent = `Content verified identical (0% diff) between Fetch #${prevFetch.id} (${prevTime}) and Fetch #${currFetch.id} (${currTime})`;
      compareSubtitle.style.color = 'var(--accent-green)';
    }
    if (identicalNoticeBanner) {
      if (identicalNoticeDetails) {
        identicalNoticeDetails.textContent = `Fetch #${currFetch.id} is 100% identical to previous Fetch #${prevFetch.id} (0 changed pixels).`;
      }
      identicalNoticeBanner.classList.remove('hidden');
    }
  }

  if (diffImageA) diffImageA.src = prevFetch.image_path;
  if (diffImageB) diffImageB.src = currFetch.image_path;
  if (diffLabelA) diffLabelA.textContent = `Fetch #${prevFetch.id} (${prevTime})`;
  if (diffLabelB) diffLabelB.textContent = `Fetch #${currFetch.id} (${currTime})`;

  if (sliderImageA) sliderImageA.src = prevFetch.image_path;
  if (sliderImageB) sliderImageB.src = currFetch.image_path;
}

export function hideComparisonView() {
  const identicalNoticeBanner = document.getElementById('identicalNoticeBanner');
  const baselineNoticeBanner = document.getElementById('baselineNoticeBanner');
  const emptyNoticeBanner = document.getElementById('emptyNoticeBanner');
  if (identicalNoticeBanner) identicalNoticeBanner.classList.add('hidden');
  if (baselineNoticeBanner) baselineNoticeBanner.classList.add('hidden');
  if (emptyNoticeBanner) emptyNoticeBanner.classList.add('hidden');
}
