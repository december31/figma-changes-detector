// public/modules/inspector.js
// Component Inspection, Preview, Background Toggle & Lightbox Zoom

import { state } from './state.js';
import { setupComparisonView, hideComparisonView } from './diffViewer.js';
import { getStatusPillMeta } from './utils.js';

export { getStatusPillMeta };

export function initInspector() {
  const bgToggleBtn = document.getElementById('bgToggleBtn');
  const bgPatternLabel = document.getElementById('bgPatternLabel');
  const previewContainer = document.getElementById('previewContainer');
  const zoomModalBtn = document.getElementById('zoomModalBtn');
  const zoomModal = document.getElementById('zoomModal');
  const modalImage = document.getElementById('modalImage');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const renderedImage = document.getElementById('renderedImage');
  const diffImageA = document.getElementById('diffImageA');
  const diffImageB = document.getElementById('diffImageB');

  const bgModes = ['bg-grid', 'bg-white', 'bg-dark'];
  let currentBgIndex = 0;

  if (bgToggleBtn && previewContainer) {
    bgToggleBtn.addEventListener('click', () => {
      previewContainer.classList.remove(bgModes[currentBgIndex]);
      currentBgIndex = (currentBgIndex + 1) % bgModes.length;
      previewContainer.classList.add(bgModes[currentBgIndex]);

      const labels = ['Grid', 'White', 'Dark'];
      if (bgPatternLabel) bgPatternLabel.textContent = labels[currentBgIndex];
    });
  }

  function openZoomModal(imgSrc) {
    if (!imgSrc || !zoomModal || !modalImage) return;
    modalImage.src = imgSrc;
    zoomModal.classList.remove('hidden');
  }

  function closeZoomModal() {
    if (!zoomModal || !modalImage) return;
    zoomModal.classList.add('hidden');
    modalImage.src = '';
  }

  if (zoomModalBtn) zoomModalBtn.addEventListener('click', () => openZoomModal(renderedImage.src));
  if (renderedImage) renderedImage.addEventListener('click', () => openZoomModal(renderedImage.src));
  if (diffImageA) diffImageA.addEventListener('click', () => openZoomModal(diffImageA.src));
  if (diffImageB) diffImageB.addEventListener('click', () => openZoomModal(diffImageB.src));
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeZoomModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeZoomModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && zoomModal && !zoomModal.classList.contains('hidden')) {
      closeZoomModal();
    }
  });
}

export function displayInspectionResult(component, currentFetch, previousFetch, updateCompare = true) {
  const placeholderState = document.getElementById('placeholderState');
  const loadingState = document.getElementById('loadingState');
  const imageDisplayWrapper = document.getElementById('imageDisplayWrapper');
  const metadataToolbar = document.getElementById('metadataToolbar');
  const zoomModalBtn = document.getElementById('zoomModalBtn');
  const renderedImage = document.getElementById('renderedImage');
  const changeStatusPill = document.getElementById('changeStatusPill');

  const metaNodeName = document.getElementById('metaNodeName');
  const metaNodeId = document.getElementById('metaNodeId');
  const metaChangeSummary = document.getElementById('metaChangeSummary');
  const metaDimensions = document.getElementById('metaDimensions');
  const metaAssetPath = document.getElementById('metaAssetPath');
  const metaTimestamp = document.getElementById('metaTimestamp');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const downloadImageBtn = document.getElementById('downloadImageBtn');

  state.activeFetchId = currentFetch ? currentFetch.id : null;

  if (placeholderState) placeholderState.classList.add('hidden');
  if (loadingState) loadingState.classList.add('hidden');
  if (imageDisplayWrapper) imageDisplayWrapper.classList.remove('hidden');
  if (metadataToolbar) metadataToolbar.classList.remove('hidden');
  if (zoomModalBtn) zoomModalBtn.classList.remove('hidden');

  if (renderedImage && currentFetch) {
    renderedImage.src = currentFetch.image_path;
  }

  // Status pill
  if (changeStatusPill && currentFetch) {
    const pillMeta = getStatusPillMeta(currentFetch);
    changeStatusPill.textContent = pillMeta.text;
    changeStatusPill.className = `change-pill ${pillMeta.cls}`;
    changeStatusPill.classList.remove('hidden');
  }

  // Metadata fields
  if (metaNodeName) metaNodeName.textContent = component.name;
  if (metaNodeId) metaNodeId.textContent = component.node_id;

  if (metaChangeSummary && currentFetch) {
    if (currentFetch.change_status === 'baseline') {
      metaChangeSummary.textContent = 'Initial Baseline Recorded';
      metaChangeSummary.style.color = 'var(--accent-blue)';
    } else if (currentFetch.change_status === 'unchanged') {
      const prevRef = currentFetch.previous_fetch_id ? ` vs Fetch #${currentFetch.previous_fetch_id}` : '';
      metaChangeSummary.textContent = `0% Diff (Identical Content${prevRef})`;
      metaChangeSummary.style.color = 'var(--accent-green)';
    } else {
      metaChangeSummary.textContent = `${currentFetch.diff_percentage}% changed (${currentFetch.diff_pixels.toLocaleString()} px)`;
      metaChangeSummary.style.color = 'var(--accent-red)';
    }
  }

  if (metaDimensions && currentFetch) {
    metaDimensions.textContent = currentFetch.width && currentFetch.height
      ? `${currentFetch.width} × ${currentFetch.height} px (${component.scale}x)`
      : `${component.scale}x ${(component.format || 'png').toUpperCase()}`;
  }

  if (metaAssetPath && currentFetch) metaAssetPath.textContent = currentFetch.image_path;
  if (metaTimestamp && currentFetch) metaTimestamp.textContent = new Date(currentFetch.fetched_at).toLocaleString();

  if (openNewTabBtn && currentFetch) openNewTabBtn.href = currentFetch.image_path;
  if (downloadImageBtn && currentFetch) downloadImageBtn.href = currentFetch.image_path;

  // Comparison View Data
  if (updateCompare) {
    if (currentFetch) {
      setupComparisonView(component, previousFetch, currentFetch);
    } else {
      hideComparisonView();
    }
  }
}

export function resetInspectionView(message = null) {
  const placeholderState = document.getElementById('placeholderState');
  const loadingState = document.getElementById('loadingState');
  const imageDisplayWrapper = document.getElementById('imageDisplayWrapper');
  const metadataToolbar = document.getElementById('metadataToolbar');
  const historyCard = document.getElementById('historyCard');
  const changeStatusPill = document.getElementById('changeStatusPill');

  if (placeholderState) {
    placeholderState.classList.remove('hidden');
    if (message) {
      placeholderState.querySelector('p').textContent = message;
    }
  }
  if (loadingState) loadingState.classList.add('hidden');
  if (imageDisplayWrapper) imageDisplayWrapper.classList.add('hidden');
  if (metadataToolbar) metadataToolbar.classList.add('hidden');
  if (historyCard) historyCard.classList.add('hidden');
  if (changeStatusPill) changeStatusPill.classList.add('hidden');

  hideComparisonView();
}
