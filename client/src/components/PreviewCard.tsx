// client/src/components/PreviewCard.tsx
import React, { useState } from 'react';
import { Component, FetchRecord } from '../types';
import { getStatusPillMeta } from '../utils';

interface PreviewCardProps {
  component: Component | null;
  currentFetch: FetchRecord | null;
  isLoading: boolean;
  onOpenCompare: () => void;
  onRefetchCurrent: () => void;
  onEditCurrent: () => void;
  onOpenZoom: (imgSrc: string) => void;
  emptyMessage?: string;
}

export const PreviewCard: React.FC<PreviewCardProps> = ({
  component,
  currentFetch,
  isLoading,
  onOpenCompare,
  onRefetchCurrent,
  onEditCurrent,
  onOpenZoom,
  emptyMessage
}) => {
  const bgModes = ['bg-grid', 'bg-white', 'bg-dark'];
  const bgLabels = ['Grid', 'White', 'Dark'];
  const [bgIndex, setBgIndex] = useState(0);

  const handleToggleBg = () => {
    setBgIndex((prev) => (prev + 1) % bgModes.length);
  };

  const statusMeta = currentFetch ? getStatusPillMeta(currentFetch) : null;

  const getChangeSummaryNode = () => {
    if (!currentFetch) return '-';
    if (currentFetch.change_status === 'baseline') {
      return <span style={{ color: 'var(--accent-blue)' }}>Initial Baseline Recorded</span>;
    }
    if (currentFetch.change_status === 'unchanged') {
      const prevRef = currentFetch.previous_fetch_id
        ? ` vs Fetch #${currentFetch.previous_fetch_id}`
        : '';
      return (
        <span style={{ color: 'var(--accent-green)' }}>
          0% Diff (Identical Content{prevRef})
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--accent-red)' }}>
        {currentFetch.diff_percentage}% changed ({currentFetch.diff_pixels?.toLocaleString()} px)
      </span>
    );
  };

  const getDimensionsText = () => {
    if (!currentFetch || !component) return '-';
    if (currentFetch.width && currentFetch.height) {
      return `${currentFetch.width} × ${currentFetch.height} px (${component.scale}x)`;
    }
    return `${component.scale}x ${(component.format || 'png').toUpperCase()}`;
  };

  return (
    <div className="card preview-card">
      <div className="card-header space-between">
        <div className="preview-header-left">
          <h2>Component Inspection</h2>
          {statusMeta && (
            <span id="changeStatusPill" className={`change-pill ${statusMeta.cls}`}>
              {statusMeta.text}
            </span>
          )}
        </div>
        <div className="preview-controls">
          <button
            type="button"
            id="bgToggleBtn"
            className="btn-pill"
            title="Toggle background pattern"
            onClick={handleToggleBg}
          >
            Background: <span id="bgPatternLabel">{bgLabels[bgIndex]}</span>
          </button>
          {currentFetch && (
            <button
              type="button"
              id="zoomModalBtn"
              className="btn-pill"
              title="Fullscreen view"
              onClick={() => onOpenZoom(currentFetch.image_path)}
            >
              ⛶ Expand
            </button>
          )}
        </div>
      </div>

      <div id="previewContainer" className={`preview-container ${bgModes[bgIndex]}`}>
        {isLoading ? (
          <div id="loadingState" className="loading-state">
            <div className="spinner-large"></div>
            <h3>Fetching &amp; Comparing...</h3>
            <p>
              Downloading render to <code>/assets</code> and comparing against last fetch
            </p>
          </div>
        ) : currentFetch ? (
          <div id="imageDisplayWrapper" className="image-display-wrapper">
            <img
              id="renderedImage"
              src={currentFetch.image_path}
              alt={component ? component.name : 'Figma Component Render'}
              onClick={() => onOpenZoom(currentFetch.image_path)}
              style={{ cursor: 'zoom-in' }}
            />
          </div>
        ) : (
          <div id="placeholderState" className="placeholder-state">
            <div className="placeholder-icon">🖼</div>
            <h3>{component ? component.name : 'No component selected'}</h3>
            <p>
              {emptyMessage ||
                'Fetch a component, select one from your Tracked Watchlist, or run Check All Components.'}
            </p>
          </div>
        )}
      </div>

      {component && currentFetch && (
        <div id="metadataToolbar" className="metadata-toolbar">
          <div className="meta-tags">
            <div className="meta-tag">
              <span className="meta-label">Component</span>
              <span id="metaNodeName" className="meta-value">
                {component.name}
              </span>
            </div>
            <div className="meta-tag">
              <span className="meta-label">Node ID</span>
              <span id="metaNodeId" className="meta-value font-mono">
                {component.node_id}
              </span>
            </div>
            <div className="meta-tag">
              <span className="meta-label">Change vs Last Fetch</span>
              <span id="metaChangeSummary" className="meta-value">
                {getChangeSummaryNode()}
              </span>
            </div>
            <div className="meta-tag">
              <span className="meta-label">Dimensions</span>
              <span id="metaDimensions" className="meta-value">
                {getDimensionsText()}
              </span>
            </div>
            <div className="meta-tag">
              <span className="meta-label">Stored Asset</span>
              <span id="metaAssetPath" className="meta-value font-mono">
                {currentFetch.image_path}
              </span>
            </div>
            <div className="meta-tag">
              <span className="meta-label">Fetched At</span>
              <span id="metaTimestamp" className="meta-value">
                {new Date(currentFetch.fetched_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="action-buttons-row">
            <button
              type="button"
              id="openCompareModalBtn"
              className="btn-primary"
              style={{ flex: 'initial' }}
              onClick={onOpenCompare}
            >
              ⛶ Inspect &amp; Compare
            </button>
            <button
              type="button"
              id="refetchCurrentBtn"
              className="btn-success"
              onClick={onRefetchCurrent}
            >
              ↻ Re-Fetch &amp; Compare Now
            </button>
            <button
              type="button"
              id="editCurrentCompBtn"
              className="btn-secondary"
              onClick={onEditCurrent}
            >
              ✎ Edit Component
            </button>
            <a
              id="openNewTabBtn"
              href={currentFetch.image_path}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              ↗ Open Stored Asset
            </a>
            <a
              id="downloadImageBtn"
              href={currentFetch.image_path}
              download
              className="btn-secondary"
            >
              ⬇ Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
