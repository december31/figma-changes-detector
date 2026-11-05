// client/src/components/WatchlistCard.tsx
import React from 'react';
import { Component, BatchResultItem, BatchSummary, TransientStatus } from '../types';
import { ComponentItem } from './ComponentItem';
import { getStatusPillMeta } from '../utils';

interface WatchlistCardProps {
  components: Component[];
  activeComponentId: number | null;
  transientStatuses: Map<number, TransientStatus>;
  isBatchChecking: boolean;
  batchSummary: BatchSummary | null;
  batchResults: BatchResultItem[] | null;
  onClearBatchResults: () => void;
  onCheckAll: () => void;
  onSelectComponent: (comp: Component) => void;
  onInspectComponent: (comp: Component) => void;
  onFetchComponent: (comp: Component) => void;
  onEditComponent: (comp: Component) => void;
  onDeleteComponent: (comp: Component) => void;
  onInspectBatchItem: (item: BatchResultItem) => void;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = ({
  components,
  activeComponentId,
  transientStatuses,
  isBatchChecking,
  batchSummary,
  batchResults,
  onClearBatchResults,
  onCheckAll,
  onSelectComponent,
  onInspectComponent,
  onFetchComponent,
  onEditComponent,
  onDeleteComponent,
  onInspectBatchItem
}) => {
  return (
    <div className="card">
      <div className="card-header space-between">
        <div className="header-title-group">
          <span className="step-num">3</span>
          <h2>Tracked Components Watchlist</h2>
        </div>
        <span id="watchlistCountBadge" className="count-pill">
          {components.length}
        </span>
      </div>
      <p className="section-desc">
        Saved in SQLite. Click <strong>Check All</strong> anytime to fetch new images into{' '}
        <code>/assets</code> and compare against the previous fetch.
      </p>

      <button
        type="button"
        id="checkAllComponentsBtn"
        className="btn-batch"
        onClick={onCheckAll}
        disabled={isBatchChecking}
      >
        <span className="btn-batch-text">
          {isBatchChecking
            ? `Checking ${components.length} component(s)...`
            : '⚡ Check All Components for Changes'}
        </span>
        <span className={`btn-spinner ${isBatchChecking ? '' : 'hidden'}`}></span>
      </button>

      {batchSummary && (
        <div id="batchSummaryBanner" className="batch-summary">
          <span>
            <strong>Batch Complete ({batchSummary.total}):</strong>
          </span>
          <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
            {batchSummary.changed} Changed
          </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
            {batchSummary.unchanged} Identical
          </span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
            {batchSummary.baseline} Baseline
          </span>
          {batchSummary.errors > 0 && (
            <span style={{ color: 'var(--accent-orange)' }}>
              {batchSummary.errors} Error(s)
            </span>
          )}
        </div>
      )}

      {batchResults && batchResults.length > 0 && (
        <div id="batchResultsContainer" className="batch-results-container">
          <div className="batch-results-header">
            <span className="batch-results-title">Latest Batch Run Records</span>
            <button
              type="button"
              id="clearBatchResultsBtn"
              className="btn-mini"
              title="Dismiss batch records"
              onClick={onClearBatchResults}
            >
              &times; Dismiss
            </button>
          </div>
          <div id="batchResultsList" className="batch-results-list">
            {batchResults.map((resItem, idx) => {
              if (!resItem.success) {
                return (
                  <div key={idx} className="batch-result-item">
                    <div className="batch-result-left">
                      <div className="batch-result-thumb-placeholder">⚠️</div>
                      <div className="batch-result-info">
                        <div className="batch-result-title-row">
                          <span className="batch-result-name">
                            {resItem.name || `Component #${resItem.componentId}`}
                          </span>
                          <span className="change-pill changed">Error</span>
                        </div>
                        <span className="batch-result-meta">
                          {resItem.error || 'Fetch failed'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              const comp = resItem.component!;
              const curr = resItem.currentFetch!;
              const statusMeta = getStatusPillMeta(curr);

              let detailNode: React.ReactNode;
              if (curr.change_status === 'unchanged') {
                detailNode = (
                  <>
                    <span className="identical-label">✓ Identical record (0% diff)</span> &bull;{' '}
                    Fetch #{curr.id}
                  </>
                );
              } else if (curr.change_status === 'changed') {
                detailNode = (
                  <>
                    <span className="changed-label">
                      ⚠️ {curr.diff_percentage}% diff ({curr.diff_pixels?.toLocaleString()} px)
                    </span>{' '}
                    &bull; Fetch #{curr.id}
                  </>
                );
              } else {
                detailNode = (
                  <>
                    <span className="baseline-label">📌 Initial baseline</span> &bull; Fetch #{curr.id}
                  </>
                );
              }

              return (
                <div key={idx} className="batch-result-item">
                  <div className="batch-result-left">
                    <img
                      src={curr.image_path}
                      className="batch-result-thumb"
                      alt={comp.name}
                    />
                    <div className="batch-result-info">
                      <div className="batch-result-title-row">
                        <span className="batch-result-name" title={comp.name}>
                          {comp.name}
                        </span>
                        <span className={`change-pill ${statusMeta.cls}`}>
                          {statusMeta.text}
                        </span>
                      </div>
                      <span className="batch-result-meta">
                        Node <code>{comp.node_id}</code> &bull; {detailNode}
                      </span>
                    </div>
                  </div>
                  <div className="batch-result-actions">
                    <button
                      type="button"
                      className="btn-mini inspect-batch-btn"
                      title="Inspect this component in Fullscreen"
                      onClick={() => onInspectBatchItem(resItem)}
                    >
                      ⛶ Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div id="watchlistContainer" className="watchlist-container">
        {components.length === 0 ? (
          <div className="empty-state-sm">
            No components in watchlist yet. Add components above to check them with one click!
          </div>
        ) : (
          components.map((comp) => (
            <ComponentItem
              key={comp.id}
              component={comp}
              isActive={comp.id === activeComponentId}
              transientStatus={transientStatuses.get(comp.id)}
              onSelect={onSelectComponent}
              onInspect={onInspectComponent}
              onFetch={onFetchComponent}
              onEdit={onEditComponent}
              onDelete={onDeleteComponent}
            />
          ))
        )}
      </div>
    </div>
  );
};
