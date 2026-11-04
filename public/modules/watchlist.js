// public/modules/watchlist.js
// Watchlist Management, Rendering, Batch Checking & Per-Item Loading/Queued Status

import { state, setComponentStatus, clearAllComponentStatuses, getComponentStatus } from './state.js';
import { getActiveToken } from './auth.js';
import { getStatusPillMeta, displayInspectionResult, resetInspectionView } from './inspector.js';
import { loadComponentHistory } from './history.js';
import { openEditModal } from './modal.js';
import { openCompareModal } from './diffViewer.js';
import { showError, showInfo, hideBanners } from './utils.js';

export function initWatchlist() {
  const addToWatchlistBtn = document.getElementById('addToWatchlistBtn');
  const fetchImageBtn = document.getElementById('fetchImageBtn');
  const checkAllComponentsBtn = document.getElementById('checkAllComponentsBtn');
  const clearBatchResultsBtn = document.getElementById('clearBatchResultsBtn');
  const refetchCurrentBtn = document.getElementById('refetchCurrentBtn');
  const editCurrentCompBtn = document.getElementById('editCurrentCompBtn');

  // Form Inputs
  const fileKeyInput = document.getElementById('fileKey');
  const nodeIdInput = document.getElementById('nodeId');
  const compCustomNameInput = document.getElementById('compCustomName');
  const renderFormatSelect = document.getElementById('renderFormat');
  const renderScaleSelect = document.getElementById('renderScale');
  const figmaUrlInput = document.getElementById('figmaUrl');

  // Add Component (without immediate fetch)
  if (addToWatchlistBtn) {
    addToWatchlistBtn.addEventListener('click', async () => {
      const fileKey = fileKeyInput.value.trim();
      const nodeId = nodeIdInput.value.trim();
      const name = compCustomNameInput.value.trim();
      const format = renderFormatSelect.value;
      const scale = renderScaleSelect.value;
      const figmaUrl = figmaUrlInput.value.trim();

      hideBanners();

      if (!fileKey || !nodeId) {
        showError('Please provide both File Key and Node ID (or paste a Figma link) to add to the watchlist.');
        return;
      }

      try {
        const res = await fetch('/api/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, fileKey, nodeId, format, scale, figmaUrl, fetchNow: false })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showError(data.error || 'Failed to save component to watchlist.');
          return;
        }

        showInfo(`Saved "${data.component.name}" (${data.component.node_id}) to SQLite watchlist.`);
        await loadWatchlist(data.component.id);
      } catch (err) {
        showError(`Error saving component: ${err.message}`);
      }
    });
  }

  // Fetch & Check Changes Now (via form)
  if (fetchImageBtn) {
    fetchImageBtn.addEventListener('click', async () => {
      const token = getActiveToken();
      const fileKey = fileKeyInput.value.trim();
      const nodeId = nodeIdInput.value.trim();
      const name = compCustomNameInput.value.trim();
      const format = renderFormatSelect.value;
      const scale = renderScaleSelect.value;
      const figmaUrl = figmaUrlInput.value.trim();

      hideBanners();

      if (!token && !state.serverHasDefaultToken) {
        showError('Please enter your Figma Personal Access Token or set FIGMA_ACCESS_TOKEN in .env');
        const tokenInput = document.getElementById('figmaToken');
        if (tokenInput) tokenInput.focus();
        return;
      }

      if (!fileKey || !nodeId) {
        showError('Both File Key and Node ID are required.');
        return;
      }

      setFetchImageLoading(true);
      try {
        const res = await fetch('/api/figma/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, fileKey, nodeId, name, format, scale, figmaUrl })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showError(data.error || 'Failed to fetch component from Figma.');
          setFetchImageLoading(false);
          return;
        }

        state.activeComponentId = data.component.id;
        displayInspectionResult(data.component, data.currentFetch, data.previousFetch);
        await loadWatchlist(data.component.id);
        await loadComponentHistory(data.component.id);
      } catch (err) {
        showError(`Request error: ${err.message}`);
      } finally {
        setFetchImageLoading(false);
      }
    });
  }

  // Check All Components (with item-by-item status progression: queued -> loading -> completed)
  if (checkAllComponentsBtn) {
    checkAllComponentsBtn.addEventListener('click', async () => {
      await executeBatchCheck();
    });
  }

  if (clearBatchResultsBtn) {
    clearBatchResultsBtn.addEventListener('click', () => {
      const container = document.getElementById('batchResultsContainer');
      if (container) container.classList.add('hidden');
    });
  }

  if (refetchCurrentBtn) {
    refetchCurrentBtn.addEventListener('click', () => {
      if (state.activeComponentId) {
        fetchSingleWatchedComponent(state.activeComponentId);
      }
    });
  }

  if (editCurrentCompBtn) {
    editCurrentCompBtn.addEventListener('click', () => {
      if (state.activeComponentId) {
        const comp = state.watchedComponents.find(c => c.id === state.activeComponentId);
        if (comp) openEditModal(comp);
      }
    });
  }
}

export function setFetchImageLoading(isLoading) {
  const fetchImageBtn = document.getElementById('fetchImageBtn');
  const placeholderState = document.getElementById('placeholderState');
  const imageDisplayWrapper = document.getElementById('imageDisplayWrapper');
  const loadingState = document.getElementById('loadingState');

  if (!fetchImageBtn) return;
  const btnText = fetchImageBtn.querySelector('.btn-text-content');
  const spinner = fetchImageBtn.querySelector('.btn-spinner');

  if (isLoading) {
    fetchImageBtn.disabled = true;
    if (btnText) btnText.textContent = 'Fetching & Comparing...';
    if (spinner) spinner.classList.remove('hidden');

    if (placeholderState) placeholderState.classList.add('hidden');
    if (imageDisplayWrapper) imageDisplayWrapper.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');
  } else {
    fetchImageBtn.disabled = false;
    if (btnText) btnText.textContent = 'Fetch & Check Changes Now';
    if (spinner) spinner.classList.add('hidden');
    if (loadingState) loadingState.classList.add('hidden');
  }
}

export async function loadWatchlist(selectId = null) {
  const watchlistCountBadge = document.getElementById('watchlistCountBadge');
  try {
    const res = await fetch('/api/components');
    const data = await res.json();
    if (data.success) {
      state.watchedComponents = data.components || [];
      if (watchlistCountBadge) watchlistCountBadge.textContent = state.watchedComponents.length;
      renderWatchlist();

      if (selectId) {
        const target = state.watchedComponents.find(c => c.id === selectId);
        if (target) selectComponentFromWatchlist(target);
      } else if (!state.activeComponentId && state.watchedComponents.length > 0) {
        const firstWithFetch = state.watchedComponents.find(c => c.latestFetch);
        if (firstWithFetch) selectComponentFromWatchlist(firstWithFetch);
      }
    }
  } catch (err) {
    console.error('Failed to load watchlist:', err);
  }
}

export function renderWatchlist() {
  const watchlistContainer = document.getElementById('watchlistContainer');
  if (!watchlistContainer) return;

  if (!state.watchedComponents.length) {
    watchlistContainer.innerHTML = `<div class="empty-state-sm">No components in watchlist yet. Add components above to check them with one click!</div>`;
    return;
  }

  watchlistContainer.innerHTML = '';

  state.watchedComponents.forEach((comp) => {
    const item = document.createElement('div');
    item.className = `watchlist-item ${comp.id === state.activeComponentId ? 'active' : ''}`;
    item.dataset.componentId = String(comp.id);

    // Check transient status (loading or queued)
    const transient = getComponentStatus(comp.id);
    let pillHtml = '';

    if (transient && transient.status === 'loading') {
      pillHtml = `<span class="change-pill loading"><span class="pill-spinner"></span> Loading...</span>`;
    } else if (transient && transient.status === 'queued') {
      pillHtml = `<span class="change-pill queued"><span class="pill-dot"></span> Queued</span>`;
    } else {
      const statusMeta = getStatusPillMeta(comp.latestFetch);
      pillHtml = `<span class="change-pill ${statusMeta.cls}">${statusMeta.text}</span>`;
    }

    const thumbHtml = comp.latestFetch
      ? `<img src="${comp.latestFetch.image_path}" class="watchlist-thumb" alt="${comp.name}" />`
      : `<div class="watchlist-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#5c6472;">&#128444;</div>`;

    const lastFetchedStr = comp.latestFetch
      ? new Date(comp.latestFetch.fetched_at).toLocaleString()
      : 'Never fetched';

    item.innerHTML = `
      ${thumbHtml}
      <div class="watchlist-info">
        <div class="watchlist-title-row">
          <span class="watchlist-name" title="${comp.name}">${comp.name}</span>
          ${pillHtml}
        </div>
        <span class="watchlist-meta">Node <code>${comp.node_id}</code> &bull; ${comp.totalFetches} fetch(es) &bull; ${lastFetchedStr}</span>
      </div>
      <div class="watchlist-actions">
        <button type="button" class="btn-mini inspect-comp-btn" title="Inspect & Compare in Fullscreen">&#x26F6; Inspect</button>
        <button type="button" class="btn-mini fetch-one" title="Fetch & Compare this component now">&#8635;</button>
        <button type="button" class="btn-mini edit-one" title="Edit component details">&#9998;</button>
        <button type="button" class="btn-mini delete" title="Remove from watchlist">&times;</button>
      </div>
    `;

    // Row selection
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectComponentFromWatchlist(comp);
    });

    // Inspect in fullscreen comparison
    item.querySelector('.inspect-comp-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await selectComponentFromWatchlist(comp);
      openCompareModal(comp, comp.latestFetch, comp.previousFetch);
    });

    // Single fetch
    item.querySelector('.fetch-one').addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchSingleWatchedComponent(comp.id);
    });

    // Edit
    item.querySelector('.edit-one').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(comp);
    });

    // Delete
    item.querySelector('.delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove "${comp.name}" and its stored snapshots from SQLite & /assets?`)) return;
      await fetch(`/api/components/${comp.id}`, { method: 'DELETE' });
      if (state.activeComponentId === comp.id) {
        state.activeComponentId = null;
        resetInspectionView();
      }
      await loadWatchlist();
    });

    watchlistContainer.appendChild(item);
  });
}

export async function selectComponentFromWatchlist(comp) {
  state.activeComponentId = comp.id;
  renderWatchlist();

  const fileKeyInput = document.getElementById('fileKey');
  const nodeIdInput = document.getElementById('nodeId');
  const compCustomNameInput = document.getElementById('compCustomName');
  const renderFormatSelect = document.getElementById('renderFormat');
  const renderScaleSelect = document.getElementById('renderScale');

  if (fileKeyInput) fileKeyInput.value = comp.file_key;
  if (nodeIdInput) nodeIdInput.value = comp.node_id;
  if (compCustomNameInput) compCustomNameInput.value = comp.name;
  if (renderFormatSelect) renderFormatSelect.value = comp.format || 'png';
  if (renderScaleSelect) renderScaleSelect.value = String(comp.scale || 2);

  if (comp.latestFetch) {
    displayInspectionResult(comp, comp.latestFetch, comp.previousFetch);
  } else {
    resetInspectionView(`Component "${comp.name}" (${comp.node_id}) is saved in your watchlist. Click "Re-Fetch" or "Check All Components" to fetch its baseline image.`);
  }

  await loadComponentHistory(comp.id);
}

export async function fetchSingleWatchedComponent(compId) {
  const token = getActiveToken();
  hideBanners();

  if (!token && !state.serverHasDefaultToken) {
    showError('Please provide your Figma Access Token first.');
    const tokenInput = document.getElementById('figmaToken');
    if (tokenInput) tokenInput.focus();
    return;
  }

  // Set transient loading status on this component
  setComponentStatus(compId, { status: 'loading' });
  renderWatchlist();
  setFetchImageLoading(true);

  try {
    const res = await fetch(`/api/components/${compId}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showError(data.error || 'Failed to fetch component.');
      return;
    }

    state.activeComponentId = data.component.id;
    displayInspectionResult(data.component, data.currentFetch, data.previousFetch);
    await loadWatchlist(data.component.id);
    await loadComponentHistory(data.component.id);
  } catch (err) {
    showError(`Fetch failed: ${err.message}`);
  } finally {
    setComponentStatus(compId, null);
    renderWatchlist();
    setFetchImageLoading(false);
  }
}

/**
 * Sequential batch check for all components with live loading & queued statuses
 */
export async function executeBatchCheck() {
  const token = getActiveToken();
  hideBanners();

  if (!token && !state.serverHasDefaultToken) {
    showError('Please provide your Figma Access Token (in UI or .env) before running Check All.');
    const tokenInput = document.getElementById('figmaToken');
    if (tokenInput) tokenInput.focus();
    return;
  }

  if (!state.watchedComponents.length) {
    showError('Your watchlist is empty. Add at least one component first.');
    return;
  }

  const checkAllComponentsBtn = document.getElementById('checkAllComponentsBtn');
  const btnText = checkAllComponentsBtn ? checkAllComponentsBtn.querySelector('.btn-batch-text') : null;
  const spinner = checkAllComponentsBtn ? checkAllComponentsBtn.querySelector('.btn-spinner') : null;
  const batchSummaryBanner = document.getElementById('batchSummaryBanner');

  if (checkAllComponentsBtn) checkAllComponentsBtn.disabled = true;
  if (btnText) btnText.textContent = `Checking ${state.watchedComponents.length} component(s)...`;
  if (spinner) spinner.classList.remove('hidden');
  if (batchSummaryBanner) batchSummaryBanner.classList.add('hidden');

  // Mark all components as "queued" initially
  state.watchedComponents.forEach(comp => {
    setComponentStatus(comp.id, { status: 'queued' });
  });
  renderWatchlist();

  const results = [];
  let changedCount = 0;
  let unchangedCount = 0;
  let baselineCount = 0;
  let errorCount = 0;

  for (let i = 0; i < state.watchedComponents.length; i++) {
    const comp = state.watchedComponents[i];

    // Transition current item to "loading"
    setComponentStatus(comp.id, { status: 'loading' });
    renderWatchlist();

    try {
      const res = await fetch(`/api/components/${comp.id}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fetch failed');
      }

      const status = data.currentFetch.change_status;
      if (status === 'changed') changedCount++;
      else if (status === 'unchanged') unchangedCount++;
      else baselineCount++;

      // Update in local state
      const compIdx = state.watchedComponents.findIndex(c => c.id === comp.id);
      if (compIdx !== -1) {
        state.watchedComponents[compIdx] = {
          ...state.watchedComponents[compIdx],
          latestFetch: data.currentFetch,
          previousFetch: data.previousFetch,
          totalFetches: (state.watchedComponents[compIdx].totalFetches || 0) + 1
        };
      }

      results.push({
        componentId: comp.id,
        component: data.component,
        currentFetch: data.currentFetch,
        previousFetch: data.previousFetch,
        success: true
      });
    } catch (err) {
      errorCount++;
      results.push({
        componentId: comp.id,
        name: comp.name,
        nodeId: comp.node_id,
        success: false,
        error: err.message
      });
    } finally {
      // Clear transient status once complete so actual pill is shown
      setComponentStatus(comp.id, null);
      renderWatchlist();
    }
  }

  // Clear all transient statuses
  clearAllComponentStatuses();
  renderWatchlist();

  if (batchSummaryBanner) {
    batchSummaryBanner.innerHTML = `
      <span><strong>Batch Complete (${state.watchedComponents.length}):</strong></span>
      <span style="color:var(--accent-red);font-weight:600;">${changedCount} Changed</span>
      <span style="color:var(--accent-green);font-weight:600;">${unchangedCount} Identical</span>
      <span style="color:var(--accent-blue);font-weight:600;">${baselineCount} Baseline</span>
      ${errorCount > 0 ? `<span style="color:var(--accent-orange);">${errorCount} Error(s)</span>` : ''}
    `;
    batchSummaryBanner.classList.remove('hidden');
  }

  renderBatchResults(results);

  // Automatically select first changed component or first success
  const firstChanged = results.find(r => r.success && r.currentFetch.change_status === 'changed');
  const firstSuccess = results.find(r => r.success);
  const targetToSelect = firstChanged ? firstChanged.componentId : (firstSuccess ? firstSuccess.componentId : state.activeComponentId);

  await loadWatchlist(targetToSelect);

  if (checkAllComponentsBtn) checkAllComponentsBtn.disabled = false;
  if (btnText) btnText.innerHTML = '&#9889; Check All Components for Changes';
  if (spinner) spinner.classList.add('hidden');
}

export function renderBatchResults(results) {
  const batchResultsContainer = document.getElementById('batchResultsContainer');
  const batchResultsList = document.getElementById('batchResultsList');

  if (!batchResultsContainer || !batchResultsList) return;
  if (!results || !results.length) {
    batchResultsContainer.classList.add('hidden');
    return;
  }

  batchResultsList.innerHTML = '';
  results.forEach((resItem) => {
    const row = document.createElement('div');
    row.className = 'batch-result-item';

    if (!resItem.success) {
      row.innerHTML = `
        <div class="batch-result-left">
          <div class="batch-result-thumb-placeholder">&#9888;</div>
          <div class="batch-result-info">
            <div class="batch-result-title-row">
              <span class="batch-result-name">${resItem.name || `Component #${resItem.componentId}`}</span>
              <span class="change-pill changed">Error</span>
            </div>
            <span class="batch-result-meta">${resItem.error || 'Fetch failed'}</span>
          </div>
        </div>
      `;
      batchResultsList.appendChild(row);
      return;
    }

    const comp = resItem.component;
    const curr = resItem.currentFetch;
    const statusMeta = getStatusPillMeta(curr);

    let detailText = '';
    if (curr.change_status === 'unchanged') {
      detailText = `<span class="identical-label">✓ Identical record (0% diff)</span> &bull; Fetch #${curr.id}`;
    } else if (curr.change_status === 'changed') {
      detailText = `<span class="changed-label">&#9888; ${curr.diff_percentage}% diff (${curr.diff_pixels.toLocaleString()} px)</span> &bull; Fetch #${curr.id}`;
    } else {
      detailText = `<span class="baseline-label">&#128204; Initial baseline</span> &bull; Fetch #${curr.id}`;
    }

    row.innerHTML = `
      <div class="batch-result-left">
        <img src="${curr.image_path}" class="batch-result-thumb" alt="${comp.name}" />
        <div class="batch-result-info">
          <div class="batch-result-title-row">
            <span class="batch-result-name" title="${comp.name}">${comp.name}</span>
            <span class="change-pill ${statusMeta.cls}">${statusMeta.text}</span>
          </div>
          <span class="batch-result-meta">Node <code>${comp.node_id}</code> &bull; ${detailText}</span>
        </div>
      </div>
      <div class="batch-result-actions">
        <button type="button" class="btn-mini inspect-batch-btn" title="Inspect this component in Fullscreen">&#x26F6; Inspect</button>
      </div>
    `;

    row.querySelector('.inspect-batch-btn').addEventListener('click', async () => {
      await selectComponentFromWatchlist(comp);
      openCompareModal(comp, curr, resItem.previousFetch || comp.previousFetch);
    });

    batchResultsList.appendChild(row);
  });

  batchResultsContainer.classList.remove('hidden');
}
