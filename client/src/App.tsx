// client/src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Component,
  TokenStatusInfo,
  TransientStatus,
  BatchResultItem,
  BatchSummary,
  UpdateComponentPayload
} from './types';
import * as api from './services/api';
import { Header } from './components/Header';
import { AuthCard } from './components/AuthCard';
import { AddComponentCard } from './components/AddComponentCard';
import { WatchlistCard } from './components/WatchlistCard';
import { InspectPage } from './components/InspectPage';
import { HistoryReportPage } from './components/HistoryReportPage';
import { EditComponentModal } from './components/EditComponentModal';
import { ZoomModal } from './components/ZoomModal';

type AppRoute = {
  page: 'home' | 'inspect' | 'history';
  componentId?: number;
};

function parseRoute(pathname: string): AppRoute {
  if (pathname === '/history' || pathname.startsWith('/history/')) {
    return { page: 'history' };
  }
  const match = pathname.match(/^\/inspect\/(\d+)/);
  if (match) {
    return { page: 'inspect', componentId: parseInt(match[1], 10) };
  }
  return { page: 'home' };
}

export const App: React.FC = () => {
  // --- Routing State ---
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(window.location.pathname)
  );

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToInspect = (componentId: number) => {
    const newPath = `/inspect/${componentId}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
    setRoute({ page: 'inspect', componentId });
  };

  const navigateToHistory = () => {
    const newPath = '/history';
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
    }
    setRoute({ page: 'history' });
  };

  const navigateToHome = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setRoute({ page: 'home' });
    loadComponents();
  };
  // --- Auth State ---
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('figma_token') || '';
  });
  const [saveToLocalStorage, setSaveToLocalStorage] = useState<boolean>(true);
  const [hasDefaultToken, setHasDefaultToken] = useState<boolean>(false);

  // --- Watchlist State ---
  const [components, setComponents] = useState<Component[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeComponentId, setActiveComponentId] = useState<number | null>(null);
  const [transientStatuses, setTransientStatuses] = useState<Map<number, TransientStatus>>(
    new Map()
  );

  // --- Form & Banners ---
  const [isFetchingForm, setIsFetchingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [formPrefill, setFormPrefill] = useState<{
    fileKey?: string;
    fileName?: string;
    nodeId?: string;
    name?: string;
    format?: string;
    scale?: number;
    folderPath?: string;
  }>({});

  // --- Batch Run State ---
  const [isBatchChecking, setIsBatchChecking] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResultItem[] | null>(null);

  // --- Modals State ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);

  // --- Token Status ---
  const tokenStatus: TokenStatusInfo = React.useMemo(() => {
    if (token.trim()) {
      return {
        type: 'custom',
        label: 'Token: Custom (Ready)',
        className: 'connected',
        placeholder: 'figd_... (or set FIGMA_ACCESS_TOKEN in .env)'
      };
    }
    if (hasDefaultToken) {
      return {
        type: 'default',
        label: 'Token: .env Configured (Ready)',
        className: 'connected',
        placeholder: 'Using token from .env (or enter override here)'
      };
    }
    return {
      type: 'missing',
      label: 'Token: Missing',
      className: 'disconnected',
      placeholder: 'figd_... (or set FIGMA_ACCESS_TOKEN in .env)'
    };
  }, [token, hasDefaultToken]);

  const handleTokenChange = (newToken: string) => {
    setToken(newToken);
    if (saveToLocalStorage) {
      localStorage.setItem('figma_token', newToken.trim());
    } else {
      localStorage.removeItem('figma_token');
    }
  };

  const handleSaveToLocalStorageChange = (save: boolean) => {
    setSaveToLocalStorage(save);
    if (save && token.trim()) {
      localStorage.setItem('figma_token', token.trim());
    } else if (!save) {
      localStorage.removeItem('figma_token');
    }
  };

  // --- Initial Config & Watchlist Load ---
  const loadComponents = useCallback(async (selectId?: number | null) => {
    try {
      const [list, folderList] = await Promise.all([
        api.getComponents(),
        api.getFolders()
      ]);
      setComponents(list);
      setFolders(folderList);

      if (selectId) {
        const target = list.find((c) => c.id === selectId);
        if (target) {
          setActiveComponentId(target.id);
          setFormPrefill({
            fileKey: target.file_key,
            fileName: target.file_name,
            nodeId: target.node_id,
            name: target.name,
            format: target.format,
            scale: target.scale,
            folderPath: target.folder_path || ''
          });
        }
      } else if (list.length > 0) {
        // Pick first component if none currently selected
        setActiveComponentId((currentActiveId) => {
          if (!currentActiveId) {
            const firstWithFetch = list.find((c) => c.latestFetch) || list[0];
            setFormPrefill({
              fileKey: firstWithFetch.file_key,
              fileName: firstWithFetch.file_name,
              nodeId: firstWithFetch.node_id,
              name: firstWithFetch.name,
              format: firstWithFetch.format,
              scale: firstWithFetch.scale,
              folderPath: firstWithFetch.folder_path || ''
            });
            return firstWithFetch.id;
          }
          return currentActiveId;
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load components:', err);
    }
  }, []);

  useEffect(() => {
    api
      .getAppConfig()
      .then((config) => {
        setHasDefaultToken(config.hasDefaultToken);
      })
      .catch((err) => {
        console.warn('Could not check app config:', err);
      });

    loadComponents();
  }, [loadComponents]);

  // --- Component Selection ---
  const handleSelectComponent = async (comp: Component) => {
    setActiveComponentId(comp.id);
    setFormPrefill({
      fileKey: comp.file_key,
      fileName: comp.file_name,
      nodeId: comp.node_id,
      name: comp.name,
      format: comp.format,
      scale: comp.scale,
      folderPath: comp.folder_path || ''
    });
  };

  // --- Fetch Now via Add Form ---
  const handleFetchNow = async (formData: {
    fileKey: string;
    fileName?: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
    folderPath?: string;
  }) => {
    setFormError(null);
    setFormInfo(null);

    const activeToken = token.trim();
    if (!activeToken && !hasDefaultToken) {
      setFormError(
        'Please enter your Figma Personal Access Token or set FIGMA_ACCESS_TOKEN in .env'
      );
      return;
    }
    if (!formData.fileKey || !formData.nodeId) {
      setFormError('Both File Key and Node ID are required.');
      return;
    }

    setIsFetchingForm(true);
    try {
      const result = await api.fetchComponentDirect({
        token: activeToken || undefined,
        fileKey: formData.fileKey,
        fileName: formData.fileName,
        nodeId: formData.nodeId,
        name: formData.name,
        format: formData.format,
        scale: formData.scale,
        figmaUrl: formData.figmaUrl,
        folderPath: formData.folderPath
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch component.');
      }

      await loadComponents(result.component.id);
      setActiveComponentId(result.component.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Request error: ${msg}`);
    } finally {
      setIsFetchingForm(false);
    }
  };

  // --- Add to Watchlist via Add Form ---
  const handleAddToWatchlist = async (formData: {
    fileKey: string;
    fileName?: string;
    nodeId: string;
    name: string;
    format: string;
    scale: number;
    figmaUrl: string;
    folderPath?: string;
  }) => {
    setFormError(null);
    setFormInfo(null);

    if (!formData.fileKey || !formData.nodeId) {
      setFormError(
        'Please provide both File Key and Node ID (or paste a Figma link) to add to the watchlist.'
      );
      return;
    }

    try {
      const res = await api.createComponent({
        name: formData.name,
        fileKey: formData.fileKey,
        fileName: formData.fileName,
        nodeId: formData.nodeId,
        format: formData.format,
        scale: formData.scale,
        figmaUrl: formData.figmaUrl,
        folderPath: formData.folderPath,
        fetchNow: false
      });

      if ('component' in res && res.component) {
        setFormInfo(
          `Saved "${res.component.name}" (${res.component.node_id}) to SQLite watchlist.`
        );
        await loadComponents(res.component.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Error saving component: ${msg}`);
    }
  };

  // --- Single Component Fetch from Watchlist ---
  const handleFetchComponent = async (comp: Component) => {
    setFormError(null);
    setFormInfo(null);

    const activeToken = token.trim();
    if (!activeToken && !hasDefaultToken) {
      setFormError('Please provide your Figma Access Token first.');
      return;
    }

    // Set transient status
    setTransientStatuses((prev) => {
      const map = new Map(prev);
      map.set(comp.id, { status: 'loading' });
      return map;
    });
    setIsFetchingForm(true);

    try {
      const result = await api.fetchComponentWatchlist(comp.id, activeToken || undefined);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch component.');
      }

      await loadComponents(comp.id);
      setActiveComponentId(comp.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Fetch failed: ${msg}`);
    } finally {
      setTransientStatuses((prev) => {
        const map = new Map(prev);
        map.delete(comp.id);
        return map;
      });
      setIsFetchingForm(false);
    }
  };

  // --- Delete Component ---
  const handleDeleteComponent = async (comp: Component) => {
    if (
      !window.confirm(
        `Remove "${comp.name}" and its stored snapshots from SQLite & /assets?`
      )
    ) {
      return;
    }

    try {
      await api.deleteComponent(comp.id);
      if (activeComponentId === comp.id) {
        setActiveComponentId(null);
      }
      await loadComponents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Failed to delete component: ${msg}`);
    }
  };

  // --- Inspect Navigation ---
  const handleInspectComponent = (comp: Component) => {
    handleSelectComponent(comp);
    navigateToInspect(comp.id);
  };

  const handleInspectBatchItem = (item: BatchResultItem) => {
    if (item.componentId) {
      navigateToInspect(item.componentId);
    }
  };

  // --- Edit Component ---
  const handleOpenEdit = (comp: Component) => {
    setEditingComponent(comp);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (id: number, payload: UpdateComponentPayload) => {
    const res = await api.updateComponent(id, payload);
    if (res.success && res.component) {
      await loadComponents(res.component.id);
      setFormPrefill({
        fileKey: res.component.file_key,
        fileName: res.component.file_name,
        nodeId: res.component.node_id,
        name: res.component.name,
        format: res.component.format,
        scale: res.component.scale,
        folderPath: res.component.folder_path || ''
      });
    }
  };

  // --- Folder Management ---
  const handleCreateFolder = async (path: string) => {
    await api.createFolder(path);
    const updated = await api.getFolders();
    setFolders(updated);
  };

  const handleRenameFolder = async (oldPath: string, newPath: string) => {
    await api.renameFolder(oldPath, newPath);
    await loadComponents(activeComponentId);
  };

  const handleDeleteFolder = async (path: string, deleteComponents: boolean = false) => {
    await api.deleteFolder(path, deleteComponents);
    await loadComponents(activeComponentId);
  };

  const handleSelectFolderForAdd = (folderPath: string) => {
    setFormPrefill((prev) => ({
      ...prev,
      folderPath
    }));
  };

  // --- Batch Check Components (All or Folder) ---
  const runBatchCheckFor = async (
    targetComponents: Component[],
    targetMeta: { triggerType: 'all' | 'folder'; targetName: string }
  ) => {
    setFormError(null);
    setFormInfo(null);

    const activeToken = token.trim();
    if (!activeToken && !hasDefaultToken) {
      setFormError(
        'Please provide your Figma Access Token (in UI or .env) before running check.'
      );
      return;
    }

    if (targetComponents.length === 0) {
      setFormError('No components to check.');
      return;
    }

    setIsBatchChecking(true);
    setBatchSummary(null);

    // Create session run record
    let runId: number | undefined;
    try {
      const run = await api.startFetchRun({
        triggerType: targetMeta.triggerType,
        targetName: targetMeta.targetName,
        totalItems: targetComponents.length
      });
      runId = run.id;
    } catch (e) {
      console.warn('Could not start tracked run session:', e);
    }

    // Mark targets as queued
    setTransientStatuses((prev) => {
      const next = new Map(prev);
      targetComponents.forEach((c) => next.set(c.id, { status: 'queued' }));
      return next;
    });

    const results: BatchResultItem[] = [];
    let changedCount = 0;
    let unchangedCount = 0;
    let baselineCount = 0;
    let errorCount = 0;

    for (const comp of targetComponents) {
      setTransientStatuses((prev) => {
        const next = new Map(prev);
        next.set(comp.id, { status: 'loading' });
        return next;
      });

      try {
        const res = await api.fetchComponentWatchlist(comp.id, activeToken || undefined, runId);
        const status = res.currentFetch.change_status;
        if (status === 'changed') changedCount++;
        else if (status === 'unchanged') unchangedCount++;
        else baselineCount++;

        results.push({
          componentId: comp.id,
          success: true,
          component: res.component,
          currentFetch: res.currentFetch,
          previousFetch: res.previousFetch
        });
      } catch (err: unknown) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          componentId: comp.id,
          name: comp.name,
          nodeId: comp.node_id,
          success: false,
          error: msg
        });
      } finally {
        setTransientStatuses((prev) => {
          const next = new Map(prev);
          next.delete(comp.id);
          return next;
        });
      }
    }

    setTransientStatuses(new Map());

    const summary: BatchSummary = {
      total: targetComponents.length,
      changed: changedCount,
      unchanged: unchangedCount,
      baseline: baselineCount,
      errors: errorCount
    };
    setBatchSummary(summary);
    setBatchResults(results);

    if (runId) {
      try {
        await api.completeFetchRun(runId, {
          totalItems: targetComponents.length,
          changedCount,
          unchangedCount,
          baselineCount,
          errorCount
        });
      } catch (e) {
        console.warn('Could not complete tracked run session:', e);
      }
    }

    // Pick first changed or first success
    const firstChanged = results.find(
      (r) => r.success && r.currentFetch?.change_status === 'changed'
    );
    const firstSuccess = results.find((r) => r.success);
    const targetSelect = firstChanged
      ? firstChanged.componentId
      : firstSuccess
      ? firstSuccess.componentId
      : activeComponentId;

    await loadComponents(targetSelect);
    setIsBatchChecking(false);
  };

  const handleCheckAll = async () => {
    await runBatchCheckFor(components, {
      triggerType: 'all',
      targetName: 'All Components'
    });
  };

  const handleCheckFolder = async (componentIds: number[]) => {
    const subset = components.filter((c) => componentIds.includes(c.id));
    const folderName = subset[0]?.folder_path || 'Folder Components';
    await runBatchCheckFor(subset, {
      triggerType: 'folder',
      targetName: folderName
    });
  };

  // --- Zoom Modal Handler ---
  const handleOpenZoom = (src: string) => {
    setZoomImageSrc(src);
    setIsZoomOpen(true);
  };

  // If on /inspect/:componentId page, render the standalone Inspect Page
  if (route.page === 'inspect' && route.componentId) {
    return (
      <div className="app-container">
        <InspectPage
          componentId={route.componentId}
          onBack={navigateToHome}
          token={token}
          hasDefaultToken={hasDefaultToken}
          onOpenZoom={handleOpenZoom}
        />
        {/* Lightbox Zoom Modal */}
        <ZoomModal
          isOpen={isZoomOpen}
          imageSrc={zoomImageSrc}
          onClose={() => {
            setIsZoomOpen(false);
            setZoomImageSrc(null);
          }}
        />
      </div>
    );
  }

  // If on /history page, render the full Running History & Report Page
  if (route.page === 'history') {
    return (
      <div className="app-container">
        <HistoryReportPage
          onBack={navigateToHome}
          onOpenZoom={handleOpenZoom}
          onNavigateToInspect={(id) => navigateToInspect(id)}
        />
        {/* Lightbox Zoom Modal */}
        <ZoomModal
          isOpen={isZoomOpen}
          imageSrc={zoomImageSrc}
          onClose={() => {
            setIsZoomOpen(false);
            setZoomImageSrc(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <Header tokenStatus={tokenStatus} onOpenHistory={navigateToHistory} />

      {/* Main Grid */}
      <main className="main-grid">
        {/* Left Column: Configuration & Add Component */}
        <section className="panel control-panel">
          {/* 1. Auth Card */}
          <AuthCard
            token={token}
            onTokenChange={handleTokenChange}
            saveToLocalStorage={saveToLocalStorage}
            onSaveToLocalStorageChange={handleSaveToLocalStorageChange}
            tokenStatus={tokenStatus}
          />

          {/* 2. Add / Fetch Component Card */}
          <AddComponentCard
            onFetchNow={handleFetchNow}
            onAddToWatchlist={handleAddToWatchlist}
            folders={folders}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={(p) => handleDeleteFolder(p, false)}
            isFetching={isFetchingForm}
            errorMessage={formError}
            infoMessage={formInfo}
            onClearBanners={() => {
              setFormError(null);
              setFormInfo(null);
            }}
            initialValues={formPrefill}
          />
        </section>

        {/* Right Column: Tracked Components Watchlist */}
        <section className="panel display-panel">
          <WatchlistCard
            components={components}
            activeComponentId={activeComponentId}
            transientStatuses={transientStatuses}
            folders={folders}
            isBatchChecking={isBatchChecking}
            batchSummary={batchSummary}
            batchResults={batchResults}
            onClearBatchResults={() => setBatchResults(null)}
            onCheckAll={handleCheckAll}
            onCheckFolder={handleCheckFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onSelectFolderForAdd={handleSelectFolderForAdd}
            onSelectComponent={handleSelectComponent}
            onInspectComponent={(comp) => handleInspectComponent(comp)}
            onFetchComponent={handleFetchComponent}
            onEditComponent={handleOpenEdit}
            onDeleteComponent={handleDeleteComponent}
            onInspectBatchItem={handleInspectBatchItem}
            onUpdateComponentFolder={async (id, folderPath) => {
              await handleSaveEdit(id, { folderPath });
            }}
          />
        </section>
      </main>

      {/* Edit Component Modal */}
      <EditComponentModal
        isOpen={isEditOpen}
        component={editingComponent}
        folders={folders}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={(p) => handleDeleteFolder(p, false)}
        onClose={() => {
          setIsEditOpen(false);
          setEditingComponent(null);
        }}
        onSave={handleSaveEdit}
      />

      {/* Zoom Modal */}
      <ZoomModal
        isOpen={isZoomOpen}
        imageSrc={zoomImageSrc}
        onClose={() => {
          setIsZoomOpen(false);
          setZoomImageSrc(null);
        }}
      />
    </div>
  );
};

export default App;
