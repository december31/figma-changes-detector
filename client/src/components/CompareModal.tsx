// client/src/components/CompareModal.tsx
import React, { useState, useEffect } from 'react';
import { Component, FetchRecord } from '../types';
import { HistorySidebar } from './HistorySidebar';
import { getStatusPillMeta } from '../utils';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: Component | null;
  currentFetch: FetchRecord | null;
  previousFetch: FetchRecord | null;
  history: FetchRecord[];
  onSelectHistoryFetch: (fetchRecord: FetchRecord, prevRecord: FetchRecord | null) => void;
  onOpenZoom?: (src: string) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  component,
  currentFetch,
  previousFetch,
  history,
  onSelectHistoryFetch,
  onOpenZoom
}) => {
  const [mode, setMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderPercent, setSliderPercent] = useState<number>(50);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const curr = currentFetch;
  const prev = previousFetch;
  const statusMeta = curr ? getStatusPillMeta(curr) : null;

  const isBaseline = !prev || curr?.change_status === 'baseline';
  const isEmpty = !curr;
  const isIdentical = curr?.change_status === 'unchanged';
  const isChanged = curr?.change_status === 'changed';

  const currTime = curr ? new Date(curr.fetched_at).toLocaleString() : '';
  const prevTime = prev ? new Date(prev.fetched_at).toLocaleString() : '';

  let subtitleNode: React.ReactNode = 'Comparing latest stored snapshot against previous snapshot';
  let subtitleColor = 'var(--text-muted)';

  if (isEmpty) {
    subtitleNode = 'No snapshots available for this component yet.';
  } else if (isBaseline) {
    subtitleNode = `Initial baseline snapshot recorded at ${currTime} (Fetch #${curr.id}). No previous fetch to compare against yet.`;
    subtitleColor = 'var(--accent-blue)';
  } else if (isChanged) {
    subtitleNode = `Visual changes detected: ${curr.diff_percentage}% pixel difference (${Number(
      curr.diff_pixels || 0
    ).toLocaleString()} px) vs Fetch #${prev.id}`;
    subtitleColor = 'var(--accent-red)';
  } else if (isIdentical) {
    subtitleNode = `Content verified identical (0% diff) between Fetch #${prev.id} (${prevTime}) and Fetch #${curr.id} (${currTime})`;
    subtitleColor = 'var(--accent-green)';
  }

  return (
    <div id="compareModal" className="compare-fullscreen-modal">
      <div className="compare-modal-window">
        {/* Fullscreen Modal Header */}
        <header className="compare-modal-header">
          <div className="compare-header-left">
            <div className="compare-title-row">
              <h2>Comparison: Current Fetch vs. Previous Fetch</h2>
              <span id="compareCompBadge" className="count-pill">
                {component ? `${component.name} (${component.node_id})` : '-'}
              </span>
              {statusMeta && (
                <span id="compareStatusPill" className={`change-pill ${statusMeta.cls}`}>
                  {statusMeta.text}
                </span>
              )}
            </div>
            <p id="compareSubtitle" className="subtitle" style={{ color: subtitleColor }}>
              {subtitleNode}
            </p>
          </div>
          <div className="compare-header-actions">
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
            <button
              type="button"
              id="closeCompareModalBtn"
              className="btn-close-fullscreen"
              title="Close Comparison (Esc)"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </header>

        {/* Fullscreen Modal Body */}
        <div className="compare-modal-body">
          <div className="compare-modal-main">
            {/* Empty notice banner */}
            {isEmpty && (
              <div id="emptyNoticeBanner" className="alert alert-info">
                <span>
                  No snapshots recorded for this component yet. Re-fetch or check this component on
                  the main page to create an initial snapshot.
                </span>
              </div>
            )}

            {/* Baseline notice banner */}
            {!isEmpty && isBaseline && (
              <div id="baselineNoticeBanner" className="baseline-notice-banner">
                <span className="baseline-icon">📌</span>
                <div className="baseline-notice-text">
                  <strong>Initial Baseline Render:</strong>
                  <span id="baselineNoticeDetails">
                    Initial baseline snapshot recorded at {currTime} (Fetch #{curr.id}). No previous
                    fetch exists to compare against yet.
                  </span>
                </div>
              </div>
            )}

            {/* Identical notice banner */}
            {!isEmpty && !isBaseline && isIdentical && (
              <div id="identicalNoticeBanner" className="identical-notice-banner">
                <span className="identical-icon">✔</span>
                <div className="identical-notice-text">
                  <strong>Identical Content Verified (0% Diff):</strong>
                  <span id="identicalNoticeDetails">
                    Fetch #{curr.id} is 100% identical to previous Fetch #{prev?.id} (0 changed pixels).
                  </span>
                </div>
              </div>
            )}

            {/* 1. Side by Side View */}
            <div
              id="sideBySideView"
              className={`diff-container side-by-side ${mode === 'side-by-side' ? '' : 'hidden'}`}
            >
              <div className="diff-pane" id="diffPaneA">
                <div className="diff-pane-header">
                  <span className="badge-base">Previous Fetch (Before)</span>
                  <span id="diffLabelA" className="diff-time">
                    {prev ? `Fetch #${prev.id} (${prevTime})` : 'No previous snapshot'}
                  </span>
                </div>
                <div className="diff-image-box bg-grid">
                  {prev ? (
                    <img
                      id="diffImageA"
                      src={prev.image_path}
                      alt="Previous Fetch"
                      onClick={() => onOpenZoom?.(prev.image_path)}
                      style={{ cursor: 'zoom-in' }}
                    />
                  ) : (
                    <div id="diffEmptyA" className="diff-empty-placeholder">
                      No previous snapshot
                    </div>
                  )}
                </div>
              </div>

              <div className="diff-pane" id="diffPaneB">
                <div className="diff-pane-header">
                  <span className="badge-target">Current Fetch (After)</span>
                  <span id="diffLabelB" className="diff-time">
                    {curr ? `Fetch #${curr.id} (${currTime})` : '-'}
                  </span>
                </div>
                <div className="diff-image-box bg-grid">
                  {curr && (
                    <img
                      id="diffImageB"
                      src={curr.image_path}
                      alt="Current Fetch"
                      onClick={() => onOpenZoom?.(curr.image_path)}
                      style={{ cursor: 'zoom-in' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 2. Split Slider View */}
            <div
              id="sliderView"
              className={`diff-container slider-mode ${mode === 'slider' ? '' : 'hidden'}`}
            >
              <div className="slider-comparison-box bg-grid">
                {curr && (
                  <img
                    id="sliderImageB"
                    className="slider-img-after"
                    src={curr.image_path}
                    alt="Current (After)"
                  />
                )}
                {curr && (
                  <div
                    id="sliderImageAWrapper"
                    className="slider-img-before-wrapper"
                    style={{ clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` }}
                  >
                    <img
                      id="sliderImageA"
                      className="slider-img-before"
                      src={prev ? prev.image_path : curr.image_path}
                      alt="Previous (Before)"
                    />
                  </div>
                )}
                <div
                  id="sliderDividerLine"
                  className="slider-divider-line"
                  style={{ left: `${sliderPercent}%` }}
                >
                  <div className="slider-divider-knob">&harr;</div>
                </div>
                <input
                  type="range"
                  id="diffSlider"
                  min="0"
                  max="100"
                  value={sliderPercent}
                  onChange={(e) => setSliderPercent(Number(e.target.value))}
                  className="comparison-slider-handle"
                />
              </div>
              <div className="slider-legend">
                <span>&larr; Previous Fetch (Before)</span>
                <span>Current Fetch (After) &rarr;</span>
              </div>
            </div>
          </div>

          {/* History Sidebar */}
          <HistorySidebar
            component={component}
            history={history}
            activeFetchId={curr?.id || null}
            onSelectFetch={onSelectHistoryFetch}
          />
        </div>
      </div>
    </div>
  );
};
