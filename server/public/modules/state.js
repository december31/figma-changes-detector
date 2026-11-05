// public/modules/state.js
// Centralized frontend state management

export const state = {
  serverHasDefaultToken: false,
  watchedComponents: [],
  activeComponentId: null,
  activeFetchId: null,
  // Per-component transient status map: componentId -> { status: 'queued' | 'loading', label?: string }
  componentTransientStatus: new Map()
};

export function setComponentStatus(componentId, status) {
  if (!status) {
    state.componentTransientStatus.delete(componentId);
  } else {
    state.componentTransientStatus.set(componentId, status);
  }
}

export function clearAllComponentStatuses() {
  state.componentTransientStatus.clear();
}

export function getComponentStatus(componentId) {
  return state.componentTransientStatus.get(componentId) || null;
}
