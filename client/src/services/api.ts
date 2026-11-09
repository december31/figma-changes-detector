// client/src/services/api.ts
import {
  AppConfig,
  Component,
  ComponentFetchResponse,
  ComponentHistoryResponse,
  CreateComponentPayload,
  UpdateComponentPayload,
  DirectFetchPayload,
  BatchResponse,
  FetchRecord,
  FetchRun,
  RunDetailsResponse,
  CollabConfig,
  VerifyParentResponse,
  PublishCollabPayload,
  PublishCollabResponse,
  DataSource
} from '../types';

const API_BASE = '/api';

async function handleApiResponse(res: Response, defaultErrorMessage: string) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok || (data && data.success === false)) {
      throw new Error(data?.error || defaultErrorMessage);
    }
    return data;
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`API endpoint not found (404). Please restart the backend server to load new routes.`);
    }
    throw new Error(`Server returned status ${res.status}: ${text.slice(0, 150)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(defaultErrorMessage);
  }
}

export async function getAppConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`);
  return handleApiResponse(res, 'Failed to load app config');
}

export async function checkToken(token?: string): Promise<{ valid: boolean; message?: string }> {
  const cleanToken = token?.trim();
  if (cleanToken) {
    return {
      valid: cleanToken.length > 5,
      message: 'Token configured in UI'
    };
  }
  try {
    const config = await getAppConfig();
    return {
      valid: config.hasDefaultToken,
      message: config.hasDefaultToken ? 'Token configured in .env' : 'No token configured'
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { valid: false, message: errorMsg };
  }
}

export async function getComponents(): Promise<Component[]> {
  const res = await fetch(`${API_BASE}/components`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch components.');
  }
  return data.components || [];
}

export async function createComponent(
  payload: CreateComponentPayload
): Promise<ComponentFetchResponse | { success: boolean; component: Component }> {
  const res = await fetch(`${API_BASE}/components`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create component.');
  }
  return data;
}

export async function updateComponent(
  id: number,
  payload: UpdateComponentPayload
): Promise<{ success: boolean; component: Component }> {
  const res = await fetch(`${API_BASE}/components/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update component.');
  }
  return data;
}

export async function deleteComponent(id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/components/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete component.');
  }
  return data;
}

export async function getFolders(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/components/folders`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch folders.');
  }
  return data.folders || [];
}

export async function createFolder(path: string): Promise<{ path: string }> {
  const res = await fetch(`${API_BASE}/components/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create folder.');
  }
  return data;
}

export async function renameFolder(oldPath: string, newPath: string): Promise<{ oldPath: string; newPath: string }> {
  const res = await fetch(`${API_BASE}/components/folders`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to rename folder.');
  }
  return data;
}

export async function deleteFolder(path: string, deleteComponents: boolean = false): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/components/folders`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, deleteComponents })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete folder.');
  }
  return data;
}

export async function fetchComponentDirect(
  payload: DirectFetchPayload
): Promise<ComponentFetchResponse> {
  const res = await fetch(`${API_BASE}/figma/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch component image from Figma.');
  }
  return data;
}

export async function fetchComponentWatchlist(
  id: number,
  token?: string,
  runId?: number
): Promise<ComponentFetchResponse> {
  const res = await fetch(`${API_BASE}/components/${id}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token?.trim() || undefined, runId })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch watched component.');
  }
  return data;
}

export async function fetchAllComponents(token?: string): Promise<BatchResponse> {
  const res = await fetch(`${API_BASE}/components/fetch-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token?.trim() || undefined })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to batch fetch all components.');
  }
  return data;
}

export async function startFetchRun(payload: {
  triggerType: 'all' | 'folder' | 'single';
  targetName: string;
  totalItems: number;
}): Promise<FetchRun> {
  const res = await fetch(`${API_BASE}/components/runs/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to start fetch run session.');
  }
  return data.run;
}

export async function completeFetchRun(
  runId: number,
  counts: {
    totalItems: number;
    changedCount: number;
    unchangedCount: number;
    baselineCount: number;
    errorCount: number;
  }
): Promise<FetchRun> {
  const res = await fetch(`${API_BASE}/components/runs/${runId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed', counts })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to complete fetch run session.');
  }
  return data.run;
}

export async function getFetchRuns(limit = 50): Promise<FetchRun[]> {
  const res = await fetch(`${API_BASE}/components/runs?limit=${limit}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch running history.');
  }
  return data.runs || [];
}

export async function getRunDetails(runId: number): Promise<RunDetailsResponse> {
  const res = await fetch(`${API_BASE}/components/runs/${runId}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load run details.');
  }
  return data;
}

export async function getComponentHistory(id: number): Promise<ComponentHistoryResponse> {
  const res = await fetch(`${API_BASE}/components/${id}/history`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch component history.');
  }
  return data;
}

export async function getComponentCompare(
  id: number,
  fetchAId?: number | null,
  fetchBId?: number | null
): Promise<{ component: Component; fetchA: FetchRecord | null; fetchB: FetchRecord | null }> {
  const historyData = await getComponentHistory(id);
  const history = historyData.history || [];

  let fetchB: FetchRecord | null = null;
  let fetchA: FetchRecord | null = null;

  if (fetchBId) {
    fetchB = history.find(h => h.id === fetchBId) || null;
  } else if (history.length > 0) {
    fetchB = history[0];
  }

  if (fetchAId) {
    fetchA = history.find(h => h.id === fetchAId) || null;
  } else if (fetchB) {
    fetchA = fetchB.previous_fetch_id
      ? (history.find(h => h.id === fetchB.previous_fetch_id) || null)
      : (history.length > 1 ? history[1] : null);
  }

  return {
    component: historyData.component,
    fetchA,
    fetchB
  };
}

export async function getCollabConfig(): Promise<CollabConfig> {
  const res = await fetch(`${API_BASE}/collab/config`);
  return handleApiResponse(res, 'Failed to fetch Collab configuration.');
}

export async function verifyCollabParent(
  parentPageId: string,
  collabUrl?: string,
  token?: string
): Promise<VerifyParentResponse> {
  const res = await fetch(`${API_BASE}/collab/verify-parent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPageId, collabUrl, token })
  });
  return handleApiResponse(res, 'Failed to verify parent page on Collab.');
}

export async function publishCollabReport(
  payload: PublishCollabPayload
): Promise<PublishCollabResponse> {
  const res = await fetch(`${API_BASE}/collab/publish-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleApiResponse(res, 'Failed to publish report to Collab.');
}

export async function getDataSources(): Promise<DataSource[]> {
  const res = await fetch(`${API_BASE}/datasources`);
  const data = await handleApiResponse(res, 'Failed to fetch datasources.');
  return data.datasources || [];
}

export async function createDataSource(name: string): Promise<DataSource> {
  const res = await fetch(`${API_BASE}/datasources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await handleApiResponse(res, 'Failed to create datasource.');
  return data.datasource;
}

export async function switchDataSource(id: string): Promise<DataSource> {
  const res = await fetch(`${API_BASE}/datasources/${encodeURIComponent(id)}/activate`, {
    method: 'POST'
  });
  const data = await handleApiResponse(res, 'Failed to switch datasource.');
  return data.datasource;
}

export async function renameDataSource(id: string, name: string): Promise<DataSource> {
  const res = await fetch(`${API_BASE}/datasources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await handleApiResponse(res, 'Failed to rename datasource.');
  return data.datasource;
}

export async function deleteDataSource(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/datasources/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  await handleApiResponse(res, 'Failed to delete datasource.');
}

export function getDataSourceExportUrl(id: string): string {
  return `${API_BASE}/datasources/${encodeURIComponent(id)}/export`;
}

export async function importDataSource(file: File): Promise<DataSource> {
  const formData = new FormData();
  formData.append('bundle', file);

  const res = await fetch(`${API_BASE}/datasources/import`, {
    method: 'POST',
    body: formData
  });
  const data = await handleApiResponse(res, 'Failed to import datasource archive.');
  return data.datasource;
}


