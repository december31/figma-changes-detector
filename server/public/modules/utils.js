// public/modules/utils.js
// URL Parser and Notification Helpers

export function parseFigmaUrl(urlStr) {
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr.trim());
    const pathMatch = url.pathname.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)(?:\/([^/?#]+))?/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    let fileName = null;
    if (pathMatch && pathMatch[3]) {
      fileName = decodeURIComponent(pathMatch[3]).replace(/[-_]+/g, ' ').trim();
    }

    let nodeId = url.searchParams.get('node-id');
    if (nodeId) {
      nodeId = decodeURIComponent(nodeId).replace(/-/g, ':');
    }

    if (fileKey || nodeId) {
      return { fileKey, nodeId, fileName };
    }
  } catch (e) {
    const rawFileMatch = urlStr.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)(?:\/([^/?#]+))?/);
    const rawNodeMatch = urlStr.match(/node-id=([^&]+)/);
    let fileName = null;
    if (rawFileMatch && rawFileMatch[3]) {
      fileName = decodeURIComponent(rawFileMatch[3]).replace(/[-_]+/g, ' ').trim();
    }
    if (rawFileMatch || rawNodeMatch) {
      return {
        fileKey: rawFileMatch ? rawFileMatch[2] : null,
        nodeId: rawNodeMatch ? decodeURIComponent(rawNodeMatch[1]).replace(/-/g, ':') : null,
        fileName
      };
    }
  }
  return null;
}

export function resolveSemiRootFolder(fileName, existingFolders = [], currentSubfolder = '') {
  if (!fileName || !fileName.trim()) return currentSubfolder ? currentSubfolder.trim() : '';
  const cleanFileName = fileName.trim();

  const existingRoot = existingFolders.find(
    (f) => f.split('/')[0].toLowerCase() === cleanFileName.toLowerCase()
  );

  const rootName = existingRoot ? existingRoot.split('/')[0] : cleanFileName;

  if (!currentSubfolder || !currentSubfolder.trim()) {
    return rootName;
  }

  const cleanSub = currentSubfolder
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('/');

  if (!cleanSub) return rootName;

  if (cleanSub.toLowerCase() === rootName.toLowerCase()) {
    return rootName;
  }
  if (cleanSub.toLowerCase().startsWith(rootName.toLowerCase() + '/')) {
    return cleanSub;
  }

  return `${rootName}/${cleanSub}`;
}

export function getStatusPillMeta(latestFetch) {
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

export function showError(msg) {
  const errorBanner = document.getElementById('errorBanner');
  const infoBanner = document.getElementById('infoBanner');
  if (errorBanner) {
    errorBanner.textContent = msg;
    errorBanner.classList.remove('hidden');
  }
  if (infoBanner) {
    infoBanner.classList.add('hidden');
  }
}

export function showInfo(msg) {
  const errorBanner = document.getElementById('errorBanner');
  const infoBanner = document.getElementById('infoBanner');
  if (infoBanner) {
    infoBanner.textContent = msg;
    infoBanner.classList.remove('hidden');
  }
  if (errorBanner) {
    errorBanner.classList.add('hidden');
  }
}

export function hideBanners() {
  const errorBanner = document.getElementById('errorBanner');
  const infoBanner = document.getElementById('infoBanner');
  if (errorBanner) errorBanner.classList.add('hidden');
  if (infoBanner) infoBanner.classList.add('hidden');
}
