// client/src/components/HistorySidebar.tsx
import React from 'react';
import { Component, FetchRecord } from '../types';
import { getStatusPillMeta } from '../utils';

interface HistorySidebarProps {
  component: Component | null;
  history: FetchRecord[];
  activeFetchId: number | null;
  onSelectFetch: (fetchRecord: FetchRecord, prevRecord: FetchRecord | null) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  component,
  history,
  activeFetchId,
  onSelectFetch
}) => {
  return (
    <aside id="historyCard" className="compare-modal-sidebar">
      <div className="sidebar-header">
        <div>
          <h3>Stored Fetch History</h3>
          <p className="history-comp-title">
            (<span id="historyCompName">{component?.name || '-'}</span>)
          </p>
        </div>
        <span className="history-path-badge">/assets/snapshots</span>
      </div>

      <div id="componentHistoryList" className="history-list">
        {history.length === 0 ? (
          <div className="empty-state-sm">No fetches recorded for this component yet.</div>
        ) : (
          history.map((entry, index) => {
            const prevEntry = entry.previous_fetch_id
              ? history.find((h) => h.id === entry.previous_fetch_id) || null
              : history[index + 1] || null;

            const statusMeta = getStatusPillMeta(entry);
            const isCurrent = entry.id === activeFetchId;

            let metricDesc: React.ReactNode;
            if (entry.change_status === 'unchanged') {
              const vsText = entry.previous_fetch_id ? ` vs Fetch #${entry.previous_fetch_id}` : '';
              metricDesc = (
                <span className="history-metric identical">
                  ✓ 0% Diff (Identical Content{vsText})
                </span>
              );
            } else if (entry.change_status === 'changed') {
              const vsText = entry.previous_fetch_id ? ` vs Fetch #${entry.previous_fetch_id}` : '';
              metricDesc = (
                <span className="history-metric changed">
                  ⚠️ {entry.diff_percentage}% pixel diff ({entry.diff_pixels?.toLocaleString()} px
                  {vsText})
                </span>
              );
            } else {
              metricDesc = (
                <span className="history-metric baseline">📌 Initial Baseline Render</span>
              );
            }

            return (
              <div
                key={entry.id}
                className={`history-item ${statusMeta.cls} ${isCurrent ? 'active' : ''}`}
                data-fetch-id={entry.id}
                onClick={() => onSelectFetch(entry, prevEntry)}
              >
                <div className="history-item-left">
                  <img
                    src={entry.image_path}
                    className="history-thumb"
                    alt={`Fetch #${entry.id}`}
                  />
                  <div className="history-item-body">
                    <div className="history-item-title-row">
                      <strong>Fetch #{entry.id}</strong>
                      <span className={`change-pill ${statusMeta.cls}`}>
                        {statusMeta.text}
                      </span>
                      {isCurrent && <span className="viewing-pill">Inspecting</span>}
                    </div>
                    <div className="history-item-metrics">{metricDesc}</div>
                    <div className="history-item-sub">
                      <span>{new Date(entry.fetched_at).toLocaleString()}</span>
                      {entry.width && entry.height && (
                        <span>
                          &bull; {entry.width} × {entry.height} px
                        </span>
                      )}
                      <code title={entry.image_path}>{entry.image_path}</code>
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-mini inspect-entry"
                    title="Inspect this fetch in comparison view"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFetch(entry, prevEntry);
                    }}
                  >
                    {isCurrent ? 'Viewing' : 'Inspect'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
