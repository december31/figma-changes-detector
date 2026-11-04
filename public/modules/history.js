// public/modules/history.js
// Fetch History List and Detail Display

import { getStatusPillMeta } from './utils.js';
import { displayInspectionResult } from './inspector.js';
import { setupComparisonView } from './diffViewer.js';

export async function loadComponentHistory(componentId, selectedFetchId = null) {
  const historyCard = document.getElementById('historyCard');
  const historyCompName = document.getElementById('historyCompName');
  const componentHistoryList = document.getElementById('componentHistoryList');

  try {
    const res = await fetch(`/api/components/${componentId}/history`);
    const data = await res.json();
    if (!data.success) return;

    if (historyCard) historyCard.classList.remove('hidden');
    if (historyCompName) historyCompName.textContent = data.component.name;
    const history = data.history || [];

    if (!history.length) {
      if (componentHistoryList) {
        componentHistoryList.innerHTML = `<div class="empty-state-sm">No fetches recorded for this component yet.</div>`;
      }
      return;
    }

    const activeId = selectedFetchId || (history[0] ? history[0].id : null);

    if (componentHistoryList) {
      componentHistoryList.innerHTML = '';
      history.forEach((entry, index) => {
        const prevEntry = entry.previous_fetch_id
          ? history.find(h => h.id === entry.previous_fetch_id)
          : (history[index + 1] || null);

        const statusMeta = getStatusPillMeta(entry);
        const isCurrent = entry.id === activeId;
        const row = document.createElement('div');
        row.className = `history-item ${statusMeta.cls} ${isCurrent ? 'active' : ''}`;
        row.dataset.fetchId = String(entry.id);

        let metricDesc = '';
        if (entry.change_status === 'unchanged') {
          const vsText = entry.previous_fetch_id ? ` vs Fetch #${entry.previous_fetch_id}` : '';
          metricDesc = `<span class="history-metric identical">✓ 0% Diff (Identical Content${vsText})</span>`;
        } else if (entry.change_status === 'changed') {
          const vsText = entry.previous_fetch_id ? ` vs Fetch #${entry.previous_fetch_id}` : '';
          metricDesc = `<span class="history-metric changed">&#9888; ${entry.diff_percentage}% pixel diff (${Number(entry.diff_pixels || 0).toLocaleString()} px${vsText})</span>`;
        } else {
          metricDesc = `<span class="history-metric baseline">&#128204; Initial Baseline Render</span>`;
        }

        row.innerHTML = `
          <div class="history-item-left">
            <img src="${entry.image_path}" class="history-thumb" alt="Fetch #${entry.id}" />
            <div class="history-item-body">
              <div class="history-item-title-row">
                <strong>Fetch #${entry.id}</strong>
                <span class="change-pill ${statusMeta.cls}">${statusMeta.text}</span>
                ${isCurrent ? '<span class="viewing-pill">Inspecting</span>' : ''}
              </div>
              <div class="history-item-metrics">
                ${metricDesc}
              </div>
              <div class="history-item-sub">
                <span>${new Date(entry.fetched_at).toLocaleString()}</span>
                ${entry.width && entry.height ? `<span>&bull; ${entry.width} × ${entry.height} px</span>` : ''}
                <code title="${entry.image_path}">${entry.image_path}</code>
              </div>
            </div>
          </div>
          <div>
            <button type="button" class="btn-mini inspect-entry" title="Inspect this fetch in comparison view">${isCurrent ? 'Viewing' : 'Inspect'}</button>
          </div>
        `;

        function selectFetchEntry() {
          // Load this fetch record into the beside full screen comparison view
          setupComparisonView(data.component, prevEntry, entry);
          displayInspectionResult(data.component, entry, prevEntry, false);

          // Update active row highlight in history list
          const allRows = componentHistoryList.querySelectorAll('.history-item');
          allRows.forEach(item => {
            const isTarget = item.dataset.fetchId === String(entry.id);
            item.classList.toggle('active', isTarget);
            const btn = item.querySelector('.inspect-entry');
            if (btn) btn.textContent = isTarget ? 'Viewing' : 'Inspect';
            const existingPill = item.querySelector('.viewing-pill');
            if (isTarget && !existingPill) {
              const titleRow = item.querySelector('.history-item-title-row');
              if (titleRow) {
                const pill = document.createElement('span');
                pill.className = 'viewing-pill';
                pill.textContent = 'Inspecting';
                titleRow.appendChild(pill);
              }
            } else if (!isTarget && existingPill) {
              existingPill.remove();
            }
          });
        }

        row.querySelector('.inspect-entry').addEventListener('click', (e) => {
          e.stopPropagation();
          selectFetchEntry();
        });

        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          selectFetchEntry();
        });

        componentHistoryList.appendChild(row);
      });
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}
