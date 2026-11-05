// client/src/components/InspectPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Component, FetchRecord } from '../types';
import * as api from '../services/api';
import { getStatusPillMeta } from '../utils';

interface InspectPageProps {
  componentId: number;
  onBack: () => void;
  token?: string;
  hasDefaultToken?: boolean;
  onOpenZoom?: (src: string) => void;
}

export const InspectPage: React.FC<InspectPageProps> = ({
  componentId,
  onBack,
  token,
  hasDefaultToken,
  onOpenZoom
}) => {
  const [component, setComponent] = useState<Component | null>(null);
  const [history, setHistory] = useState<FetchRecord[]>([]);
  const [currentFetch, setCurrentFetch] = useState<FetchRecord | null>(null);
  const [previousFetch, setPreviousFetch] = useState<FetchRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderPercent, setSliderPercent] = useState<number>(50);

  const bgModes = ['bg-grid', 'bg-white', 'bg-dark'];
  const bgLabels = ['Grid', 'White', 'Dark'];
  const [bgIndex, setBgIndex] = useState(0);

  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getComponentHistory(componentId);
      setComponent(res.component);
      const hist = res.history || [];
      setHistory(hist);

      if (hist.length > 0) {
        const curr = hist[0];
        setCurrentFetch(curr);
        const prev = curr.previous_fetch_id
          ? hist.find((h) => h.id === curr.previous_fetch_id) || null
          : hist[1] || null;
        setPreviousFetch(prev);
      } else {
        setCurrentFetch(null);
        setPreviousFetch(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to load component.');
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectHistory = (selected: FetchRecord, index: number) => {
    setCurrentFetch(selected);
    const prev = selected.previous_fetch_id
      ? history.find((h) => h.id === selected.previous_fetch_id) || null
      : history[index + 1] || null;
    setPreviousFetch(prev);
  };

  const handleRefetch = async () => {
    if (!token?.trim() && !hasDefaultToken) {
      setActionMessage('Figma access token is missing. Configure it on the main page.');
      return;
    }
    setIsRefetching(true);
    setActionMessage(null);
    try {
      const res = await api.fetchComponentWatchlist(componentId, token);
      if (res.success) {
        await loadData();
        setActionMessage('Snapshot updated successfully.');
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage(`Fetch error: ${msg}`);
    } finally {
      setIsRefetching(false);
    }
  };

  const toggleBg = () => {
    setBgIndex((prev) => (prev + 1) % bgModes.length);
  };

  if (loading) {
    return (
      <div className="inspect-page-container">
        <header className="inspect-page-header">
          <div className="inspect-header-left">
            <button type="button" className="btn-back" onClick={onBack}>
              &larr; Back to Watchlist
            </button>
          </div>
        </header>
        <div className="inspect-loading-card">
          <div className="spinner-large"></div>
          <p>Loading inspection data...</p>
        </div>
      </div>
    );
  }

  if (error || !component) {
    return (
      <div className="inspect-page-container">
        <header className="inspect-page-header">
          <div className="inspect-header-left">
            <button type="button" className="btn-back" onClick={onBack}>
              &larr; Back to Watchlist
            </button>
          </div>
        </header>
        <div className="inspect-error-card">
          <h3>Component Not Found</h3>
          <p>{error || 'The requested component could not be loaded.'}</p>
          <button type="button" className="btn-primary" onClick={onBack} style={{ marginTop: '1rem' }}>
            &larr; Return to Watchlist
          </button>
        </div>
      </div>
    );
  }

  const curr = currentFetch;
  const prev = previousFetch;
  const statusMeta = curr ? getStatusPillMeta(curr) : null;
  const isBaseline = !prev || curr?.change_status === 'baseline';

  return (
    <div className="inspect-page-container">
      {/* Sleek Top Navigation Bar */}
      <header className="inspect-page-header">
        <div className="inspect-header-left">
          <button type="button" className="btn-back" onClick={onBack} title="Return to Watchlist">
            &larr; Back to Watchlist
          </button>

          <div className="inspect-header-divider"></div>

          <div className="inspect-header-meta">
            <h1 className="inspect-comp-name">{component.name}</h1>
            <span className="inspect-node-badge" title="Figma Node ID">
              Node: {component.node_id}
            </span>
            {statusMeta && (
              <span className={`change-pill ${statusMeta.cls}`}>
                {statusMeta.text}
              </span>
            )}
          </div>
        </div>

        <div className="inspect-header-actions">
          {!isBaseline && curr && (
            <div className="compare-mode-switch">
              <button
                type="button"
                className={`btn-tab ${mode === 'side-by-side' ? 'active' : ''}`}
                onClick={() => setMode('side-by-side')}
              >
                Side by Side
              </button>
              <button
                type="button"
                className={`btn-tab ${mode === 'slider' ? 'active' : ''}`}
                onClick={() => setMode('slider')}
              >
                Split Slider
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn-pill"
            title="Toggle background pattern"
            onClick={toggleBg}
          >
            Bg: <strong>{bgLabels[bgIndex]}</strong>
          </button>

          <button
            type="button"
            className="btn-pill btn-action"
            onClick={handleRefetch}
            disabled={isRefetching}
            title="Fetch latest render from Figma"
          >
            {isRefetching ? 'Fetching...' : '↻ Re-Fetch'}
          </button>

          {component.figma_url && (
            <a
              href={component.figma_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill"
              title="Open in Figma"
            >
              ↗ Figma
            </a>
          )}
        </div>
      </header>

      {actionMessage && (
        <div className="inspect-banner-msg">
          <span>{actionMessage}</span>
          <button type="button" className="btn-mini" onClick={() => setActionMessage(null)}>
            &times;
          </button>
        </div>
      )}

      {/* Main Inspection Grid */}
      <div className="inspect-layout">
        {/* Main Comparison Area */}
        <section className="inspect-main-content">
          {!curr ? (
            <div className="placeholder-state" style={{ margin: 'auto' }}>
              <div className="placeholder-icon">🖼</div>
              <h3>No Snapshots Recorded</h3>
              <p>Click Re-Fetch above to record the initial baseline snapshot from Figma.</p>
            </div>
          ) : isBaseline ? (
            /* Clean Single Baseline Snapshot View */
            <div className="baseline-single-pane">
              <div className="diff-pane-header">
                <span className="badge-base">Initial Baseline Snapshot</span>
                <span className="diff-time">
                  Fetch #{curr.id} &bull; {new Date(curr.fetched_at).toLocaleString()}
                  {curr.width && curr.height ? ` &bull; ${curr.width} × ${curr.height} px` : ''}
                </span>
              </div>
              <div className={`diff-image-box ${bgModes[bgIndex]}`}>
                <img
                  src={curr.image_path}
                  alt={component.name}
                  onClick={() => onOpenZoom?.(curr.image_path)}
                  title="Click to Zoom"
                  style={{ cursor: 'zoom-in' }}
                />
              </div>
              <p className="baseline-hint">
                This is the initial baseline snapshot. Subsequent fetches will compare against this version.
              </p>
            </div>
          ) : (
            /* Comparison: Side by Side or Slider */
            <>
              {mode === 'side-by-side' ? (
                <div className="diff-container side-by-side">
                  {/* Previous (Before) */}
                  <div className="diff-pane">
                    <div className="diff-pane-header">
                      <span className="badge-base">Previous</span>
                      <span className="diff-time">
                        {prev ? `Fetch #${prev.id} • ${new Date(prev.fetched_at).toLocaleString()}` : 'None'}
                      </span>
                    </div>
                    <div className={`diff-image-box ${bgModes[bgIndex]}`}>
                      {prev ? (
                        <img
                          src={prev.image_path}
                          alt="Previous Snapshot"
                          onClick={() => onOpenZoom?.(prev.image_path)}
                          title="Click to Zoom"
                          style={{ cursor: 'zoom-in' }}
                        />
                      ) : (
                        <div className="diff-empty-placeholder">No previous snapshot</div>
                      )}
                    </div>
                  </div>

                  {/* Current (After) */}
                  <div className="diff-pane">
                    <div className="diff-pane-header">
                      <span className="badge-target">Current</span>
                      <span className="diff-time">
                        Fetch #{curr.id} &bull; {new Date(curr.fetched_at).toLocaleString()}
                      </span>
                    </div>
                    <div className={`diff-image-box ${bgModes[bgIndex]}`}>
                      <img
                        src={curr.image_path}
                        alt="Current Snapshot"
                        onClick={() => onOpenZoom?.(curr.image_path)}
                        title="Click to Zoom"
                        style={{ cursor: 'zoom-in' }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Split Slider Mode */
                <div className="diff-container slider-mode">
                  <div className={`slider-comparison-box ${bgModes[bgIndex]}`}>
                    <img
                      className="slider-img-after"
                      src={curr.image_path}
                      alt="Current (After)"
                    />
                    <div
                      className="slider-img-before-wrapper"
                      style={{ clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` }}
                    >
                      <img
                        className="slider-img-before"
                        src={prev ? prev.image_path : curr.image_path}
                        alt="Previous (Before)"
                      />
                    </div>
                    <div
                      className="slider-divider-line"
                      style={{ left: `${sliderPercent}%` }}
                    >
                      <div className="slider-divider-knob">&harr;</div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPercent}
                      onChange={(e) => setSliderPercent(Number(e.target.value))}
                      className="comparison-slider-handle"
                    />
                  </div>
                  <div className="slider-legend">
                    <span>&larr; Previous {prev ? `(Fetch #${prev.id})` : ''}</span>
                    <span>Current (Fetch #{curr.id}) &rarr;</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Simplified History Sidebar */}
        <aside className="inspect-sidebar">
          <div className="inspect-sidebar-header">
            <h3>Fetch History</h3>
            <span className="count-pill">{history.length}</span>
          </div>

          <div className="history-list-simple">
            {history.length === 0 ? (
              <div className="empty-state-sm">No fetches recorded yet.</div>
            ) : (
              history.map((entry, index) => {
                const isSelected = entry.id === curr?.id;
                const status = getStatusPillMeta(entry);

                let diffLabel = status.text;
                if (entry.change_status === 'changed' && entry.diff_percentage !== undefined) {
                  diffLabel = `${entry.diff_percentage}% diff`;
                } else if (entry.change_status === 'unchanged') {
                  diffLabel = '0% diff';
                }

                return (
                  <div
                    key={entry.id}
                    className={`history-item-simple ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectHistory(entry, index)}
                    title={`Click to inspect Fetch #${entry.id}`}
                  >
                    <img
                      src={entry.image_path}
                      className="history-thumb-sm"
                      alt={`Fetch #${entry.id}`}
                    />
                    <div className="history-info-simple">
                      <div className="history-row-top">
                        <span className="history-fetch-id">Fetch #{entry.id}</span>
                        <span className={`change-pill ${status.cls}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {diffLabel}
                        </span>
                      </div>
                      <span className="history-date-simple">
                        {new Date(entry.fetched_at).toLocaleDateString()} {new Date(entry.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
