// client/src/components/AddComponentCard.tsx
import React, { useState } from 'react';
import { parseFigmaUrl } from '../utils';

interface AddComponentCardProps {
  onFetchNow: (formData: {
    fileKey: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
  }) => Promise<void>;
  onAddToWatchlist: (formData: {
    fileKey: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
  }) => Promise<void>;
  isFetching: boolean;
  errorMessage: string | null;
  infoMessage: string | null;
  onClearBanners: () => void;
  initialValues?: {
    fileKey?: string;
    nodeId?: string;
    name?: string;
    format?: string;
    scale?: number;
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
  const [compCustomName, setCompCustomName] = useState(initialValues?.name || '');
  const [fileKey, setFileKey] = useState(initialValues?.fileKey || '');
  const [nodeId, setNodeId] = useState(initialValues?.nodeId || '');
  const [renderFormat, setRenderFormat] = useState(initialValues?.format || 'png');
  const [renderScale, setRenderScale] = useState(String(initialValues?.scale || 2));

  // Update fields when initialValues change from external selection
  React.useEffect(() => {
    if (initialValues) {
      if (initialValues.fileKey !== undefined) setFileKey(initialValues.fileKey);
      if (initialValues.nodeId !== undefined) setNodeId(initialValues.nodeId);
      if (initialValues.name !== undefined) setCompCustomName(initialValues.name);
      if (initialValues.format !== undefined) setRenderFormat(initialValues.format);
      if (initialValues.scale !== undefined) setRenderScale(String(initialValues.scale));
    }
  }, [initialValues]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFigmaUrl(val);
    const parsed = parseFigmaUrl(val);
    if (parsed) {
      if (parsed.fileKey) setFileKey(parsed.fileKey);
      if (parsed.nodeId) setNodeId(parsed.nodeId);
      onClearBanners();
    }
  };

  const handleFetchClick = () => {
    onFetchNow({
      fileKey: fileKey.trim(),
      nodeId: nodeId.trim(),
      name: compCustomName.trim(),
      format: renderFormat,
      scale: Number(renderScale) || 2,
      figmaUrl: figmaUrl.trim()
    });
  };

  const handleAddClick = () => {
    onAddToWatchlist({
      fileKey: fileKey.trim(),
      nodeId: nodeId.trim(),
      name: compCustomName.trim(),
      format: renderFormat,
      scale: Number(renderScale) || 2,
      figmaUrl: figmaUrl.trim()
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
        <label htmlFor="compCustomName">Component Label (Optional)</label>
        <input
          type="text"
          id="compCustomName"
          value={compCustomName}
          onChange={(e) => setCompCustomName(e.target.value)}
          placeholder="e.g. Primary CTA Button (auto-detected if blank)"
        />
      </div>

      <div className="form-row">
        <div className="form-group col">
          <label htmlFor="fileKey">
            File Key <span className="required">*</span>
          </label>
          <input
            type="text"
            id="fileKey"
            value={fileKey}
            onChange={(e) => setFileKey(e.target.value)}
            placeholder="e.g. AbC123XyZ"
          />
        </div>
        <div className="form-group col">
          <label htmlFor="nodeId">
            Node ID <span className="required">*</span>
          </label>
          <input
            type="text"
            id="nodeId"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            placeholder="e.g. 1:2 or 1-2"
          />
        </div>
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

      {errorMessage && <div id="errorBanner" className="alert alert-error">{errorMessage}</div>}
      {infoMessage && <div id="infoBanner" className="alert alert-info">{infoMessage}</div>}
    </div>
  );
};
