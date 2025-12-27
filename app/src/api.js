// Resolve backend URL dynamically. In Electron we ask the main process; otherwise fall back to host:8001.
let backendUrlPromise = null;

async function resolveBackendUrl() {
  if (backendUrlPromise) return backendUrlPromise;
  if (window?.electronAPI?.getBackendUrl) {
    backendUrlPromise = window.electronAPI.getBackendUrl();
    return backendUrlPromise;
  }
  backendUrlPromise = Promise.resolve(window.API_URL || `http://${window.location.hostname}:8001`);
  return backendUrlPromise;
}

// Generic fetch helper
async function apiFetch(endpoint, options = {}) {
  const base = await resolveBackendUrl();
  const res = await fetch(`${base}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// API functions for Districts (linked to Layout)
export const getDistricts = (layoutId) => apiFetch(`/layouts/${layoutId}/districts`);
export const createDistrict = (layoutId, data) => apiFetch(`/layouts/${layoutId}/districts`, { method: "POST", body: JSON.stringify(data) });
export const updateDistrict = (id, data) => apiFetch(`/districts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDistrict = (id) => apiFetch(`/districts/${id}`, { method: "DELETE" });

// API functions for Dispatchers
export const getDispatchers = () => apiFetch("/dispatchers");
export const createDispatcher = (data) => apiFetch("/dispatchers", { method: "POST", body: JSON.stringify(data) });
export const updateDispatcher = (id, data) => apiFetch(`/dispatchers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDispatcher = (id) => apiFetch(`/dispatchers/${id}`, { method: "DELETE" });

// Modules
export const getModules = () => apiFetch("/modules/");
export const createModule = (data) => apiFetch("/modules/", { method: "POST", body: JSON.stringify(data) });
export const updateModule = (id, data) => apiFetch(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModule = (id) => apiFetch(`/modules/${id}`, { method: "DELETE" });

// Trains
export const getTrains = () => apiFetch("/trains/");
export const createTrain = (data) => apiFetch("/trains/", { method: "POST", body: JSON.stringify(data) });
export const updateTrain = (id, data) => apiFetch(`/trains/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteTrain = (id) => apiFetch(`/trains/${id}`, { method: "DELETE" });

// Layouts
export const getLayouts = () => apiFetch("/layouts/");
export const createLayout = (data) => apiFetch("/layouts/", { method: "POST", body: JSON.stringify(data) });
export const updateLayout = (id, data) => apiFetch(`/layouts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteLayout = (id) => apiFetch(`/layouts/${id}`, { method: "DELETE" });
