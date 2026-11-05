// public/app.js
// Main entry point orchestrating modular frontend features

import { initAuth } from './modules/auth.js';
import { initInspector } from './modules/inspector.js';
import { initDiffViewer } from './modules/diffViewer.js';
import { initEditModal } from './modules/modal.js';
import { initWatchlist, loadWatchlist } from './modules/watchlist.js';
import { parseFigmaUrl, resolveSemiRootFolder, hideBanners } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Auth
  initAuth();

  // 2. Initialize Inspector, Diff Viewer, & Edit Modal
  initInspector();
  initDiffViewer();

  initEditModal({
    onSave: async (updatedComponent) => {
      const metaNodeName = document.getElementById('metaNodeName');
      const metaNodeId = document.getElementById('metaNodeId');
      const historyCompName = document.getElementById('historyCompName');
      const fileKeyInput = document.getElementById('fileKey');
      const nodeIdInput = document.getElementById('nodeId');
      const compCustomNameInput = document.getElementById('compCustomName');
      const renderFormatSelect = document.getElementById('renderFormat');
      const renderScaleSelect = document.getElementById('renderScale');

      if (metaNodeName) metaNodeName.textContent = updatedComponent.name;
      if (metaNodeId) metaNodeId.textContent = updatedComponent.node_id;
      if (historyCompName) historyCompName.textContent = updatedComponent.name;
      if (fileKeyInput) fileKeyInput.value = updatedComponent.file_key;
      if (nodeIdInput) nodeIdInput.value = updatedComponent.node_id;
      if (compCustomNameInput) compCustomNameInput.value = updatedComponent.name;
      if (renderFormatSelect) renderFormatSelect.value = updatedComponent.format || 'png';
      if (renderScaleSelect) renderScaleSelect.value = String(updatedComponent.scale || 2);

      await loadWatchlist(updatedComponent.id);
    }
  });

  // 3. Initialize Watchlist & Auto-Fill Listeners
  initWatchlist();

  const figmaUrlInput = document.getElementById('figmaUrl');
  const compFileNameInput = document.getElementById('compFileName');
  const fileKeyInput = document.getElementById('fileKey');
  const nodeIdInput = document.getElementById('nodeId');
  const compFolderPathInput = document.getElementById('compFolderPath');

  if (figmaUrlInput) {
    figmaUrlInput.addEventListener('input', (e) => {
      const parsed = parseFigmaUrl(e.target.value);
      if (parsed) {
        if (parsed.fileKey && fileKeyInput) fileKeyInput.value = parsed.fileKey;
        if (parsed.nodeId && nodeIdInput) nodeIdInput.value = parsed.nodeId;
        if (parsed.fileName && compFileNameInput) {
          compFileNameInput.value = parsed.fileName;
        }
        hideBanners();
      }
    });
  }

  // 4. Initial Load of Watchlist
  await loadWatchlist();
});
