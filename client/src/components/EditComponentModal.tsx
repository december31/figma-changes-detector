// client/src/components/EditComponentModal.tsx
import React, { useState, useEffect } from 'react';
import { Component, UpdateComponentPayload } from '../types';
import { parseFigmaUrl } from '../utils';

interface EditComponentModalProps {
  isOpen: boolean;
  component: Component | null;
  folders?: string[];
  onClose: () => void;
  onSave: (id: number, payload: UpdateComponentPayload) => Promise<void>;
}

export const EditComponentModal: React.FC<EditComponentModalProps> = ({
  isOpen,
  component,
  folders = [],
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [format, setFormat] = useState('png');
  const [scale, setScale] = useState('2');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (component) {
      setName(component.name || '');
      setFileName(component.file_name || '');
      setFolderPath(component.folder_path || '');
      setFileKey(component.file_key || '');
      setNodeId(component.node_id || '');
      setFormat(component.format || 'png');
      setScale(String(component.scale || 2));
      setFigmaUrl(component.figma_url || '');
      setErrorBanner(null);
    }
  }, [component, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !component) return null;

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFigmaUrl(val);
    const parsed = parseFigmaUrl(val);
    if (parsed) {
      if (parsed.fileKey) setFileKey(parsed.fileKey);
      if (parsed.nodeId) setNodeId(parsed.nodeId);
      if (parsed.fileName) {
        setFileName(parsed.fileName);
      }
      setErrorBanner(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorBanner('Component Label is required.');
      return;
    }
    if (!fileKey.trim() || !nodeId.trim()) {
      setErrorBanner('Both File Key and Node ID are required.');
      return;
    }

    setIsSaving(true);
    setErrorBanner(null);
    try {
      await onSave(component.id, {
        name: name.trim(),
        fileKey: fileKey.trim(),
        fileName: fileName.trim(),
        nodeId: nodeId.trim(),
        format,
        scale: Number(scale) || 2,
        figmaUrl: figmaUrl.trim(),
        folderPath: folderPath.trim()
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBanner(msg || 'Failed to update component.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="editModal" className="modal">
      <div className="modal-backdrop" id="editModalBackdrop" onClick={onClose} />
      <div className="modal-dialog">
        <div className="modal-dialog-header">
          <div className="modal-dialog-title">
            <h2>Edit Tracked Component</h2>
            <p className="subtitle">Update details in your SQLite watchlist</p>
          </div>
          <button
            type="button"
            id="editModalCloseBtn"
            className="modal-dialog-close"
            title="Close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <form id="editComponentForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="editFigmaUrl">Paste Figma Link (Auto-fills File &amp; Node)</label>
            <input
              type="url"
              id="editFigmaUrl"
              value={figmaUrl}
              onChange={handleUrlChange}
              placeholder="https://www.figma.com/design/:file_key/:name?node-id=123-456"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editFileName">
              <span>File</span>
              <span className="badge-immutable">Immutable</span>
            </label>
            <input
              type="text"
              id="editFileName"
              value={fileName}
              readOnly
              tabIndex={-1}
              placeholder="Auto-detected from Figma link"
              className="input-immutable"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editFolderPath">Folder / Subfolder (e.g. Design System/Buttons)</label>
            <input
              type="text"
              id="editFolderPath"
              list="editFolderOptions"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="e.g. Design System/Buttons (or empty for root)"
            />
            {folders && folders.length > 0 && (
              <datalist id="editFolderOptions">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="editCompName">
              Component Label <span className="required">*</span>
            </label>
            <input
              type="text"
              id="editCompName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary CTA Button"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="editFileKey">
                File Key <span className="required">*</span>
              </label>
              <input
                type="text"
                id="editFileKey"
                value={fileKey}
                onChange={(e) => setFileKey(e.target.value)}
                placeholder="e.g. AbC123XyZ"
                required
              />
            </div>
            <div className="form-group col">
              <label htmlFor="editNodeId">
                Node ID <span className="required">*</span>
              </label>
              <input
                type="text"
                id="editNodeId"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                placeholder="e.g. 1:2 or 1-2"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group col">
              <label htmlFor="editRenderFormat">Format</label>
              <select
                id="editRenderFormat"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="png">PNG (Pixel Diff Enabled)</option>
                <option value="svg">SVG (Vector)</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
            <div className="form-group col">
              <label htmlFor="editRenderScale">Scale</label>
              <select
                id="editRenderScale"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
              >
                <option value="1">1x</option>
                <option value="2">2x (Retina)</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>
            </div>
          </div>

          {errorBanner && (
            <div id="editErrorBanner" className="alert alert-error">
              {errorBanner}
            </div>
          )}

          <div className="modal-dialog-footer">
            <button
              type="button"
              id="cancelEditBtn"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="saveEditBtn"
              className="btn-primary"
              disabled={isSaving}
            >
              <span className="btn-text-content">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </span>
              <span className={`btn-spinner ${isSaving ? '' : 'hidden'}`}></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
