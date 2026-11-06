// client/src/components/HistoryReportPage.tsx
import React, { useState, useEffect } from 'react';
import { FetchRun, RunDetailsResponse } from '../types';
import * as api from '../services/api';
import { PublishCollabModal } from './PublishCollabModal';

interface HistoryReportPageProps {
  onBack: () => void;
  onOpenZoom?: (src: string) => void;
  onNavigateToInspect?: (componentId: number) => void;
}

export const HistoryReportPage: React.FC<HistoryReportPageProps> = ({
  onBack,
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
  }, []);

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
    <div className="history-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: 'calc(100vh - 3rem)' }}>
      {/* Page Header */}
      <header className="inspect-page-header">
        <div className="inspect-header-left">
          <button type="button" className="btn-back" onClick={onBack}>
            &larr; Back to Watchlist
          </button>
          <div className="inspect-header-divider" />
          <div className="inspect-header-meta">
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                📋 Execution &amp; Running History
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Historical snapshot records per fetch session &bull; Publish report directly to internal Collab
              </p>
            </div>
          </div>
        </div>

        {selectedRun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsPublishCollabOpen(true)}
              title="Publish full report with multiple decks and snapshots to an internal Collab page"
              style={{
                padding: '0.45rem 1rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}
            >
              🚀 Publish to Collab
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyMarkdown}
              title="Copy full markdown report with images ready to paste"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {copiedReport ? '✓ Copied!' : '📋 Copy Markdown'}
            </button>
          </div>
        )}
      </header>

      {/* Main Content Layout */}
      <div
        className="history-page-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1.25rem',
          flex: 1,
          minHeight: '650px'
        }}
      >
        {/* Left Column: Runs Sidebar Card */}
        <aside
          className="panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            maxHeight: 'calc(100vh - 12rem)'
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Execution Sessions ({runs.length})
            </span>
            {isLoadingRuns && <span className="spinner-small" style={{ width: '14px', height: '14px' }} />}
          </div>

          <div
            style={{
              padding: '0.75rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            {runs.length === 0 && !isLoadingRuns && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1rem', textAlign: 'center' }}>
                No execution runs recorded yet. Run a check on your components to create one!
              </div>
            )}

            {runs.map((r) => {
              const isSelected = r.id === selectedRunId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(26, 188, 254, 0.08)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? 'var(--accent-blue)' : '#fff' }}>
                      #{r.id} {r.target_name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {r.trigger_type.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    {formatDate(r.started_at)}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 600 }}>
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
        </aside>

        {/* Right Column: Selected Run Snapshots & Report */}
        <main
          className="panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            maxHeight: 'calc(100vh - 12rem)'
          }}
        >
          {selectedRun ? (
            <>
              {/* Header Toolbar */}
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                    Run #{selectedRun.id}: {selectedRun.target_name}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Captured {formatDate(selectedRun.started_at)} &bull; {selectedRun.total_items} items checked
                  </div>
                </div>

                {/* Filter buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '2px',
                    background: 'var(--bg-input)',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    style={{
                      background: filterStatus === 'all' ? 'var(--border-focus)' : 'transparent',
                      border: 'none',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    All ({runDetails?.items.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('changed')}
                    style={{
                      background: filterStatus === 'changed' ? 'var(--border-focus)' : 'transparent',
                      border: 'none',
                      color: 'var(--accent-red)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Changed ({selectedRun.changed_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('unchanged')}
                    style={{
                      background: filterStatus === 'unchanged' ? 'var(--border-focus)' : 'transparent',
                      border: 'none',
                      color: 'var(--accent-green)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Unchanged ({selectedRun.unchanged_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('baseline')}
                    style={{
                      background: filterStatus === 'baseline' ? 'var(--border-focus)' : 'transparent',
                      border: 'none',
                      color: 'var(--accent-blue)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    Baseline ({selectedRun.baseline_count})
                  </button>
                </div>
              </div>

              {/* Items Grid */}
              <div
                style={{
                  padding: '1.25rem',
                  overflowY: 'auto',
                  flex: 1
                }}
              >
                {isLoadingDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1rem' }}>
                    <div className="spinner-large" />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading historical snapshots for Run #{selectedRun.id}...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No component snapshots match the selected "{filterStatus}" filter.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    {filteredItems.map((item) => {
                      const thumb = `/api/thumbnail?src=${encodeURIComponent(item.image_path)}&size=256`;
                      return (
                        <div
                          key={item.id}
                          className="history-item-card"
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          {/* Image Box */}
                          <div
                            style={{
                              height: '180px',
                              background: 'var(--bg-primary)',
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
                          <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: '1.2', color: '#fff' }} title={item.component_name}>
                                {item.component_name}
                              </span>
                              <span
                                className={`change-pill ${item.change_status}`}
                                style={{ fontSize: '0.65rem', padding: '1px 6px', flexShrink: 0 }}
                              >
                                {item.change_status}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              📁 {item.file_name || 'Figma'} {item.folder_path ? `&bull; ${item.folder_path}` : ''}
                            </div>

                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              Captured: {formatDate(item.fetched_at)}
                            </div>

                            {item.change_status === 'changed' && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', fontWeight: 600, marginTop: '2px' }}>
                                {item.diff_percentage}% changed ({item.diff_pixels?.toLocaleString()} px)
                              </div>
                            )}

                            {onNavigateToInspect && (
                              <button
                                type="button"
                                className="btn-mini"
                                onClick={() => onNavigateToInspect(item.component_id)}
                                style={{ marginTop: 'auto', alignSelf: 'flex-start', paddingTop: '4px', paddingBottom: '4px' }}
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
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Select a run session on the left to view its snapshots.
            </div>
          )}
        </main>
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
