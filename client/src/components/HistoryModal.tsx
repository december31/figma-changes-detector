// client/src/components/HistoryModal.tsx
import React, { useState, useEffect } from 'react';
import { FetchRun, RunDetailsResponse } from '../types';
import * as api from '../services/api';
import { PublishCollabModal } from './PublishCollabModal';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenZoom?: (src: string) => void;
  onNavigateToInspect?: (componentId: number) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenZoom,
  onNavigateToInspect
}) => {
  const [runs, setRuns] = useState<FetchRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDetails, setRunDetails] = useState<RunDetailsResponse | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'changed' | 'unchanged' | 'baseline'>('all');
  const [copiedReport, setCopiedReport] = useState(false);
  const [isPublishCollabOpen, setIsPublishCollabOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingRuns(true);
    api.getFetchRuns(60)
      .then((list) => {
        setRuns(list);
        if (list.length > 0 && !selectedRunId) {
          setSelectedRunId(list[0].id);
        }
      })
      .catch((err) => console.error('Error fetching runs:', err))
      .finally(() => setIsLoadingRuns(false));
  }, [isOpen]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetails(null);
      return;
    }
    setIsLoadingDetails(true);
    api.getRunDetails(selectedRunId)
      .then((data) => setRunDetails(data))
      .catch((err) => console.error('Error fetching run details:', err))
      .finally(() => setIsLoadingDetails(false));
  }, [selectedRunId]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  const filteredItems = (runDetails?.items || []).filter((item) => {
    if (filterStatus === 'all') return true;
    return item.change_status === filterStatus;
  });

  const generateMarkdownReport = () => {
    if (!selectedRun || !runDetails) return '';
    const lines: string[] = [];
    lines.push(`# Figma Visual Regression Report`);
    lines.push(`**Run:** #${selectedRun.id} — ${selectedRun.target_name} (${selectedRun.trigger_type.toUpperCase()})`);
    lines.push(`**Date:** ${new Date(selectedRun.started_at).toLocaleString()}`);
    lines.push(`**Summary:** ${selectedRun.total_items} checked | 🔴 ${selectedRun.changed_count} Changed | 🟢 ${selectedRun.unchanged_count} Unchanged | 🔵 ${selectedRun.baseline_count} Baseline`);
    lines.push('');
    lines.push(`| Component | Status | Diff % | Snapshot (at run) |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);

    runDetails.items.forEach((item) => {
      const badge = item.change_status === 'changed'
        ? `🔴 Changed`
        : (item.change_status === 'unchanged' ? `🟢 Unchanged` : `🔵 Baseline`);
      const diffStr = item.diff_percentage !== undefined ? `${item.diff_percentage}%` : '-';
      const imgMd = `![${item.component_name}](${window.location.origin}${item.image_path})`;
      lines.push(`| **${item.component_name}**<br>_${item.file_name || 'Figma'}_ | ${badge} | ${diffStr} | ${imgMd} |`);
    });

    return lines.join('\n');
  };

  const handleCopyMarkdown = () => {
    const md = generateMarkdownReport();
    if (!md) return;
    navigator.clipboard.writeText(md).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card history-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1100px', width: '92vw', height: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header space-between" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Execution &amp; Running History</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Historical snapshot records per fetch session. Displays exact snapshots captured at run time.
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="history-modal-body" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, minHeight: 0 }}>
          {/* Left: Runs List */}
          <div className="history-runs-sidebar" style={{ borderRight: '1px solid var(--border-color)', overflowY: 'auto', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Execution Sessions ({runs.length})
            </div>

            {isLoadingRuns && <div className="loading-state-sm">Loading sessions...</div>}

            {runs.map((r) => {
              const isSelected = r.id === selectedRunId;
              return (
                <div
                  key={r.id}
                  className={`run-list-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedRunId(r.id)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(26, 188, 254, 0.08)' : 'var(--bg-input)',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--accent-blue)' : '#fff' }}>
                      #{r.id} {r.target_name}
                    </span>
                    <span className="badge-mini" style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }}>
                      {r.trigger_type.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {formatDate(r.started_at)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.68rem', fontWeight: 600 }}>
                    <span style={{ color: r.changed_count > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      🔴 {r.changed_count} changed
                    </span>
                    <span style={{ color: 'var(--accent-green)' }}>
                      🟢 {r.unchanged_count} same
                    </span>
                    <span style={{ color: 'var(--accent-blue)' }}>
                      🔵 {r.baseline_count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Run Snapshots & Report */}
          <div className="history-run-content" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1rem 1.25rem' }}>
            {selectedRun ? (
              <>
                {/* Header Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                      Run #{selectedRun.id}: {selectedRun.target_name}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Executed on {formatDate(selectedRun.started_at)} &bull; {selectedRun.total_items} items checked
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Filter buttons */}
                    <div className="btn-group" style={{ display: 'flex', gap: '2px', background: 'var(--bg-input)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        className={`btn-mini ${filterStatus === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('all')}
                        style={{ background: filterStatus === 'all' ? 'var(--border-focus)' : 'transparent', border: 'none', color: '#fff', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        All ({runDetails?.items.length || 0})
                      </button>
                      <button
                        type="button"
                        className={`btn-mini ${filterStatus === 'changed' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('changed')}
                        style={{ background: filterStatus === 'changed' ? 'var(--border-focus)' : 'transparent', border: 'none', color: 'var(--accent-red)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Changed ({selectedRun.changed_count})
                      </button>
                    </div>

                    {/* Collab Publish & Copy Report Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn-pill"
                        onClick={() => setIsPublishCollabOpen(true)}
                        title="Publish full report with multiple decks and snapshots to an internal Collab page"
                        style={{
                          padding: '0.4rem 0.85rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'var(--accent-blue)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        🚀 Publish to Collab
                      </button>

                      <button
                        type="button"
                        className="btn-pill"
                        onClick={handleCopyMarkdown}
                        title="Copy full markdown report with images ready to paste into Confluence, Jira or Teams"
                        style={{ padding: '0.4rem 0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {copiedReport ? '✓ Copied!' : '📋 Copy Markdown'}
                      </button>
                    </div>
                  </div>
                </div>

                {isLoadingDetails ? (
                  <div className="loading-state" style={{ margin: 'auto' }}>
                    <div className="spinner-large"></div>
                    <p>Loading historical snapshots for Run #{selectedRun.id}...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="empty-state-sm" style={{ margin: 'auto', textAlign: 'center' }}>
                    No component snapshots match the selected filter.
                  </div>
                ) : (
                  <div
                    className="history-items-grid"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    {filteredItems.map((item) => {
                      const thumb = `/api/thumbnail?src=${encodeURIComponent(item.image_path)}&size=192`;
                      return (
                        <div
                          key={item.id}
                          className="history-item-card"
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {/* Image Box */}
                          <div
                            style={{
                              height: '160px',
                              background: '#1a1e28',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: 'pointer',
                              overflow: 'hidden'
                            }}
                            onClick={() => onOpenZoom && onOpenZoom(item.image_path)}
                          >
                            <img
                              src={thumb}
                              alt={item.component_name}
                              loading="lazy"
                              decoding="async"
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '6px',
                                right: '6px',
                                background: 'rgba(0,0,0,0.65)',
                                color: '#fff',
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              🔍 Zoom
                            </div>
                          </div>

                          {/* Info Box */}
                          <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: '1.2' }} title={item.component_name}>
                                {item.component_name}
                              </span>
                              <span
                                className={`change-pill ${item.change_status}`}
                                style={{ fontSize: '0.62rem', padding: '1px 5px', flexShrink: 0 }}
                              >
                                {item.change_status}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Snapshot at: {formatDate(item.fetched_at)}
                            </div>

                            {item.change_status === 'changed' && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', fontWeight: 600 }}>
                                {item.diff_percentage}% changed ({item.diff_pixels?.toLocaleString()} px)
                              </div>
                            )}

                            {onNavigateToInspect && (
                              <button
                                type="button"
                                className="btn-mini"
                                onClick={() => {
                                  onClose();
                                  onNavigateToInspect(item.component_id);
                                }}
                                style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                              >
                                ⛶ Inspect Page
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-sm" style={{ margin: 'auto' }}>
                Select a run session on the left to view its snapshots.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collab Publish Popup Modal */}
      <PublishCollabModal
        isOpen={isPublishCollabOpen}
        onClose={() => setIsPublishCollabOpen(false)}
        run={selectedRun || null}
        runDetails={runDetails}
      />
    </div>
  );
};
