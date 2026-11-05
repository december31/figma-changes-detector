// client/src/utils/index.ts
import { FetchRecord } from '../types';

export function parseFigmaUrl(urlStr: string): { fileKey: string | null; nodeId: string | null } | null {
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr.trim());
    const pathMatch = url.pathname.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)/);
    const fileKey = pathMatch ? pathMatch[2] : null;

    let nodeId = url.searchParams.get('node-id');
    if (nodeId) {
      nodeId = decodeURIComponent(nodeId).replace(/-/g, ':');
    }

    if (fileKey || nodeId) {
      return { fileKey, nodeId };
    }
  } catch {
    const rawFileMatch = urlStr.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)/);
    const rawNodeMatch = urlStr.match(/node-id=([^&]+)/);
    if (rawFileMatch || rawNodeMatch) {
      return {
        fileKey: rawFileMatch ? rawFileMatch[2] : null,
        nodeId: rawNodeMatch ? decodeURIComponent(rawNodeMatch[1]).replace(/-/g, ':') : null
      };
    }
  }
  return null;
}

export function getStatusPillMeta(latestFetch?: FetchRecord | null): { text: string; cls: string } {
  if (!latestFetch) {
    return { text: 'Not Fetched', cls: 'unfetched' };
  }
  if (latestFetch.change_status === 'changed') {
    return { text: `Changed (${latestFetch.diff_percentage}%)`, cls: 'changed' };
  }
  if (latestFetch.change_status === 'unchanged') {
    return { text: 'Identical (0%)', cls: 'unchanged' };
  }
  return { text: 'Baseline', cls: 'baseline' };
}
