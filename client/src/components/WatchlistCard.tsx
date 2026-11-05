// client/src/components/WatchlistCard.tsx
import React, { useState, useMemo } from 'react';
import { Component, BatchResultItem, BatchSummary, TransientStatus, FolderTreeNode } from '../types';
import { ComponentItem } from './ComponentItem';
import { FolderPickerModal } from './FolderPickerModal';
import { getStatusPillMeta, buildComponentTree, filterTree, getFolderComponentIds } from '../utils';

interface WatchlistCardProps {
  components: Component[];
  activeComponentId: number | null;
  transientStatuses: Map<number, TransientStatus>;
  folders?: string[];
  isBatchChecking: boolean;
  batchSummary: BatchSummary | null;
  batchResults: BatchResultItem[] | null;
  onClearBatchResults: () => void;
  onCheckAll: () => void;
  onCheckFolder?: (componentIds: number[]) => void;
  onCreateFolder?: (path: string) => Promise<void>;
  onRenameFolder?: (oldPath: string, newPath: string) => Promise<void>;
  onDeleteFolder?: (path: string, deleteComponents: boolean) => Promise<void>;
  onSelectFolderForAdd?: (folderPath: string) => void;
  onSelectComponent: (comp: Component) => void;
  onInspectComponent: (comp: Component) => void;
  onFetchComponent: (comp: Component) => void;
  onEditComponent: (comp: Component) => void;
  onDeleteComponent: (comp: Component) => void;
  onInspectBatchItem: (item: BatchResultItem) => void;
  onUpdateComponentFolder?: (id: number, folderPath: string) => Promise<void>;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = ({
  components,
  activeComponentId,
  transientStatuses,
  folders = [],
  isBatchChecking,
  batchSummary,
  batchResults,
  onClearBatchResults,
  onCheckAll,
  onCheckFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectFolderForAdd,
  onSelectComponent,
  onInspectComponent,
  onFetchComponent,
  onEditComponent,
  onDeleteComponent,
  onInspectBatchItem,
  onUpdateComponentFolder
}) => {
  // Tree state
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPickerComp, setFolderPickerComp] = useState<Component | null>(null);

  // Folder modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFolderPath, setCreateFolderPath] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [deleteWithComponents, setDeleteWithComponents] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Build raw tree
  const rawTree = useMemo(() => {
    return buildComponentTree(components, folders);
  }, [components, folders]);

  // Set of canonical root folders (Figma file names)
  const rootFolderNames = useMemo(() => {
    const names = new Set<string>();
    components.forEach((c) => {
      if (c.file_name && c.file_name.trim()) {
        names.add(c.file_name.trim().toLowerCase());
      }
      if (c.folder_path && c.folder_path.trim()) {
        const rootSegment = c.folder_path.trim().split('/')[0].toLowerCase();
        if (rootSegment) names.add(rootSegment);
      }
    });
    return names;
  }, [components]);

  const isPathRootFolder = (path: string) => {
    const clean = path.trim();
    if (!clean) return false;
    if (!clean.includes('/')) return true;
    const firstSegment = clean.split('/')[0].toLowerCase();
    if (clean.toLowerCase() === firstSegment || rootFolderNames.has(clean.toLowerCase())) {
      return true;
    }
    return false;
  };

  // Apply search filtering
  const { tree: displayTree } = useMemo(() => {
    return filterTree(rawTree, searchQuery);
  }, [rawTree, searchQuery]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedFolders(new Set());
  };

  const collapseAll = () => {
    const all = new Set<string>();
    const collect = (node: FolderTreeNode) => {
      all.add(node.path);
      node.subfolders.forEach(collect);
    };
    rawTree.folders.forEach(collect);
    setCollapsedFolders(all);
  };

  // Folder modal triggers
  const handleOpenCreate = (parentPath = '') => {
    setCreateFolderPath(parentPath ? `${parentPath}/` : '');
    setModalError(null);
    setIsCreateOpen(true);
  };

  const handleOpenRename = (path: string) => {
    setRenamingFolder(path);
    setNewFolderName(path);
    setModalError(null);
  };

  const handleOpenDelete = (path: string) => {
    if (isPathRootFolder(path)) return;
    setDeletingFolder(path);
    setDeleteWithComponents(false);
    setModalError(null);
  };

  // Modal submissions
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFolderPath.trim()) {
      setModalError('Please enter a folder path.');
      return;
    }
    if (!onCreateFolder) return;
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await onCreateFolder(createFolderPath.trim());
      setIsCreateOpen(false);
      setCreateFolderPath('');
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFolder || !newFolderName.trim()) {
      setModalError('Please enter a new folder path.');
      return;
    }
    if (!onRenameFolder) return;
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await onRenameFolder(renamingFolder, newFolderName.trim());
      setRenamingFolder(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingFolder || !onDeleteFolder) return;
    if (isPathRootFolder(deletingFolder)) {
      setModalError('The root folder for this Figma file cannot be deleted.');
      return;
    }
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await onDeleteFolder(deletingFolder, deleteWithComponents);
      setDeletingFolder(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Recursive tree node renderer
  const renderFolderNode = (node: FolderTreeNode) => {
    const isSearching = searchQuery.trim().length > 0;
    // When searching, matching folders stay expanded automatically
    const isCollapsed = isSearching ? false : collapsedFolders.has(node.path);
    const isRootFolder = node.depth === 0 || isPathRootFolder(node.path);

    return (
      <div key={node.path} className="folder-tree-node">
        <div
          className="folder-row"
          style={{ paddingLeft: `${node.depth * 14 + 10}px` }}
          onClick={() => toggleFolder(node.path)}
        >
          <div className="folder-header-left">
            <button
              type="button"
              className="folder-toggle-btn"
              title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.path);
              }}
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
            <span className="folder-icon">{isCollapsed ? '📁' : '📂'}</span>
            <span className="folder-name" title={node.path}>
              {node.name}
            </span>
            <span className="folder-count-badge" title={`${node.totalComponentCount} component(s)`}>
              {node.totalComponentCount}
            </span>
          </div>

          <div
            className="folder-header-right"
            onClick={(e) => e.stopPropagation()}
          >
            {onCheckFolder && node.totalComponentCount > 0 && (
              <button
                type="button"
                className="btn-mini folder-action-btn"
                title={`Check all ${node.totalComponentCount} component(s) in this folder`}
                disabled={isBatchChecking}
                onClick={() => {
                  const compIds = getFolderComponentIds(node);
                  onCheckFolder(compIds);
                }}
              >
                ⚡ Check
              </button>
            )}

            {onSelectFolderForAdd && (
              <button
                type="button"
                className="btn-mini folder-action-btn"
                title="Add new component to this folder"
                onClick={() => onSelectFolderForAdd(node.path)}
              >
                ➕ Add
              </button>
            )}

            <button
              type="button"
              className="btn-mini folder-action-btn"
              title="Create subfolder inside this folder"
              onClick={() => handleOpenCreate(node.path)}
            >
              📁+ Sub
            </button>

            <button
              type="button"
              className="btn-mini folder-action-btn"
              title="Rename folder"
              onClick={() => handleOpenRename(node.path)}
            >
              ✎
            </button>

            {!isRootFolder && (
              <button
                type="button"
                className="btn-mini folder-action-btn delete-btn"
                title="Delete folder"
                onClick={() => handleOpenDelete(node.path)}
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <div className="folder-children">
            {node.subfolders.map(renderFolderNode)}
            {node.components.map((comp) => (
              <ComponentItem
                key={comp.id}
                component={comp}
                depth={node.depth + 1}
                isActive={comp.id === activeComponentId}
                transientStatus={transientStatuses.get(comp.id)}
                onSelect={onSelectComponent}
                onInspect={onInspectComponent}
                onFetch={onFetchComponent}
                onEdit={onEditComponent}
                onDelete={onDeleteComponent}
                onChangeFolder={setFolderPickerComp}
              />
            ))}
            {node.components.length === 0 && node.subfolders.length === 0 && (
              <div
                className="folder-empty-note"
                style={{ paddingLeft: `${(node.depth + 1) * 14 + 14}px` }}
              >
                Empty folder &bull; Click <strong>➕ Add</strong> or <strong>📁+ Sub</strong>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAnyFolders = rawTree.folders.length > 0;

  return (
    <div className="card">
      <div className="card-header space-between">
        <div className="header-title-group">
          <span className="step-num">3</span>
          <h2>Tracked Components Watchlist</h2>
        </div>
        <span id="watchlistCountBadge" className="count-pill">
          {components.length}
        </span>
      </div>
      <p className="section-desc">
        Organized in tree folders. Click <strong>Check All</strong> anytime to fetch new images into{' '}
        <code>/assets</code> and compare against previous fetches.
      </p>

      <button
        type="button"
        id="checkAllComponentsBtn"
        className="btn-batch"
        onClick={onCheckAll}
        disabled={isBatchChecking}
      >
        <span className="btn-batch-text">
          {isBatchChecking
            ? `Checking ${components.length} component(s)...`
            : '⚡ Check All Components for Changes'}
        </span>
        <span className={`btn-spinner ${isBatchChecking ? '' : 'hidden'}`}></span>
      </button>

      {/* Batch Summary */}
      {batchSummary && (
        <div id="batchSummaryBanner" className="batch-summary">
          <span>
            <strong>Batch Complete ({batchSummary.total}):</strong>
          </span>
          <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
            {batchSummary.changed} Changed
          </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
            {batchSummary.unchanged} Identical
          </span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
            {batchSummary.baseline} Baseline
          </span>
          {batchSummary.errors > 0 && (
            <span style={{ color: 'var(--accent-orange)' }}>
              {batchSummary.errors} Error(s)
            </span>
          )}
        </div>
      )}

      {/* Batch Results List */}
      {batchResults && batchResults.length > 0 && (
        <div id="batchResultsContainer" className="batch-results-container">
          <div className="batch-results-header">
            <span className="batch-results-title">Latest Batch Run Records</span>
            <button
              type="button"
              id="clearBatchResultsBtn"
              className="btn-mini"
              title="Dismiss batch records"
              onClick={onClearBatchResults}
            >
              &times; Dismiss
            </button>
          </div>
          <div id="batchResultsList" className="batch-results-list">
            {batchResults.map((resItem, idx) => {
              if (!resItem.success) {
                return (
                  <div key={idx} className="batch-result-item">
                    <div className="batch-result-left">
                      <div className="batch-result-thumb-placeholder">⚠️</div>
                      <div className="batch-result-info">
                        <div className="batch-result-title-row">
                          <span className="batch-result-name">
                            {resItem.name || `Component #${resItem.componentId}`}
                          </span>
                        </div>
                        <div className="batch-result-tag-row">
                          <span className="change-pill changed">Error</span>
                        </div>
                        <span className="batch-result-meta">
                          {resItem.error || 'Fetch failed'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              const comp = resItem.component!;
              const curr = resItem.currentFetch!;
              const statusMeta = getStatusPillMeta(curr);

              let detailNode: React.ReactNode;
              if (curr.change_status === 'unchanged') {
                detailNode = (
                  <>
                    <span className="identical-label">✓ Identical record (0% diff)</span> &bull;{' '}
                    Fetch #{curr.id}
                  </>
                );
              } else if (curr.change_status === 'changed') {
                detailNode = (
                  <>
                    <span className="changed-label">
                      ⚠️ {curr.diff_percentage}% diff ({curr.diff_pixels?.toLocaleString()} px)
                    </span>{' '}
                    &bull; Fetch #{curr.id}
                  </>
                );
              } else {
                detailNode = (
                  <>
                    <span className="baseline-label">📌 Initial baseline</span> &bull; Fetch #{curr.id}
                  </>
                );
              }

              return (
                <div key={idx} className="batch-result-item">
                  <div className="batch-result-left">
                    <img
                      src={curr.image_path}
                      className="batch-result-thumb"
                      alt={comp.name}
                    />
                    <div className="batch-result-info">
                      <div className="batch-result-title-row">
                        <span className="batch-result-name" title={comp.name}>
                          {comp.name}
                        </span>
                      </div>
                      <div className="batch-result-tag-row">
                        <span className={`change-pill ${statusMeta.cls}`}>
                          {statusMeta.text}
                        </span>
                      </div>
                      <span className="batch-result-meta">
                        Node <code>{comp.node_id}</code> &bull; {detailNode}
                      </span>
                    </div>
                  </div>
                  <div className="batch-result-actions">
                    <button
                      type="button"
                      className="btn-mini inspect-batch-btn"
                      title="Inspect this component in Fullscreen"
                      onClick={() => onInspectBatchItem(resItem)}
                    >
                      ⛶ Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tree Management Toolbar & Search */}
      <div className="watchlist-management-bar">
        <div className="watchlist-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="watchlist-search-input"
            placeholder="Search components or folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {hasAnyFolders && (
          <div className="watchlist-tools-row">
            <button
              type="button"
              className="btn-mini btn-toolbar"
              title="Expand all folders"
              onClick={expandAll}
            >
              ⊞ Expand
            </button>
            <button
              type="button"
              className="btn-mini btn-toolbar"
              title="Collapse all folders"
              onClick={collapseAll}
            >
              ⊟ Collapse
            </button>
          </div>
        )}
      </div>

      {/* Watchlist Tree Container */}
      <div id="watchlistContainer" className="watchlist-container tree-mode">
        {components.length === 0 && rawTree.folders.length === 0 ? (
          <div className="empty-state-sm">
            No components in watchlist yet. Add components above to check them with one click!
          </div>
        ) : displayTree.folders.length === 0 && displayTree.rootComponents.length === 0 ? (
          <div className="empty-state-sm">
            No components match &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <>
            {/* Folder Hierarchy */}
            {displayTree.folders.map(renderFolderNode)}

            {/* Root / Uncategorized Components */}
            {displayTree.rootComponents.length > 0 && (
              <div className="tree-root-section">
                {hasAnyFolders && (
                  <div className="tree-root-divider">
                    <span>Root Components ({displayTree.rootComponents.length})</span>
                  </div>
                )}
                {displayTree.rootComponents.map((comp) => (
                  <ComponentItem
                    key={comp.id}
                    component={comp}
                    depth={0}
                    isActive={comp.id === activeComponentId}
                    transientStatus={transientStatuses.get(comp.id)}
                    onSelect={onSelectComponent}
                    onInspect={onInspectComponent}
                    onFetch={onFetchComponent}
                    onEdit={onEditComponent}
                    onDelete={onDeleteComponent}
                    onChangeFolder={setFolderPickerComp}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Create Folder */}
      {isCreateOpen && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setIsCreateOpen(false)} />
          <div className="modal-dialog">
            <div className="modal-dialog-header">
              <div className="modal-dialog-title">
                <h2>Create Folder</h2>
                <p className="subtitle">
                  {createFolderPath.includes('/')
                    ? `Create subfolder under ${createFolderPath.replace(/\/$/, '')}`
                    : 'Create a new folder (e.g. Design System/Buttons)'}
                </p>
              </div>
              <button
                type="button"
                className="modal-dialog-close"
                onClick={() => setIsCreateOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              {modalError && <div className="banner error">{modalError}</div>}
              <div className="form-group">
                <label htmlFor="createFolderInput">Folder Path</label>
                <input
                  type="text"
                  id="createFolderInput"
                  value={createFolderPath}
                  onChange={(e) => setCreateFolderPath(e.target.value)}
                  placeholder="e.g. Checkout/Payment or Buttons"
                  autoFocus
                  required
                />
              </div>
              <div className="button-group-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingModal}
                >
                  {isSubmittingModal ? 'Creating...' : 'Create Folder'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Folder */}
      {renamingFolder && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setRenamingFolder(null)} />
          <div className="modal-dialog">
            <div className="modal-dialog-header">
              <div className="modal-dialog-title">
                <h2>Rename Folder</h2>
                <p className="subtitle">
                  Rename &quot;{renamingFolder}&quot; across all components &amp; subfolders
                </p>
              </div>
              <button
                type="button"
                className="modal-dialog-close"
                onClick={() => setRenamingFolder(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              {modalError && <div className="banner error">{modalError}</div>}
              <div className="form-group">
                <label htmlFor="renameFolderInput">New Folder Path</label>
                <input
                  type="text"
                  id="renameFolderInput"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="button-group-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingModal}
                >
                  {isSubmittingModal ? 'Renaming...' : 'Rename Folder'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRenamingFolder(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Folder */}
      {deletingFolder && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setDeletingFolder(null)} />
          <div className="modal-dialog">
            <div className="modal-dialog-header">
              <div className="modal-dialog-title">
                <h2>Delete Folder</h2>
                <p className="subtitle">Delete folder &quot;{deletingFolder}&quot;</p>
              </div>
              <button
                type="button"
                className="modal-dialog-close"
                onClick={() => setDeletingFolder(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleDeleteSubmit}>
              {modalError && <div className="banner error">{modalError}</div>}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={deleteWithComponents}
                    onChange={(e) => setDeleteWithComponents(e.target.checked)}
                  />
                  <span>
                    Also permanently delete all component(s) inside this folder
                  </span>
                </label>
                {!deleteWithComponents && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginLeft: '1.5rem' }}>
                    Components will be moved to the parent folder / root.
                  </p>
                )}
              </div>
              <div className="button-group-row">
                <button
                  type="submit"
                  className="btn-primary btn-delete-danger"
                  style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                  disabled={isSubmittingModal}
                >
                  {isSubmittingModal ? 'Deleting...' : 'Delete Folder'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDeletingFolder(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Folder Picker for Component */}
      <FolderPickerModal
        isOpen={Boolean(folderPickerComp)}
        onClose={() => setFolderPickerComp(null)}
        fileName={folderPickerComp?.file_name || ''}
        currentFolderPath={folderPickerComp?.folder_path || ''}
        existingFolders={folders}
        onSelectFolder={async (newPath) => {
          if (folderPickerComp && onUpdateComponentFolder) {
            await onUpdateComponentFolder(folderPickerComp.id, newPath);
          }
          setFolderPickerComp((prev) => (prev ? { ...prev, folder_path: newPath } : null));
        }}
        onCreateFolder={onCreateFolder}
        onDeleteFolder={onDeleteFolder ? (p) => onDeleteFolder(p, false) : undefined}
      />
    </div>
  );
};
