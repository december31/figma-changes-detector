// client/src/components/ComponentItem.tsx
import React from 'react';
import { Component, TransientStatus } from '../types';
import { getStatusPillMeta } from '../utils';

interface ComponentItemProps {
  component: Component;
  isActive: boolean;
  transientStatus?: TransientStatus;
  depth?: number;
  onSelect: (comp: Component) => void;
  onInspect: (comp: Component) => void;
  onFetch: (comp: Component) => void;
  onEdit: (comp: Component) => void;
  onDelete: (comp: Component) => void;
}

export const ComponentItem: React.FC<ComponentItemProps> = React.memo(({
  component,
  isActive,
  transientStatus,
  depth,
  onSelect,
  onInspect,
  onFetch,
  onEdit,
  onDelete
}) => {
  const renderStatusPill = () => {
    if (transientStatus?.status === 'loading') {
      return (
        <span className="change-pill loading">
          <span className="pill-spinner"></span> Loading...
        </span>
      );
    }
    if (transientStatus?.status === 'queued') {
      return (
        <span className="change-pill queued">
          <span className="pill-dot"></span> Queued
        </span>
      );
    }
    const statusMeta = getStatusPillMeta(component.latestFetch);
    return <span className={`change-pill ${statusMeta.cls}`}>{statusMeta.text}</span>;
  };

  return (
    <div
      className={`watchlist-item ${isActive ? 'active' : ''}`}
      data-component-id={component.id}
      style={depth ? { paddingLeft: `${Math.max(depth * 16 + 10, 10)}px` } : undefined}
      onClick={() => onSelect(component)}
    >
      <div className="watchlist-info">
        <div className="watchlist-title-row">
          <span className="watchlist-name" title={component.name}>
            {component.name}
          </span>
        </div>
        <div className="watchlist-tag-row">
          {renderStatusPill()}
        </div>
      </div>

      <div className="watchlist-actions">
        <button
          type="button"
          className="btn-mini inspect-comp-btn"
          title="Inspect & Compare"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(component);
          }}
        >
          ⛶ Inspect
        </button>
        <button
          type="button"
          className="btn-mini fetch-one"
          title="Fetch & Compare this component now"
          disabled={transientStatus?.status === 'loading'}
          onClick={(e) => {
            e.stopPropagation();
            onFetch(component);
          }}
        >
          ↻
        </button>
        <button
          type="button"
          className="btn-mini edit-one"
          title="Edit component details"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(component);
          }}
        >
          ✎
        </button>
        <button
          type="button"
          className="btn-mini delete"
          title="Remove from watchlist"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(component);
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
});
