// Use window.API_URL if set, otherwise default to current hostname with port 8001
const API_URL = window.API_URL || `http://${window.location.hostname}:8001`;

// Generic fetch helper
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
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
