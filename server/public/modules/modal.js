// public/modules/modal.js
// Edit Component Modal Controller

import { parseFigmaUrl } from './utils.js';

let currentEditingId = null;
let onSaveCallback = null;

export function initEditModal({ onSave }) {
  onSaveCallback = onSave;

  const editModal = document.getElementById('editModal');
  const editModalBackdrop = document.getElementById('editModalBackdrop');
  const editModalCloseBtn = document.getElementById('editModalCloseBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editComponentForm = document.getElementById('editComponentForm');
  const editFigmaUrl = document.getElementById('editFigmaUrl');
  const editFileKey = document.getElementById('editFileKey');
  const editNodeId = document.getElementById('editNodeId');
  const editErrorBanner = document.getElementById('editErrorBanner');
  const editCompName = document.getElementById('editCompName');
  const editFolderPath = document.getElementById('editFolderPath');
  const editRenderFormat = document.getElementById('editRenderFormat');
  const editRenderScale = document.getElementById('editRenderScale');
  const saveEditBtn = document.getElementById('saveEditBtn');

  function closeModal() {
    if (editModal) editModal.classList.add('hidden');
    currentEditingId = null;
    if (editErrorBanner) {
      editErrorBanner.textContent = '';
      editErrorBanner.classList.add('hidden');
    }
  }

  if (editFigmaUrl) {
    editFigmaUrl.addEventListener('input', (e) => {
      const parsed = parseFigmaUrl(e.target.value);
      if (parsed) {
        if (parsed.fileKey && editFileKey) editFileKey.value = parsed.fileKey;
        if (parsed.nodeId && editNodeId) editNodeId.value = parsed.nodeId;
        if (editErrorBanner) editErrorBanner.classList.add('hidden');
      }
    });
  }

  if (editComponentForm) {
    editComponentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentEditingId) return;

      const name = editCompName.value.trim();
      const folderPath = editFolderPath ? editFolderPath.value.trim() : '';
      const fileKey = editFileKey.value.trim();
      const nodeId = editNodeId.value.trim();
      const format = editRenderFormat.value;
      const scale = Number(editRenderScale.value) || 2;
      const figmaUrl = editFigmaUrl.value.trim();

      if (!name) {
        if (editErrorBanner) {
          editErrorBanner.textContent = 'Component Label is required.';
          editErrorBanner.classList.remove('hidden');
        }
        editCompName.focus();
        return;
      }

      if (!fileKey || !nodeId) {
        if (editErrorBanner) {
          editErrorBanner.textContent = 'Both File Key and Node ID are required.';
          editErrorBanner.classList.remove('hidden');
        }
        return;
      }

      const saveText = saveEditBtn ? saveEditBtn.querySelector('.btn-text-content') : null;
      const saveSpinner = saveEditBtn ? saveEditBtn.querySelector('.btn-spinner') : null;
      if (saveEditBtn) saveEditBtn.disabled = true;
      if (saveText) saveText.textContent = 'Saving...';
      if (saveSpinner) saveSpinner.classList.remove('hidden');

      try {
        const res = await fetch(`/api/components/${currentEditingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, fileKey, nodeId, format, scale, figmaUrl, folderPath })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (editErrorBanner) {
            editErrorBanner.textContent = data.error || 'Failed to update component.';
            editErrorBanner.classList.remove('hidden');
          }
          return;
        }

        closeModal();
        if (typeof onSaveCallback === 'function') {
          await onSaveCallback(data.component);
        }
      } catch (err) {
        if (editErrorBanner) {
          editErrorBanner.textContent = `Error updating component: ${err.message}`;
          editErrorBanner.classList.remove('hidden');
        }
      } finally {
        if (saveEditBtn) saveEditBtn.disabled = false;
        if (saveText) saveText.textContent = 'Save Changes';
        if (saveSpinner) saveSpinner.classList.add('hidden');
      }
    });
  }

  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
  if (editModalCloseBtn) editModalCloseBtn.addEventListener('click', closeModal);
  if (editModalBackdrop) editModalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal && !editModal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

export function openEditModal(comp) {
  if (!comp) return;
  currentEditingId = comp.id;

  const editModal = document.getElementById('editModal');
  const editFigmaUrl = document.getElementById('editFigmaUrl');
  const editCompName = document.getElementById('editCompName');
  const editFolderPath = document.getElementById('editFolderPath');
  const editFileKey = document.getElementById('editFileKey');
  const editNodeId = document.getElementById('editNodeId');
  const editRenderFormat = document.getElementById('editRenderFormat');
  const editRenderScale = document.getElementById('editRenderScale');
  const editErrorBanner = document.getElementById('editErrorBanner');

  if (editFigmaUrl) editFigmaUrl.value = comp.figma_url || '';
  if (editCompName) editCompName.value = comp.name || '';
  if (editFolderPath) editFolderPath.value = comp.folder_path || '';
  if (editFileKey) editFileKey.value = comp.file_key || '';
  if (editNodeId) editNodeId.value = comp.node_id || '';
  if (editRenderFormat) editRenderFormat.value = comp.format || 'png';
  if (editRenderScale) editRenderScale.value = String(comp.scale || 2);

  if (editErrorBanner) {
    editErrorBanner.textContent = '';
    editErrorBanner.classList.add('hidden');
  }

  if (editModal) {
    editModal.classList.remove('hidden');
  }
  if (editCompName) editCompName.focus();
}
