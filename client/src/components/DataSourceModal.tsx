// client/src/components/DataSourceModal.tsx
import React, { useState, useRef } from 'react';
import { DataSource } from '../types';
import * as api from '../services/api';

interface DataSourceModalProps {
  isOpen: boolean;
  datasources: DataSource[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSwitch: (id: string) => Promise<void>;
}

export const DataSourceModal: React.FC<DataSourceModalProps> = ({
  isOpen,
  datasources,
  onClose,
  onRefresh,
  onSwitch
}) => {
  const [newDsName, setNewDsName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDsName.trim()) return;

    setErrorMsg(null);
    setInfoMsg(null);
    setIsCreating(true);
    try {
      const created = await api.createDataSource(newDsName.trim());
      setNewDsName('');
      setInfoMsg(`Workspace "${created.name}" created and activated.`);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitch = async (id: string) => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await onSwitch(id);
      setInfoMsg('Switched workspace successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to switch workspace.');
    }
  };

  const handleDelete = async (ds: DataSource) => {
    if (ds.isActive) {
      setErrorMsg('Cannot delete the currently active workspace. Please switch to another first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete workspace "${ds.name}" and all its stored snapshots? This cannot be undone.`)) {
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await api.deleteDataSource(ds.id);
      setInfoMsg(`Deleted workspace "${ds.name}".`);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete workspace.');
    }
  };

  const startRename = (ds: DataSource) => {
    setEditingId(ds.id);
    setEditingName(ds.name);
  };

  const saveRename = async (id: string) => {
    if (!editingName.trim()) return;
    setErrorMsg(null);
    try {
      await api.renameDataSource(id, editingName.trim());
      setEditingId(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rename workspace.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setErrorMsg('Please select a valid .zip workspace bundle.');
      return;
    }

    setErrorMsg(null);
    setInfoMsg('Uploading and extracting workspace bundle...');
    setIsImporting(true);

    try {
      const imported = await api.importDataSource(file);
      setInfoMsg(`Successfully imported and switched to workspace "${imported.name}"!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import workspace archive.');
    } finally {
      setIsImporting(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="modal" style={{ zIndex: 1000 }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="modal-dialog"
        style={{ maxWidth: '680px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-dialog-header">
          <div className="modal-dialog-title">
            <h2>Workspaces &amp; DataSources</h2>
            <p className="subtitle">Manage isolated SQLite databases, snapshot archives, and export/import packages</p>
          </div>
          <button type="button" className="modal-dialog-close" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {errorMsg && (
          <div style={{ margin: '0.75rem 1.25rem 0', padding: '0.75rem 1rem', background: 'rgba(255, 114, 98, 0.15)', color: 'var(--accent-red)', border: '1px solid rgba(255, 114, 98, 0.3)', borderRadius: '6px', fontSize: '0.875rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div style={{ margin: '0.75rem 1.25rem 0', padding: '0.75rem 1rem', background: 'rgba(10, 207, 131, 0.15)', color: 'var(--accent-green)', border: '1px solid rgba(10, 207, 131, 0.3)', borderRadius: '6px', fontSize: '0.875rem' }}>
            ✓ {infoMsg}
          </div>
        )}

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Workspaces List */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Available Workspaces ({datasources.length})
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {datasources.map((ds) => (
                <div
                  key={ds.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: ds.isActive ? 'rgba(26, 188, 254, 0.08)' : 'transparent',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {editingId === ds.id ? (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveRename(ds.id)}
                            autoFocus
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem', borderRadius: '4px', border: '1px solid var(--accent-blue)', background: 'var(--bg-input)', color: 'var(--text-main)', width: '100%' }}
                          />
                          <button type="button" className="btn-pill" onClick={() => saveRename(ds.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Save</button>
                          <button type="button" className="btn-pill" onClick={() => setEditingId(null)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main, #fff)' }}>
                            {ds.name}
                          </span>
                          {ds.isActive && (
                            <span style={{ background: 'var(--accent-green, #0acf83)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '12px' }}>
                              ACTIVE
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startRename(ds)}
                            title="Rename"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0.2rem', fontSize: '0.8rem' }}
                          >
                            ✎
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {formatBytes(ds.sizeBytes)} • Created {new Date(ds.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    {!ds.isActive && (
                      <button
                        type="button"
                        className="btn-pill"
                        onClick={() => handleSwitch(ds.id)}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', background: '#1abcfe', color: '#fff' }}
                      >
                        Switch
                      </button>
                    )}
                    <a
                      href={api.getDataSourceExportUrl(ds.id)}
                      download
                      className="btn-pill"
                      title="Download complete .zip bundle (data.db + images)"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      ⬇ Export .zip
                    </a>
                    {!ds.isActive && datasources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(ds)}
                        title="Delete Workspace"
                        style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', padding: '0.3rem', fontSize: '0.9rem' }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Create New Workspace */}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="New Workspace Name..."
              value={newDsName}
              onChange={(e) => setNewDsName(e.target.value)}
              disabled={isCreating}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
            <button
              type="submit"
              disabled={isCreating || !newDsName.trim()}
              className="btn-primary"
              style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
            >
              {isCreating ? 'Creating...' : '＋ New Workspace'}
            </button>
          </form>

          {/* Import Workspace Bundle */}
          <div style={{ padding: '1rem', border: '2px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📦</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
              Import Workspace (.zip)
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
              Upload an exported <code>.zip</code> bundle containing <code>data.db</code> and snapshot assets. It will become a new workspace.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isImporting}
            />
            <button
              type="button"
              className="btn-pill"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              style={{ padding: '0.45rem 1rem', fontWeight: 600 }}
            >
              {isImporting ? '⏳ Importing...' : '📁 Select .zip File to Import'}
            </button>
          </div>
        </div>

        <div className="modal-dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1.25rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
