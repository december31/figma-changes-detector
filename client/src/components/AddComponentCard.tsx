// client/src/components/AddComponentCard.tsx
import React, { useState } from 'react';
import { parseFigmaUrl } from '../utils';

interface AddComponentCardProps {
  onFetchNow: (formData: {
    fileKey: string;
    fileName?: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
    folderPath?: string;
  }) => Promise<void>;
  onAddToWatchlist: (formData: {
    fileKey: string;
    fileName?: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
    folderPath?: string;
  }) => Promise<void>;
  isFetching: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onClearBanners: () => void;
  initialValues?: {
    fileKey?: string;
    fileName?: string;
    nodeId?: string;
    name?: string;
    format?: string;
    scale?: number;
    folderPath?: string;
  };
}

export const AddComponentCard: React.FC<AddComponentCardProps> = ({
  onFetchNow,
  onAddToWatchlist,
  isFetching,
  errorMessage,
  infoMessage,
  onClearBanners,
  initialValues
}) => {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [fileName, setFileName] = useState(initialValues?.fileName || '');
  const [compCustomName, setCompCustomName] = useState(initialValues?.name || '');
  const [fileKey, setFileKey] = useState(initialValues?.fileKey || '');
  const [nodeId, setNodeId] = useState(initialValues?.nodeId || '');
  const [renderFormat, setRenderFormat] = useState(initialValues?.format || 'png');
  const [renderScale, setRenderScale] = useState(String(initialValues?.scale || 2));
  const [localError, setLocalError] = useState<string | null>(null);

  // Update fields when initialValues change from external selection
  React.useEffect(() => {
    if (initialValues) {
      if (initialValues.fileKey !== undefined) setFileKey(initialValues.fileKey);
      if (initialValues.fileName !== undefined) setFileName(initialValues.fileName);
      if (initialValues.nodeId !== undefined) setNodeId(initialValues.nodeId);
      if (initialValues.name !== undefined) setCompCustomName(initialValues.name);
      if (initialValues.format !== undefined) setRenderFormat(initialValues.format);
      if (initialValues.scale !== undefined) setRenderScale(String(initialValues.scale));
    }
  }, [initialValues]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFigmaUrl(val);
    setLocalError(null);
    const parsed = parseFigmaUrl(val);
    if (parsed) {
      if (parsed.fileKey) setFileKey(parsed.fileKey);
      if (parsed.nodeId) setNodeId(parsed.nodeId);
      if (parsed.fileName) {
        setFileName(parsed.fileName);
      }
      onClearBanners();
    }
  };

  const handleFetchClick = () => {
    if (!compCustomName.trim()) {
      setLocalError('Component Label is required.');
      return;
    }
    if (!fileKey.trim() || !nodeId.trim()) {
      setLocalError('Please paste a valid Figma link (auto-fills File & Node).');
      return;
    }
    setLocalError(null);
    onFetchNow({
      fileKey: fileKey.trim(),
      fileName: fileName.trim(),
      nodeId: nodeId.trim(),
      name: compCustomName.trim(),
      format: renderFormat,
      scale: Number(renderScale) || 2,
      figmaUrl: figmaUrl.trim(),
      folderPath: fileName.trim() || 'Figma Document'
    });
  };

  const handleAddClick = () => {
    if (!compCustomName.trim()) {
      setLocalError('Component Label is required.');
      return;
    }
    if (!fileKey.trim() || !nodeId.trim()) {
      setLocalError('Please paste a valid Figma link (auto-fills File & Node).');
      return;
    }
    setLocalError(null);
    onAddToWatchlist({
      fileKey: fileKey.trim(),
      fileName: fileName.trim(),
      nodeId: nodeId.trim(),
      name: compCustomName.trim(),
      format: renderFormat,
      scale: Number(renderScale) || 2,
      figmaUrl: figmaUrl.trim(),
      folderPath: fileName.trim() || 'Figma Document'
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="step-num">2</span>
        <h2>Add / Fetch Component</h2>
      </div>

      <div className="form-group">
        <label htmlFor="figmaUrl">Paste Figma Link (Auto-fills File &amp; Node)</label>
        <input
          type="url"
          id="figmaUrl"
          value={figmaUrl}
          onChange={handleUrlChange}
          placeholder="https://www.figma.com/design/:file_key/:name?node-id=123-456"
        />
      </div>

      <div className="form-group">
        <label htmlFor="compFileName">
          <span>File</span>
          <span className="badge-immutable">Immutable</span>
        </label>
        <input
          type="text"
          id="compFileName"
          value={fileName}
          readOnly
          tabIndex={-1}
          placeholder="Auto-detected from Figma link"
          className="input-immutable"
        />
        <div
          className="field-meta-info"
          style={{
            marginTop: '0.4rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.35rem'
          }}
        >
          {fileKey || nodeId ? (
            <>
              <span>
                File Key: <code style={{ color: 'var(--text-main)', fontSize: '0.76rem' }}>{fileKey || '—'}</code>
              </span>
              <span style={{ opacity: 0.5 }}>•</span>
              <span>
                Node ID: <code style={{ color: 'var(--text-main)', fontSize: '0.76rem' }}>{nodeId || '—'}</code>
              </span>
            </>
          ) : (
            <span>Auto-detected from Figma link: <code>File Key</code> &bull; <code>Node ID</code></span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="compCustomName">
          Component Label <span className="required">*</span>
        </label>
        <input
          type="text"
          id="compCustomName"
          value={compCustomName}
          onChange={(e) => {
            setCompCustomName(e.target.value);
            setLocalError(null);
          }}
          placeholder="e.g. Primary CTA Button"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="renderFormat">Format</label>
          <select
            id="renderFormat"
            value={renderFormat}
            onChange={(e) => setRenderFormat(e.target.value)}
          >
            <option value="png">PNG (Pixel Diff Enabled)</option>
            <option value="svg">SVG (Vector)</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        <div className="form-group col">
          <label htmlFor="renderScale">Scale</label>
          <select
            id="renderScale"
            value={renderScale}
            onChange={(e) => setRenderScale(e.target.value)}
          >
            <option value="1">1x</option>
            <option value="2">2x (Retina)</option>
            <option value="3">3x</option>
            <option value="4">4x</option>
          </select>
        </div>
      </div>

      <div className="button-group-row">
        <button
          type="button"
          id="fetchImageBtn"
          className="btn-primary"
          onClick={handleFetchClick}
          disabled={isFetching}
        >
          <span className="btn-text-content">
            {isFetching ? 'Fetching & Comparing...' : 'Fetch & Check Changes Now'}
          </span>
          <span className={`btn-spinner ${isFetching ? '' : 'hidden'}`}></span>
        </button>
        <button
          type="button"
          id="addToWatchlistBtn"
          className="btn-secondary"
          title="Save component to SQLite watchlist for 1-click checking later"
          onClick={handleAddClick}
          disabled={isFetching}
        >
          + Save to Watchlist
        </button>
      </div>

      {(localError || errorMessage) && (
        <div id="errorBanner" className="alert alert-error">
          {localError || errorMessage}
        </div>
      )}
      {infoMessage && <div id="infoBanner" className="alert alert-info">{infoMessage}</div>}
    </div>
  );
};
