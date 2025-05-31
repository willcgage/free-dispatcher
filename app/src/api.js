const API_URL = "http://localhost:8001";

// Generic fetch helper
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Dispatchers
export const getDispatchers = () => apiFetch("/dispatchers/");
export const createDispatcher = (data) => apiFetch("/dispatchers/", { method: "POST", body: JSON.stringify(data) });
export const updateDispatcher = (id, data) => apiFetch(`/dispatchers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDispatcher = (id) => apiFetch(`/dispatchers/${id}`, { method: "DELETE" });

// Districts
export const getDistricts = () => apiFetch("/districts/");
export const createDistrict = (data) => apiFetch("/districts/", { method: "POST", body: JSON.stringify(data) });
export const updateDistrict = (id, data) => apiFetch(`/districts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDistrict = (id) => apiFetch(`/districts/${id}`, { method: "DELETE" });

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

// Module Endplates API
export const getModuleEndplates = () => apiFetch("/module_endplates/");
export const createModuleEndplate = (data) => apiFetch("/module_endplates/", { method: "POST", body: JSON.stringify(data) });
export const updateModuleEndplate = (id, data) => apiFetch(`/module_endplates/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModuleEndplate = (id) => apiFetch(`/module_endplates/${id}`, { method: "DELETE" });
