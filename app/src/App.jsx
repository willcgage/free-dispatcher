// App.jsx - Main frontend for Train Dispatcher Admin UI
// Provides CRUD management for Dispatchers, Districts, Trains, and Modules
// Uses a generic EntityManager component for each entity type

import React, { useEffect, useState, useRef } from "react";
import {
  getDispatchers, createDispatcher, updateDispatcher, deleteDispatcher,
  getDistricts, createDistrict, updateDistrict, deleteDistrict,
  getTrains, createTrain, updateTrain, deleteTrain,
  getModules, createModule, updateModule, deleteModule,
  // Add these:
  getModuleEndplates, createModuleEndplate, updateModuleEndplate, deleteModuleEndplate
} from "./api";

/**
 * EntityManager - Generic CRUD UI for a given entity type.
 * Props:
 *   name: string - Entity name (e.g. "Dispatchers")
 *   getAll, create, update, remove: API functions for CRUD
 *   fields: Array<{ name, label, ... }> - Field definitions for form/table
 *   selectOptions: { [fieldName]: Array<{id, name}> } - Dropdown options
 *   onRefresh: callback to trigger parent refresh
 *   extraData: optional extra props
 */
function EntityManager({ name, getAll, create, update, remove, fields, selectOptions = {}, onRefresh, extraData = {}, refreshKey }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [showEditPopup, setShowEditPopup] = useState(false); // For popup
  const [popupForm, setPopupForm] = useState({});
  // Popup state for creation
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [createForm, setCreateForm] = useState({});

  // Define refreshAllOptions at the top of EntityManager so it is always in scope
  const refreshAllOptions = async () => {
    if (name === "Modules" || name === "Module Endplates") {
      if (typeof getModules === "function") {
        const modulesList = await getModules();
        setDynamicOptions((opts) => ({ ...opts, module_id: modulesList, connected_module_id: modulesList }));
      }
      if (typeof getDistricts === "function") {
        const districtsList = await getDistricts();
        setDynamicOptions((opts) => ({ ...opts, district_id: districtsList }));
      }
    }
    if (name === "Districts") {
      if (typeof getDispatchers === "function") {
        const dispatchersList = await getDispatchers();
        setDynamicOptions((opts) => ({ ...opts, dispatcher_id: dispatchersList }));
      }
    }
  };

  // Fetch items and, if needed, dynamic select options
  const fetchItems = async () => {
    try {
      setItems(await getAll());
      // If this is the Modules manager, refresh districts for the dropdown
      if (name === "Modules") {
        const districts = await getDistricts();
        setDynamicOptions((opts) => ({ ...opts, district_id: districts }));
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { fetchItems(); }, [refreshKey, onRefresh, items.length]);

  // When the form is opened for create/edit, refresh districts for Modules
  useEffect(() => {
    if (name === "Modules" && (showEditPopup || Object.keys(form).length > 0)) {
      getDistricts().then((districts) => setDynamicOptions((opts) => ({ ...opts, district_id: districts })));
    }
  }, [showEditPopup, form, name]);

  // Remove district refresh for Modules

  const handleChange = (e) => {
    let value = e.target.value;
    // Convert district_id to integer for Modules
    if (e.target.name === "district_id") {
      value = value === "" ? "" : Number(value);
    }
    setForm({ ...form, [e.target.name]: value });
  };

  // For popup edit
  const handlePopupChange = (e) => {
    let value = e.target.value;
    if (["district_id", "dispatcher_id", "id", "number_of_endplates"].includes(e.target.name)) {
      value = value === "" ? "" : Number(value);
    }
    setPopupForm({ ...popupForm, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Validation for Districts
    if (name === "Districts" && (!form.dispatcher_id || form.dispatcher_id === "")) {
      window.alert("You must select a Dispatcher for this District.");
      return;
    }
    try {
      if (editingId) {
        await update(editingId, form);
      } else {
        await create(form);
      }
      setForm({});
      setEditingId(null);
      fetchItems();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEdit = (item) => {
    setPopupForm({ ...item, is_yard: !!item.is_yard }); // Ensure boolean for checkbox
    setShowEditPopup(true);
  };

  const handlePopupSave = async () => {
    // Debug: show outgoing payload
    alert("Saving Module with payload: " + JSON.stringify(popupForm));
    try {
      await update(popupForm.id, popupForm);
      setShowEditPopup(false);
      setPopupForm({});
      fetchItems();
      // After create, update, or delete, always refresh dropdown options for all popups
      await refreshAllOptions();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this record?")) {
      await remove(id);
      fetchItems();
      // After create, update, or delete, always refresh dropdown options for all popups
      await refreshAllOptions();
      if (onRefresh) onRefresh();
    }
  };

  // Helper to get next ID
  const getNextId = () => {
    if (!items.length) return 1;
    const maxId = Math.max(...items.map(i => Number(i.id) || 0));
    return maxId + 1;
  };

  // Popup for creation
  const handleOpenCreate = () => {
    const nextIdField = fields.find(f => f.name === "id");
    let initial = {};
    if (nextIdField) initial.id = getNextId();
    // Set default for number_of_endplates
    if (fields.find(f => f.name === "number_of_endplates")) initial.number_of_endplates = 1;
    setCreateForm(initial);
    setShowCreatePopup(true);
  };

  // Handle create form changes
  const handleCreateChange = (e) => {
    let value = e.target.value;
    if (["district_id", "dispatcher_id", "id", "number_of_endplates"].includes(e.target.name)) {
      value = value === "" ? "" : Number(value);
    }
    setCreateForm({ ...createForm, [e.target.name]: value });
  };

  // Handle create submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    // Ensure district_id is a number or undefined
    const payload = { ...createForm };
    if (payload.district_id === "") delete payload.district_id;
    if (typeof payload.district_id === "string") payload.district_id = Number(payload.district_id);
    try {
      await create(payload);
      setShowCreatePopup(false);
      setCreateForm({});
      fetchItems();
      // After create, update, or delete, always refresh dropdown options for all popups
      await refreshAllOptions();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const mergedSelectOptions = { ...selectOptions, ...dynamicOptions };

  // Show all fields for all tables in the main page table and form
  const visibleFields = fields;

  // Helper for Module Endplates: returns available endplate numbers for the selected module
  function filteredEndplateNumbers() {
    // Only applies to Module Endplates
    if (name !== "Module Endplates") return [];
    // Determine which form is open and get the selected module_id
    const selectedModuleId = showCreatePopup
      ? createForm.module_id
      : showEditPopup
        ? popupForm.module_id
        : null;
    if (!selectedModuleId) return [];
    // Get the list of modules from selectOptions or dynamicOptions
    const modulesList = (selectOptions.module_id || dynamicOptions.module_id || []);
    // Find the selected module object
    const moduleObj = modulesList.find(m => String(m.id) === String(selectedModuleId));
    // Use the module's number_of_endplates, or default to 8
    const count = moduleObj && moduleObj.number_of_endplates ? moduleObj.number_of_endplates : 8;
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  return (
    <div style={{ border: "1px solid #ccc", margin: 16, padding: 16 }}>
      <h2>{name}</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <button onClick={handleOpenCreate} style={{ marginBottom: 8 }}>Create New {name.slice(0, -1)}</button>
      {/* Table of items */}
      {items.length > 0 ? (
        <table style={{ width: '100%', marginBottom: 16, background: '#222', color: '#fff', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {fields.map(f => (
                <th key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{f.label}</th>
              ))}
              <th style={{ border: '1px solid #444', padding: 4 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id || item.name}>
                {fields.map(f => {
                  // Show district name for Modules table
                  if (name === "Modules" && f.name === "district_id") {
                    const district = (selectOptions.district_id || dynamicOptions.district_id || []).find(d => d.id === item.district_id);
                    return <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{district ? district.name : item.district_id}</td>;
                  }
                  // Show True/False for is_yard in Modules table
                  if (name === "Modules" && f.name === "is_yard") {
                    return <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{item.is_yard ? "True" : "False"}</td>;
                  }
                  // Show module name for Module Endplates table
                  if (name === "Module Endplates" && f.name === "module_id") {
                    const module = (selectOptions.module_id || dynamicOptions.module_id || []).find(m => m.id === item.module_id);
                    return <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{module ? module.name : item.module_id}</td>;
                  }
                  // Show connected module name for Module Endplates table
                  if (name === "Module Endplates" && f.name === "connected_module_id") {
                    const module = (selectOptions.connected_module_id || dynamicOptions.connected_module_id || []).find(m => m.id === item.connected_module_id);
                    return <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{module ? module.name : item.connected_module_id}</td>;
                  }
                  // Show dispatcher name for Districts table
                  if (name === "Districts" && f.name === "dispatcher_id") {
                    const dispatcher = (selectOptions.dispatcher_id || dynamicOptions.dispatcher_id || []).find(d => d.id === item.dispatcher_id);
                    return <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{dispatcher ? dispatcher.name : item.dispatcher_id}</td>;
                  }
                  return (
                    <td key={f.name} style={{ border: '1px solid #444', padding: 4 }}>{item[f.name]}</td>
                  );
                })}
                <td style={{ border: '1px solid #444', padding: 4 }}>
                  <button onClick={() => handleEdit(item)} style={{ marginRight: 8 }}>Edit</button>
                  <button onClick={() => handleDelete(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ marginBottom: 16, color: '#bbb' }}>No records found.</div>
      )}
      {/* Creation Popup */}
      {showCreatePopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 8, minWidth: 320, position: 'relative' }}>
            <h3>Create {name.slice(0, -1)}</h3>
            <form onSubmit={handleCreateSubmit}>
              {fields.map((f) => {
                if (name === "Module Endplates" && f.name === "endplate_number") {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <select
                          name={f.name}
                          value={createForm[f.name] || ""}
                          onChange={handleCreateChange}
                          required={f.required}
                        >
                          <option value="">Select {f.label}</option>
                          {filteredEndplateNumbers().map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                }
                if (mergedSelectOptions[f.name]) {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <select
                          name={f.name}
                          value={createForm[f.name] || ""}
                          onChange={handleCreateChange}
                          required={f.required}
                        >
                          <option value="">Select {f.label}</option>
                          {mergedSelectOptions[f.name].map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                }
                if (f.type === "checkbox") {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <input
                          name={f.name}
                          type="checkbox"
                          checked={!!createForm[f.name]}
                          onChange={e => setCreateForm({ ...createForm, [f.name]: e.target.checked })}
                        />
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={f.name} style={{ marginBottom: 8 }}>
                    <label>{f.label}: 
                      <input
                        name={f.name}
                        value={createForm[f.name] || ""}
                        onChange={handleCreateChange}
                        type={f.type || "text"}
                        min={f.min || undefined}
                        required={f.required}
                        readOnly={f.name === "id"}
                      />
                    </label>
                  </div>
                );
              })}
              <div style={{ marginTop: 16 }}>
                <button type="submit">Create</button>
                <button type="button" style={{ marginLeft: 12 }} onClick={() => { setShowCreatePopup(false); setCreateForm({}); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Popup (all entities) */}
      {showEditPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 8, minWidth: 320, position: 'relative' }}>
            <h3>Edit {name.slice(0, -1)}</h3>
            <form onSubmit={async (e) => { e.preventDefault(); await handlePopupSave(); }}>
              {fields.map((f) => {
                if (name === "Module Endplates" && f.name === "endplate_number") {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <select
                          name={f.name}
                          value={popupForm[f.name] || ""}
                          onChange={handlePopupChange}
                          required={f.required}
                        >
                          <option value="">Select {f.label}</option>
                          {filteredEndplateNumbers().map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                }
                if (mergedSelectOptions[f.name]) {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <select
                          name={f.name}
                          value={popupForm[f.name] || ""}
                          onChange={handlePopupChange}
                          required={f.required}
                        >
                          <option value="">Select {f.label}</option>
                          {mergedSelectOptions[f.name].map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                }
                if (f.type === "checkbox") {
                  return (
                    <div key={f.name} style={{ marginBottom: 8 }}>
                      <label>{f.label}: 
                        <input
                          name={f.name}
                          type="checkbox"
                          checked={!!popupForm[f.name]}
                          onChange={e => setPopupForm({ ...popupForm, [f.name]: e.target.checked })}
                        />
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={f.name} style={{ marginBottom: 8 }}>
                    <label>{f.label}: 
                      <input
                        name={f.name}
                        value={popupForm[f.name] || ""}
                        onChange={handlePopupChange}
                        type={f.type || "text"}
                        min={f.min || undefined}
                        required={f.required}
                        readOnly={f.name === "id"}
                      />
                    </label>
                  </div>
                );
              })}
              <div style={{ marginTop: 16 }}>
                <button type="submit">Save</button>
                <button type="button" style={{ marginLeft: 12 }} onClick={() => { setShowEditPopup(false); setPopupForm({}); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ConfigurationPage - UI for DB import/export/create and backend IP display.
 * Props:
 *   onDbChange: callback to trigger parent refresh after DB change
 */
function ConfigurationPage({ onDbChange, onBackToAdmin }) {
  const [message, setMessage] = useState("");
  const [ip, setIp] = useState("");
  const [dbStatus, setDbStatus] = useState(null);
  const [dbStatusLoading, setDbStatusLoading] = useState(true);
  const [orphanInterval, setOrphanInterval] = useState(60);
  const [intervalInput, setIntervalInput] = useState(60);
  const [lastOrphanCheck, setLastOrphanCheck] = useState(null);
  const [lastCheckLoading, setLastCheckLoading] = useState(false);
  const fileInput = useRef();

  useEffect(() => {
    fetchWithBackendUrl('/ip')
      .then((res) => res.json())
      .then((data) => setIp(Array.isArray(data.ip) ? data.ip[0] : data.ip))
      .catch(() => setIp("Unavailable"));
    // Fetch service record counts and orphan info
    fetchWithBackendUrl('/database/status')
      .then(res => res.json())
      .then(setDbStatus)
      .finally(() => setDbStatusLoading(false));
    // Fetch orphan check interval and last check
    fetchWithBackendUrl('/admin/orphan-check-interval/')
      .then(res => res.json())
      .then(data => {
        setOrphanInterval(data.interval);
        setIntervalInput(data.interval);
      });
    fetchWithBackendUrl('/admin/last-orphan-check/')
      .then(res => res.json())
      .then(setLastOrphanCheck)
      .finally(() => setLastCheckLoading(false));
  }, []);

  const handleImport = async (e) => {
    e.preventDefault();
    const file = fileInput.current.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setMessage("Uploading...");
    try {
      const res = await fetchWithBackendUrl('/admin/import-db/', {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMessage(data.message || (data.ok ? "Import successful" : "Import failed"));
      if (data.ok) onDbChange();
    } catch (e) {
      setMessage("Import failed: " + e.message);
    }
  };

  const handleCreate = async () => {
    setMessage("Creating new database...");
    try {
      const res = await fetchWithBackendUrl('/admin/create-db/', { method: "POST" });
      const data = await res.json();
      setMessage(data.message || (data.ok ? "Database created" : "Failed to create"));
      if (data.ok) onDbChange();
    } catch (e) {
      setMessage("Failed: " + e.message);
    }
  };

  const handleExport = async () => {
    setMessage("Exporting...");
    try {
      const res = await fetchWithBackendUrl('/admin/export-db/');
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dispatcher_db_export";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage("Export successful");
    } catch (e) {
      setMessage("Export failed: " + e.message);
    }
  };

  const handleIntervalChange = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetchWithBackendUrl('/admin/orphan-check-interval/', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: Number(intervalInput) })
      });
      const data = await res.json();
      if (data.ok) setOrphanInterval(data.interval);
      else setMessage(data.error || "Failed to set interval");
    } catch (e) {
      setMessage("Failed to set interval: " + e.message);
    }
  };

  return (
    <div className="config-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>Database Configuration</h2>
      <button onClick={onBackToAdmin} style={{ marginBottom: 16, fontWeight: 'bold' }}>Back to Admin</button>
      {/* Service Record Counts */}
      <div style={{ margin: "12px 0" }}>
        <b>Service Record Counts:</b>
        {dbStatusLoading ? <span>Loading...</span> : dbStatus && dbStatus.service_counts ? (
          <ul>
            <li>Dispatchers: {dbStatus.service_counts.dispatchers}</li>
            <li>Districts: {dbStatus.service_counts.districts}</li>
            <li>Trains: {dbStatus.service_counts.trains}</li>
            <li>Modules: {dbStatus.service_counts.modules}</li>
            <li>Module Endplates: {dbStatus.service_counts.module_endplates}</li>
          </ul>
        ) : <span>Unavailable</span>}
      </div>
      {/* Database Import/Export/Reset */}
      <form onSubmit={handleImport} style={{ display: "inline-block", marginRight: 16 }}>
        <input type="file" ref={fileInput} accept=".sql,.db,.sqlite,.backup" />
        <button type="submit">Import Database File</button>
      </form>
      <button onClick={handleCreate}>Create New Database</button>
      <button onClick={handleExport} style={{ marginLeft: 12 }}>Export Database</button>
      <div style={{ marginTop: 12, color: "#333" }}>{message}</div>
      {/* Database Troubleshooting */}
      <div className="db-troubleshooting" style={{ marginTop: 32, padding: 16, borderRadius: 8, border: '1px solid #ccc' }}>
        <h3 style={{ color: '#333' }}>Database Troubleshooting</h3>
        <form onSubmit={handleIntervalChange} style={{ marginBottom: 16 }}>
          <label>
            Orphan Check Interval (seconds):
            <input
              type="number"
              min={10}
              value={intervalInput}
              onChange={e => setIntervalInput(e.target.value)}
              style={{ marginLeft: 8, width: 80 }}
            />
          </label>
          <button type="submit" style={{ marginLeft: 8 }}>
            Set Interval
          </button>
          <span style={{ marginLeft: 12, color: '#555' }}>
            Current: {orphanInterval}s
          </span>
        </form>
        <div style={{ marginBottom: 12 }}>
          <b>Last Orphan Check:</b> {lastOrphanCheck && lastOrphanCheck.last_run ? new Date(lastOrphanCheck.last_run * 1000).toLocaleString() : 'Never'}
          <br />
          <b>Orphan Districts:</b> {lastOrphanCheck && lastOrphanCheck.orphan_districts ? lastOrphanCheck.orphan_districts.length : 0}
          <br />
          <b>Orphan Modules:</b> {lastOrphanCheck && lastOrphanCheck.orphan_modules ? lastOrphanCheck.orphan_modules.length : 0}
          <br />
          <b>Orphan Module Endplates:</b> {lastOrphanCheck && lastOrphanCheck.orphan_endplates ? lastOrphanCheck.orphan_endplates.length : 0}
        </div>
        <p>If you suspect orphan records (e.g., districts without a valid dispatcher, modules without a valid district), you can review and clean them up in the Admin panel.</p>
      </div>
    </div>
  );
}
/**
 *   setPage: setter for admin subpage
 *   onDbChange: callback for DB changes
 */
function Admin({ page, setPage, onDbChange }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWithBackendUrl('/status')
      .then((res) => res.json())
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="dashboard-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>System Admin</h2>
      <div style={{ marginBottom: 16 }}>
        <b>Backend Version:</b> {status && status.backend_version}
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Frontend Version:</b> {status && status.frontend_version}
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Backend IP Address:</b> {status && status.ip && status.ip.length ? status.ip[0] : "Unknown"}
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Current Time:</b> {status && status.time}
      </div>
      <div style={{ marginTop: 12, color: "#bbb" }}>{status && status.message}</div>
      <button onClick={() => setPage("admin-config")} style={{ marginTop: 24, padding: '8px 16px', fontWeight: 'bold' }}>
        Go to Configuration
      </button>
    </div>
  );
}

// Helper to await backend URL for fetch
async function fetchWithBackendUrl(path, options) {
  const url = await getBackendUrl();
  return fetch(`${url}${path}`, options);
}

/**
 * Menu - Simple navigation bar for switching between Admin and Main pages.
 * Props:
 *   current: current page
 *   setCurrent: setter for page
 */
function Menu({ current, setCurrent }) {
  return (
    <nav style={{ display: "flex", gap: 16, marginBottom: 24, borderBottom: "1px solid #ccc", paddingBottom: 8 }}>
      <button onClick={() => setCurrent("admin")}
        style={{ fontWeight: current === "admin" ? "bold" : "normal" }}>
        Admin
      </button>
      <button onClick={() => setCurrent("main")}
        style={{ fontWeight: current === "main" ? "bold" : "normal" }}>
        Main
      </button>
    </nav>
  );
}

/**
 * ThemeSwitcher - Component to select light, dark, or system theme.
 */
function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontWeight: 500, marginRight: 8 }}>Theme:</label>
      <select value={theme} onChange={e => setTheme(e.target.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}

// Utility to get backend URL based on environment
let backendUrlCache = null;
async function resolveBackendUrl() {
  if (backendUrlCache) return backendUrlCache;
  // Try to fetch /ip from the current host:8001
  const { protocol } = window.location;
  const candidateHost = window.location.hostname;
  const candidateUrl = `${protocol}//${candidateHost}:8001`;
  try {
    const res = await fetch(`${candidateUrl}/ip`);
    const data = await res.json();
    // If backend returns a list of IPs, try each
    const ips = Array.isArray(data.ip) ? data.ip : [data.ip];
    for (const ip of ips) {
      const testUrl = `${protocol}//${ip}:8001`;
      try {
        const statusRes = await fetch(`${testUrl}/status`);
        if (statusRes.ok) {
          backendUrlCache = testUrl;
          return testUrl;
        }
      } catch (e) { /* try next */ }
    }
  } catch (e) { /* fallback below */ }
  // Fallback: use current hostname
  backendUrlCache = candidateUrl;
  return candidateUrl;
}

function getBackendUrl() {
  // Returns a promise that resolves to the backend URL
  return resolveBackendUrl();
}

/**
 * App - Main application component.
 * Handles state for all entities and page navigation.
 */
export default function App() {
  const [dbRefresh, setDbRefresh] = useState(0);
  const [page, setPage] = useState("admin");
  const [adminPage, setAdminPage] = useState("admin-overview");
  const [dispatchers, setDispatchers] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [modules, setModules] = useState([]);
  const [districtsRefresh, setDistrictsRefresh] = useState(0);
  const [modulesRefresh, setModulesRefresh] = useState(0); // NEW

  // Only fetch data for main page, not on admin panel load
  useEffect(() => {
    if (page === "main") {
      getDispatchers().then(setDispatchers);
      getDistricts().then(setDistricts);
      getModules().then(setModules);
    }
  }, [page, dbRefresh]);

  // When a district is created, updated, or deleted, refresh districts and trigger modules refresh
  const handleDistrictsRefresh = () => {
    setDistrictsRefresh((v) => v + 1);
    getDistricts().then(setDistricts);
    setModulesRefresh((v) => v + 1); // Also refresh modules
  };

  // When a dispatcher is updated, refresh dispatchers and districts (and thus modules)
  const handleDispatchersRefresh = () => {
    setDbRefresh((v) => v + 1);
    setDistrictsRefresh((v) => v + 1);
    setModulesRefresh((v) => v + 1);
  };

  return (
    <div style={{ maxWidth: 900, margin: "auto" }}>
      <h1>Train Dispatcher Admin</h1>
      <ThemeSwitcher />
      <Menu current={page} setCurrent={setPage} />
      {page === "admin" ? (
        adminPage === "admin-config" ? (
          <ConfigurationPage onDbChange={() => setDbRefresh((v) => v + 1)} onBackToAdmin={() => setAdminPage("admin-overview")} />
        ) : (
          <Admin page={adminPage} setPage={setAdminPage} onDbChange={() => setDbRefresh((v) => v + 1)} />
        )
      ) : (
        <>
          <EntityManager
            name="Dispatchers"
            getAll={getDispatchers}
            create={async (data) => {
              await createDispatcher(data);
              handleDispatchersRefresh();
            }}
            update={async (id, data) => {
              await updateDispatcher(id, data);
              handleDispatchersRefresh();
            }}
            remove={async (id) => {
              await deleteDispatcher(id);
              handleDispatchersRefresh();
            }}
            fields={[
              { name: "id", label: "ID" },
              { name: "name", label: "Name" },
            ]}
            key={"dispatchers-" + dbRefresh}
            refreshKey={dbRefresh}
          />
          <EntityManager
            name="Districts"
            getAll={getDistricts}
            create={async (data) => {
              await createDistrict(data);
              handleDistrictsRefresh();
            }}
            update={async (id, data) => {
              await updateDistrict(id, data);
              handleDistrictsRefresh();
            }}
            remove={async (id) => {
              await deleteDistrict(id);
              handleDistrictsRefresh();
            }}
            fields={[
              { name: "id", label: "ID" },
              { name: "name", label: "Name" },
              { name: "dispatcher_id", label: "Dispatcher" },
            ]}
            selectOptions={{ dispatcher_id: dispatchers }}
            key={"districts-" + dbRefresh + "-" + districtsRefresh}
            onRefresh={handleDistrictsRefresh}
            extraData={{ dispatchers }}
            refreshKey={dbRefresh + '-' + districtsRefresh}
          />
          <EntityManager
            name="Trains"
            getAll={getTrains}
            create={createTrain}
            update={updateTrain}
            remove={deleteTrain}
            fields={[
              { name: "name", label: "Name" },
              { name: "status", label: "Status" },
            ]}
            key={"trains-" + dbRefresh}
            refreshKey={dbRefresh}
          />
          <EntityManager
            name="Modules"
            getAll={getModules}
            create={createModule}
            update={updateModule}
            remove={deleteModule}
            fields={[
              { name: "id", label: "ID" },
              { name: "name", label: "Name" },
              { name: "district_id", label: "District" },
              { name: "number_of_endplates", label: "Number of Endplates", type: "number", min: 1, required: true, default: 1 },
              { name: "owner", label: "Owner" },
              { name: "owner_email", label: "Owner Email Address" },
              { name: "is_yard", label: "Yard?", type: "checkbox" },
            ]}
            selectOptions={{ district_id: districts }}
            key={"modules-" + dbRefresh}
            refreshKey={dbRefresh + '-' + modulesRefresh}
          />
          <EntityManager
            name="Module Endplates"
            getAll={getModuleEndplates}
            create={createModuleEndplate}
            update={updateModuleEndplate}
            remove={deleteModuleEndplate}
            fields={[
              { name: "id", label: "ID" },
              { name: "module_id", label: "Module" },
              { name: "endplate_number", label: "Endplate Number", type: "number", min: 1, required: true },
              { name: "connected_module_id", label: "Connected Module" },
            ]}
            selectOptions={{ module_id: modules, connected_module_id: modules }}
            key={"module-endplates-" + dbRefresh}
            refreshKey={dbRefresh}
          />
        </>
      )}
    </div>
  );
}
