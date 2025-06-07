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

// Layouts
export const getLayouts = () => apiFetch("/layouts/");
export const createLayout = (data) => apiFetch("/layouts/", { method: "POST", body: JSON.stringify(data) });
export const updateLayout = (id, data) => apiFetch(`/layouts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteLayout = (id) => apiFetch(`/layouts/${id}`, { method: "DELETE" });

// LayoutDistricts
export const getLayoutDistricts = () => apiFetch("/layout_districts/");
export const createLayoutDistrict = (data) => apiFetch("/layout_districts/", { method: "POST", body: JSON.stringify(data) });
export const updateLayoutDistrict = (id, data) => apiFetch(`/layout_districts/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteLayoutDistrict = (id) => apiFetch(`/layout_districts/${id}`, { method: "DELETE" });

// LayoutDistrictModules
export const getLayoutDistrictModules = () => apiFetch("/layout_district_modules/");
export const createLayoutDistrictModule = (data) => apiFetch("/layout_district_modules/", { method: "POST", body: JSON.stringify(data) });
export const updateLayoutDistrictModule = (id, data) => apiFetch(`/layout_district_modules/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteLayoutDistrictModule = (id) => apiFetch(`/layout_district_modules/${id}`, { method: "DELETE" });
