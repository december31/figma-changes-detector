// public/modules/auth.js
// Figma Authentication & Token Management

import { state } from './state.js';

export function initAuth() {
  const tokenInput = document.getElementById('figmaToken');
  const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
  const saveTokenCheck = document.getElementById('saveTokenCheck');
  const clearTokenBtn = document.getElementById('clearTokenBtn');

  loadLocalToken();
  checkServerConfig();

  tokenInput.addEventListener('input', () => {
    updateTokenBadge();
    if (saveTokenCheck.checked) {
      localStorage.setItem('figma_token', tokenInput.value.trim());
    }
  });

  toggleTokenVisibility.addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  clearTokenBtn.addEventListener('click', () => {
    tokenInput.value = '';
    localStorage.removeItem('figma_token');
    updateTokenBadge();
  });
}

export function getActiveToken() {
  const tokenInput = document.getElementById('figmaToken');
  return tokenInput.value.trim();
}

export function loadLocalToken() {
  const tokenInput = document.getElementById('figmaToken');
  const savedToken = localStorage.getItem('figma_token');
  if (savedToken) {
    tokenInput.value = savedToken;
  }
}

export async function checkServerConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      state.serverHasDefaultToken = Boolean(config.hasDefaultToken);
    }
  } catch (err) {
    console.warn('Could not check server configuration:', err.message);
  } finally {
    updateTokenBadge();
  }
}

export function updateTokenBadge() {
  const tokenInput = document.getElementById('figmaToken');
  const tokenStatusBadge = document.getElementById('tokenStatusBadge');
  const userToken = tokenInput.value.trim();

  if (userToken) {
    tokenStatusBadge.textContent = 'Token: Custom (Ready)';
    tokenStatusBadge.className = 'status-badge connected';
  } else if (state.serverHasDefaultToken) {
    tokenStatusBadge.textContent = 'Token: .env Configured (Ready)';
    tokenStatusBadge.className = 'status-badge connected';
    tokenInput.placeholder = 'Using token from .env (or enter override here)';
  } else {
    tokenStatusBadge.textContent = 'Token: Missing';
    tokenStatusBadge.className = 'status-badge disconnected';
    tokenInput.placeholder = 'figd_... (or set FIGMA_ACCESS_TOKEN in .env)';
  }
}
