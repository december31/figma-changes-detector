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
  FetchRecord
} from '../types';

const API_BASE = '/api';

export async function getAppConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) {
    throw new Error(`Failed to load app config: ${res.statusText}`);
  }
  return res.json();
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
  token?: string
): Promise<ComponentFetchResponse> {
  const res = await fetch(`${API_BASE}/components/${id}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token?.trim() || undefined })
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
