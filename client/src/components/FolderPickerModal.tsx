// client/src/components/FolderPickerModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { normalizeFolderPath } from '../utils';
import * as api from '../services/api';

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  currentFolderPath?: string;
  existingFolders?: string[];
  onSelectFolder: (folderPath: string) => void | Promise<void>;
  onCreateFolder?: (folderPath: string) => Promise<void>;
  onDeleteFolder?: (folderPath: string) => Promise<void>;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  currentFolderPath = '',
  existingFolders = [],
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>(currentFolderPath);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanFileName = (fileName || '').trim();

  // Find canonical root folder for this Figma file
  const rootFolderName = useMemo(() => {
    if (!cleanFileName) return '';
    const match = existingFolders.find(
      (f) => f.split('/')[0].toLowerCase() === cleanFileName.toLowerCase()
    );
    return match ? match.split('/')[0] : cleanFileName;
  }, [cleanFileName, existingFolders]);

  // Find all folders belonging to this Figma file
  const fileFolders = useMemo(() => {
    if (!rootFolderName) return [];
    const rootLower = rootFolderName.toLowerCase();

    // Include subfolders belonging to this file root
    const matched = existingFolders.filter((f) => {
      const lower = f.toLowerCase();
      return lower === rootLower || lower.startsWith(rootLower + '/');
    });

    // Make sure root folder is included
    if (!matched.some((f) => f.toLowerCase() === rootLower)) {
      matched.unshift(rootFolderName);
    }

    return Array.from(new Set(matched)).sort((a, b) => a.localeCompare(b));
  }, [rootFolderName, existingFolders]);

  // Subfolders relative to file root
  const subfolders = useMemo(() => {
    if (!rootFolderName) return [];
    const rootLower = rootFolderName.toLowerCase();
    return fileFolders
      .filter((f) => f.toLowerCase() !== rootLower && f.toLowerCase().startsWith(rootLower + '/'))
      .map((f) => ({
        fullPath: f,
        relPath: f.slice(rootFolderName.length + 1),
        depth: f.slice(rootFolderName.length + 1).split('/').length
      }));
  }, [rootFolderName, fileFolders]);

  // Reset state when modal opens or root changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSearchFilter('');
      setNewFolderName('');
      setSelectedParent(rootFolderName);
      setSelectedFolder(currentFolderPath);
    }
  }, [isOpen, rootFolderName, currentFolderPath]);

  if (!isOpen) return null;

  // Filtered subfolders by search
  const filteredSubfolders = subfolders.filter((sf) =>
    sf.relPath.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  const normalizedCurrent = normalizeFolderPath(selectedFolder);
  const isRootSelected =
    !normalizedCurrent ||
    normalizedCurrent.toLowerCase() === rootFolderName.toLowerCase();

  const handleSelect = async (path: string) => {
    try {
      setSelectedFolder(path);
      await onSelectFolder(path);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSubfolder = async (fullPath: string, relPath: string) => {
    setErrorMsg(null);
    if (!fullPath || fullPath.toLowerCase() === rootFolderName.toLowerCase() || !fullPath.includes('/')) {
      setErrorMsg('The root folder cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete subfolder "${relPath}"?`);
    if (!confirmed) return;

    setIsDeleting(fullPath);
    try {
      if (onDeleteFolder) {
        await onDeleteFolder(fullPath);
      } else {
        await api.deleteFolder(fullPath, false);
      }

      // If the currently selected folder was or was inside the deleted folder, reset to root
      const normDeleted = normalizeFolderPath(fullPath).toLowerCase();
      const normSelected = normalizeFolderPath(selectedFolder).toLowerCase();
      if (normSelected === normDeleted || normSelected.startsWith(normDeleted + '/')) {
        setSelectedFolder(rootFolderName);
        await onSelectFolder(rootFolderName);
      }

      // If parent select for creation was inside deleted folder, reset to root
      if (selectedParent.toLowerCase() === normDeleted || selectedParent.toLowerCase().startsWith(normDeleted + '/')) {
        setSelectedParent(rootFolderName);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = newFolderName.trim();
    if (!name) {
      setErrorMsg('Please enter a folder name.');
      return;
    }

    // Clean slashes from user input
    const cleanName = name
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('/');

    if (!cleanName) {
      setErrorMsg('Please enter a valid folder name.');
      return;
    }

    const baseParent = selectedParent ? selectedParent.trim() : rootFolderName;
    const fullPath = `${baseParent}/${cleanName}`;

    setIsCreating(true);
    try {
      if (onCreateFolder) {
        await onCreateFolder(fullPath);
      }
      setSelectedFolder(fullPath);
      // Immediately select the created folder
      await onSelectFolder(fullPath);
      setNewFolderName('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog folder-picker-dialog">
        <div className="modal-dialog-header">
          <div className="modal-dialog-title">
            <h2>📁 Component Folder</h2>
          </div>
          <button
            type="button"
            className="modal-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Warning if no Figma file is detected */}
        {!cleanFileName ? (
          <div className="folder-picker-empty-state">
            <div className="folder-picker-warning-icon">⚠️</div>
            <h3>No Figma File Detected Yet</h3>
            <p>
              Every folder belongs to the Figma file containing this component.
              Please paste a Figma URL first so the file name can be detected.
            </p>
            <div className="modal-dialog-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="folder-picker-body">
            {errorMsg && (
              <div className="banner banner-error" style={{ margin: '0.5rem 0' }}>
                {errorMsg}
              </div>
            )}

            {/* Choose Existing Folder Section */}
            <div className="folder-picker-section">
              <div className="folder-picker-section-header">
                <h3>Choose Folder</h3>
                {subfolders.length > 4 && (
                  <div className="folder-picker-search">
                    <input
                      type="text"
                      placeholder="Search subfolders..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="folder-picker-list">
                {/* File Root Option */}
                <div
                  className={`folder-picker-item ${isRootSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(rootFolderName)}
                >
                  <div className="folder-picker-item-left">
                    <span className="folder-icon">📁</span>
                    <div className="folder-picker-item-info">
                      <span className="folder-picker-name">{rootFolderName}</span>
                      <span className="folder-picker-badge-root">Root of File</span>
                    </div>
                  </div>
                  <div className="folder-picker-item-right">
                    {isRootSelected ? (
                      <span className="folder-picker-selected-tag">✓ Selected</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-mini btn-folder-select"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(rootFolderName);
                        }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>

                {/* Subfolders Options */}
                {filteredSubfolders.map((sf) => {
                  const isSelected =
                    normalizedCurrent.toLowerCase() === sf.fullPath.toLowerCase();

                  return (
                    <div
                      key={sf.fullPath}
                      className={`folder-picker-item subfolder ${isSelected ? 'active' : ''}`}
                      style={{ paddingLeft: `${Math.max(sf.depth * 14 + 8, 12)}px` }}
                      onClick={() => handleSelect(sf.fullPath)}
                    >
                      <div className="folder-picker-item-left">
                        <span className="folder-icon">📂</span>
                        <div className="folder-picker-item-info">
                          <span className="folder-picker-name">{sf.relPath}</span>
                        </div>
                      </div>
                      <div className="folder-picker-item-right">
                        {isSelected ? (
                          <span className="folder-picker-selected-tag">✓ Selected</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-mini btn-folder-select"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(sf.fullPath);
                            }}
                          >
                            Select
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-mini btn-folder-sub"
                          title={`Create subfolder inside ${sf.relPath}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParent(sf.fullPath);
                            const inputEl = document.getElementById('newFolderInput');
                            if (inputEl) inputEl.focus();
                          }}
                        >
                          + Sub
                        </button>
                        <button
                          type="button"
                          className="btn-mini btn-folder-delete"
                          title={`Delete subfolder "${sf.relPath}"`}
                          disabled={isDeleting === sf.fullPath}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubfolder(sf.fullPath, sf.relPath);
                          }}
                        >
                          {isDeleting === sf.fullPath ? '...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {subfolders.length === 0 && (
                  <div className="folder-picker-empty-note">
                    No subfolders yet in <strong>{rootFolderName}</strong>. Create one below!
                  </div>
                )}
                {subfolders.length > 0 && filteredSubfolders.length === 0 && (
                  <div className="folder-picker-empty-note">
                    No subfolders matching &quot;{searchFilter}&quot;.
                  </div>
                )}
              </div>
            </div>

            {/* Create New Folder Section */}
            <form onSubmit={handleCreateSubmit} className="folder-create-section">
              <div className="folder-create-header">
                <h3>📁+ Create New Folder in File</h3>
              </div>

              <div className="form-group">
                <label htmlFor="folderParentSelect">Parent Folder</label>
                <select
                  id="folderParentSelect"
                  value={selectedParent}
                  onChange={(e) => setSelectedParent(e.target.value)}
                >
                  <option value={rootFolderName}>
                    {rootFolderName} (File Root)
                  </option>
                  {subfolders.map((sf) => (
                    <option key={sf.fullPath} value={sf.fullPath}>
                      {rootFolderName} / {sf.relPath}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="newFolderInput">New Folder Name</label>
                <div className="input-with-button">
                  <input
                    type="text"
                    id="newFolderInput"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. Buttons or Inputs/Dropdowns"
                    disabled={isCreating}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isCreating || !newFolderName.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>

              {newFolderName.trim() && (
                <div className="folder-path-preview">
                  <span className="preview-label">Full path:</span>{' '}
                  <code>
                    {selectedParent || rootFolderName}/
                    {newFolderName
                      .split('/')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .join('/')}
                  </code>
                </div>
              )}
            </form>

            <div className="modal-dialog-footer folder-picker-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
