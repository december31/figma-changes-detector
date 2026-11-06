// client/src/components/PublishCollabModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { FetchRun, RunDetailsResponse, PublishCollabResponse } from '../types';
import * as api from '../services/api';

interface PublishCollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: FetchRun | null;
  runDetails: RunDetailsResponse | null;
}

export const PublishCollabModal: React.FC<PublishCollabModalProps> = ({
  isOpen,
  onClose,
  run,
  runDetails
}) => {
  const [parentPageInput, setParentPageInput] = useState(() => localStorage.getItem('collab_parent_page_id') || '');
  const [pageTitle, setPageTitle] = useState('');
  const [customCollabUrl, setCustomCollabUrl] = useState('');
  const [customToken, setCustomToken] = useState(() => localStorage.getItem('collab_token') || '');
  const [showSettings, setShowSettings] = useState(false);

  // Status & Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedParent, setVerifiedParent] = useState<{ pageId: string; title: string; spaceKey: string; spaceName: string } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishCollabResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Backend config
  const [defaultCollabUrl, setDefaultCollabUrl] = useState('http://collab.lge.com/main');
  const [hasServerToken, setHasServerToken] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPublishResult(null);
      setPublishError(null);
      return;
    }

    // Load server Collab config
    api.getCollabConfig()
      .then((cfg) => {
        if (cfg.collabUrl) setDefaultCollabUrl(cfg.collabUrl);
        setHasServerToken(cfg.hasToken);
      })
      .catch((err) => console.warn('Could not fetch Collab config:', err));

    if (run) {
      const dateStr = new Date(run.started_at || Date.now()).toLocaleDateString();
      setPageTitle(`Figma Visual Regression Report - Run #${run.id} (${dateStr})`);
    }
  }, [isOpen, run]);

  // Clean parent page ID helper
  const cleanParentId = useMemo(() => {
    const trimmed = parentPageInput.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/[?&]pageId=(\d+)/i) || trimmed.match(/\/pages\/(\d+)(?:\/|$)/i);
    if (match) return match[1];
    return trimmed;
  }, [parentPageInput]);

  // Group items by Figma file to show deck count
  const fileDecks = useMemo(() => {
    if (!runDetails?.items) return [];
    const map = new Map<string, { key: string; name: string; count: number; changed: number }>();
    runDetails.items.forEach((item) => {
      const key = item.file_key || 'unknown';
      const name = item.file_name || `Figma File (${key})`;
      const existing = map.get(key) || { key, name, count: 0, changed: 0 };
      existing.count += 1;
      if (item.change_status === 'changed') existing.changed += 1;
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [runDetails]);

  const handleVerifyParent = async () => {
    if (!cleanParentId) {
      setVerifyError('Please enter a Parent Page ID or URL.');
      setVerifiedParent(null);
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await api.verifyCollabParent(
        cleanParentId,
        customCollabUrl.trim() || undefined,
        customToken.trim() || undefined
      );
      setVerifiedParent({
        pageId: res.pageId,
        title: res.title,
        spaceKey: res.spaceKey,
        spaceName: res.spaceName
      });
      localStorage.setItem('collab_parent_page_id', cleanParentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setVerifyError(msg);
      setVerifiedParent(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!run) return;
    if (!cleanParentId) {
      setPublishError('Parent Page ID is required.');
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    // Save preferences
    localStorage.setItem('collab_parent_page_id', cleanParentId);
    if (customToken.trim()) {
      localStorage.setItem('collab_token', customToken.trim());
    }

    try {
      const res = await api.publishCollabReport({
        runId: run.id,
        parentPageId: cleanParentId,
        pageTitle: pageTitle.trim() || undefined,
        collabUrl: customCollabUrl.trim() || undefined,
        token: customToken.trim() || undefined
      });
      setPublishResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPublishError(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen || !run) return null;

  return (
    <div className="modal" style={{ zIndex: 1200 }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="modal-dialog"
        style={{
          maxWidth: '640px',
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚀</span> Publish Report to Collab
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Automatically creates a new Collab page using the Deck of Cards widget (each Figma file rendered as an interactive Card).
            </p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Run Details Summary */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
              Run #{run.id} — {run.target_name}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(run.started_at).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-main)' }}>
              📦 {run.total_items} Components
            </span>
            <span style={{ background: 'rgba(255, 114, 98, 0.15)', color: 'var(--accent-red)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🔴 {run.changed_count} Changed
            </span>
            <span style={{ background: 'rgba(10, 207, 131, 0.15)', color: 'var(--accent-green)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🟢 {run.unchanged_count} Unchanged
            </span>
            <span style={{ background: 'rgba(26, 188, 254, 0.15)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🔵 {run.baseline_count} Baseline
            </span>
            <span style={{ background: 'rgba(162, 89, 255, 0.15)', color: 'var(--accent-purple)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🃏 {fileDecks.length} Figma Cards in Deck
            </span>
          </div>
        </div>

        {/* Success View */}
        {publishResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div style={{ background: 'rgba(10, 207, 131, 0.12)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🎉</span>
                <strong style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>Published Successfully to Collab!</strong>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Page <strong>"{publishResult.title}"</strong> was created under <em>"{publishResult.parentTitle}"</em> in space <code>{publishResult.spaceKey}</code>.
              </p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Embedded {publishResult.totalAttached} comparison snapshots across {fileDecks.length} Figma Cards in the Deck.
              </p>

              <a
                href={publishResult.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <span>🔗 Open Page in Collab</span>
                <span>↗</span>
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                style={{ padding: '0.5rem 1rem' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Field: Parent Page ID / URL */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Parent Page ID or Collab URL <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. 720906 or http://collab.lge.com/main/pages/viewpage.action?pageId=720906"
                  value={parentPageInput}
                  onChange={(e) => {
                    setParentPageInput(e.target.value);
                    setVerifiedParent(null);
                    setVerifyError(null);
                  }}
                  onBlur={() => {
                    if (cleanParentId && !verifiedParent && !isVerifying) {
                      handleVerifyParent();
                    }
                  }}
                  disabled={isPublishing}
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.75rem',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                  required
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleVerifyParent}
                  disabled={isVerifying || isPublishing || !cleanParentId}
                  style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  {isVerifying ? 'Checking...' : 'Verify'}
                </button>
              </div>

              {/* Verified Parent indicator */}
              {verifiedParent && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>✓</span>
                  <span>Target Parent: <strong>"{verifiedParent.title}"</strong> (Space: <code>{verifiedParent.spaceKey}</code>)</span>
                </div>
              )}

              {/* Verification error */}
              {verifyError && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-red)' }}>
                  ⚠️ {verifyError}
                </div>
              )}
            </div>

            {/* Field: Page Title */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Report Page Title <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <input
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                disabled={isPublishing}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.75rem',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
                required
              />
            </div>

            {/* Figma Decks Preview List */}
            {fileDecks.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Generated Cards per Figma File in Deck:</span>
                <ul style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                  {fileDecks.map((d) => (
                    <li key={d.key}>
                      <strong>{d.name}</strong> — {d.count} components {d.changed > 0 ? `(🔴 ${d.changed} changed)` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Collapsible Collab API & Token Settings */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <span>⚙️ {showSettings ? 'Hide Collab Connection Settings' : 'Advanced Collab Connection Settings'}</span>
              </button>

              {showSettings && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                      Collab Base URL
                    </label>
                    <input
                      type="text"
                      placeholder={defaultCollabUrl}
                      value={customCollabUrl}
                      onChange={(e) => setCustomCollabUrl(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.35rem 0.6rem',
                        color: '#fff',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                      Personal Access Token (PAT) {hasServerToken ? '(Configured in .env)' : '(Required)'}
                    </label>
                    <input
                      type="password"
                      placeholder={hasServerToken ? 'Using server configured token (leave empty or override)' : 'Enter Collab PAT'}
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.35rem 0.6rem',
                        color: '#fff',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {publishError && (
              <div style={{ background: 'rgba(255, 114, 98, 0.1)', border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.8rem', fontSize: '0.82rem', color: 'var(--accent-red)' }}>
                <strong>Publish Failed:</strong> {publishError}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isPublishing}
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isPublishing || !cleanParentId}
                style={{
                  padding: '0.5rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 600
                }}
              >
                {isPublishing ? (
                  <>
                    <span className="spinner-small" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                    <span>Publishing Decks &amp; Snapshots...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Publish to Collab</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
