// App.jsx - Main frontend for Train Dispatcher Admin UI
// Provides CRUD management for Dispatchers, Districts, Trains, and Modules
// Uses a generic EntityManager component for each entity type

import React, { useEffect, useState, useRef } from "react";
import {
  getDispatchers, createDispatcher, updateDispatcher, deleteDispatcher,
  getDistricts, createDistrict, updateDistrict, deleteDistrict,
  getTrains, createTrain, updateTrain, deleteTrain,
  getModules, createModule, updateModule, deleteModule
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
function EntityManager({ name, getAll, create, update, remove, fields, selectOptions = {}, onRefresh, extraData = {} }) {
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

  useEffect(() => { fetchItems(); }, [onRefresh, items.length]);

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
    setPopupForm(item);
    setShowEditPopup(true);
  };

  const handlePopupSave = async () => {
    try {
      await update(popupForm.id, popupForm);
      setShowEditPopup(false);
      setPopupForm({});
      fetchItems();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this record?")) {
      await remove(id);
      fetchItems();
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
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const mergedSelectOptions = { ...selectOptions, ...dynamicOptions };

  // Show all fields for all tables in the main page table and form
  const visibleFields = fields;

  return (
    <div style={{ border: "1px solid #ccc", margin: 16, padding: 16 }}>
      <h2>{name}</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <button onClick={handleOpenCreate} style={{ marginBottom: 8 }}>Create New {name.slice(0, -1)}</button>
      {/* Creation Popup */}
      {showCreatePopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 8, minWidth: 320, position: 'relative' }}>
            <h3>Create {name.slice(0, -1)}</h3>
            <form onSubmit={handleCreateSubmit}>
              {fields.map((f) => (
                mergedSelectOptions[f.name] ? (
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
                ) : (
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
                )
              ))}
              <div style={{ marginTop: 16 }}>
                <button type="submit">Create</button>
                <button type="button" style={{ marginLeft: 12 }} onClick={() => { setShowCreatePopup(false); setCreateForm({}); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <table>
        <thead>
          <tr>
            {fields.map((f) => <th key={f.name}>{f.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={name === "Dispatchers" ? `${item.id}-${item.name}` : item.id}>
              {fields.map((f) => {
                // For Modules, show district name instead of ID
                if (name === "Modules" && f.name === "district_id" && mergedSelectOptions.district_id) {
                  const district = mergedSelectOptions.district_id.find(d => d.id === item.district_id);
                  return <td key={f.name}>{district ? district.name : item.district_id}</td>;
                }
                // For Districts, show dispatcher name instead of ID
                if (name === "Districts" && f.name === "dispatcher_id" && extraData && extraData.dispatchers) {
                  const dispatcher = extraData.dispatchers.find(d => d.id === item.dispatcher_id);
                  return <td key={f.name}>{dispatcher ? dispatcher.name : item.dispatcher_id}</td>;
                }
                return <td key={f.name}>{item[f.name]}</td>;
              })}
              <td>
                <button onClick={() => handleEdit(item)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Popup for editing record (all entities) */}
      {showEditPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 8, minWidth: 320, position: 'relative' }}>
            <h3>Edit {name.slice(0, -1)}</h3>
            <form onSubmit={async (e) => { e.preventDefault(); await handlePopupSave(); }}>
              {fields.map((f) => (
                mergedSelectOptions[f.name] ? (
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
                ) : (
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
                )
              ))}
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
function ConfigurationPage({ onDbChange }) {
  const [message, setMessage] = useState("");
  const [ip, setIp] = useState("");
  const fileInput = useRef();

  useEffect(() => {
    fetch("http://localhost:8001/ip")
      .then((res) => res.json())
      .then((data) => setIp(data.ip))
      .catch(() => setIp("Unavailable"));
  }, []);

  const handleImport = async (e) => {
    e.preventDefault();
    const file = fileInput.current.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setMessage("Uploading...");
    try {
      const res = await fetch("http://localhost:8001/admin/import-db/", {
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
      const res = await fetch("http://localhost:8001/admin/create-db/", { method: "POST" });
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
      const res = await fetch("http://localhost:8001/admin/export-db/");
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

  return (
    <div className="config-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>Database Configuration</h2>
      <div style={{ marginBottom: 8 }}><b>Backend IP Address:</b> {ip}</div>
      <form onSubmit={handleImport} style={{ display: "inline-block", marginRight: 16 }}>
        <input type="file" ref={fileInput} accept=".sql,.db,.sqlite,.backup" />
        <button type="submit">Import Database File</button>
      </form>
      <button onClick={handleCreate}>Create New Database</button>
      <button onClick={handleExport} style={{ marginLeft: 16 }}>Export Database</button>
      {message && <div style={{ marginTop: 8 }}>{message}</div>}
    </div>
  );
}

/**
 * Admin - System admin dashboard and troubleshooting tools.
 * Props:
 *   page: current admin subpage
 *   setPage: setter for admin subpage
 *   onDbChange: callback for DB changes
 */
function Admin({ page, setPage, onDbChange }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [showOrphans, setShowOrphans] = useState(false);
  const [orphansLoaded, setOrphansLoaded] = useState(false);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanDistricts, setOrphanDistricts] = useState([]);
  const [orphanModules, setOrphanModules] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [deleting, setDeleting] = useState(false);
  // Orphan check interval state
  const [orphanInterval, setOrphanInterval] = useState(60);
  const [intervalInput, setIntervalInput] = useState(60);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [lastOrphanCheck, setLastOrphanCheck] = useState(null);
  const [lastCheckLoading, setLastCheckLoading] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8001/status")
      .then((res) => res.json())
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetch("http://localhost:8001/admin/orphan-check-interval/")
      .then(res => res.json())
      .then(data => {
        setOrphanInterval(data.interval);
        setIntervalInput(data.interval);
      });
    fetch("http://localhost:8001/admin/last-orphan-check/")
      .then(res => res.json())
      .then(setLastOrphanCheck);
  }, []);

  const handleIntervalChange = async (e) => {
    e.preventDefault();
    setIntervalLoading(true);
    try {
      const res = await fetch("http://localhost:8001/admin/orphan-check-interval/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: Number(intervalInput) })
      });
      const data = await res.json();
      if (data.ok) setOrphanInterval(data.interval);
      else alert(data.error || "Failed to set interval");
    } finally {
      setIntervalLoading(false);
    }
  };

  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;
  if (!status) return <div>Loading admin panel...</div>;

  return (
    <div className="dashboard-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>System Admin</h2>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setPage("admin-overview")}
          style={{ fontWeight: page === "admin-overview" ? "bold" : "normal", marginRight: 12 }}
        >
          Overview
        </button>
        <button
          onClick={() => setPage("admin-config")}
          style={{ fontWeight: page === "admin-config" ? "bold" : "normal" }}
        >
          Configuration
        </button>
      </div>
      {page === "admin-overview" && (
        <>
          <div><b>Backend Version:</b> {status.backend_version}</div>
          <div style={{ margin: "12px 0" }}>
            <b>Service Record Counts:</b>
            <ul>
              <li>Dispatchers: {status.service_counts.dispatchers}</li>
              <li>Districts: {status.service_counts.districts}</li>
              <li>Modules: {status.service_counts.modules}</li>
              <li>Trains: {status.service_counts.trains}</li>
            </ul>
          </div>
          <div>
            <b>Recent Backend Logs:</b>
            <pre style={{ maxHeight: 200, overflow: "auto", padding: 8 }}>
              {status.logs && status.logs.length ? status.logs.join("") : "No logs."}
            </pre>
          </div>
          <div style={{ marginTop: 12, color: "#bbb" }}>{status.message}</div>
          <div style={{ marginTop: 32, padding: 16, background: '#f5f5f5', borderRadius: 8, color: '#222', border: '1px solid #bbb' }}>
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
              <button type="submit" disabled={intervalLoading} style={{ marginLeft: 8 }}>
                {intervalLoading ? "Saving..." : "Set Interval"}
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
            </div>
            <p>If you suspect orphan records (e.g., districts without a valid dispatcher, modules without a valid district), you can review and clean them up here.</p>
            <button
              style={{ background: '#333', color: '#fff', border: '1px solid #40e0d0', marginBottom: 12 }}
              onClick={async () => {
                setShowOrphans((v) => !v);
                if (!orphansLoaded) {
                  setOrphanLoading(true);
                  try {
                    const res = await fetch('http://localhost:8001/admin/orphan-records/');
                    const data = await res.json();
                    setOrphanDistricts(data.orphan_districts || []);
                    setOrphanModules(data.orphan_modules || []);
                    setOrphansLoaded(true);
                  } catch (e) {
                    alert('Failed to load orphan records: ' + e.message);
                  } finally {
                    setOrphanLoading(false);
                  }
                }
              }}
            >{showOrphans ? 'Hide' : 'Show'} Orphan Records</button>
            {showOrphans && (
              <div>
                {orphanLoading ? (
                  <div>Loading orphan records...</div>
                ) : (
                  <>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setDeleting(true);
                      try {
                        const res = await fetch('http://localhost:8001/admin/delete-orphans/', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            district_ids: selectedDistricts,
                            module_ids: selectedModules,
                          }),
                        });
                        const data = await res.json();
                        alert(data.message || (data.ok ? 'Cleanup successful' : 'Cleanup failed'));
                        setOrphansLoaded(false);
                        setShowOrphans(false);
                        setSelectedDistricts([]);
                        setSelectedModules([]);
                        window.location.reload();
                      } catch (e) {
                        alert('Cleanup failed: ' + e.message);
                      } finally {
                        setDeleting(false);
                      }
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        <b>Orphan Districts:</b>
                        {orphanDistricts.length === 0 ? (
                          <span style={{ marginLeft: 8 }}>None</span>
                        ) : (
                          <ul>
                            {orphanDistricts.map(d => (
                              <li key={d.id}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={selectedDistricts.includes(d.id)}
                                    onChange={e => {
                                      setSelectedDistricts(sel =>
                                        e.target.checked
                                          ? [...sel, d.id]
                                          : sel.filter(id => id !== d.id)
                                      );
                                    }}
                                  />
                                  {` ${d.name} (ID: ${d.id}, Dispatcher ID: ${d.dispatcher_id})`}
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <b>Orphan Modules:</b>
                        {orphanModules.length === 0 ? (
                          <span style={{ marginLeft: 8 }}>None</span>
                        ) : (
                          <ul>
                            {orphanModules.map(m => (
                              <li key={m.id}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={selectedModules.includes(m.id)}
                                    onChange={e => {
                                      setSelectedModules(sel =>
                                        e.target.checked
                                          ? [...sel, m.id]
                                          : sel.filter(id => id !== m.id)
                                      );
                                    }}
                                  />
                                  {` ${m.name} (ID: ${m.id}, District ID: ${m.district_id})`}
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button type="submit" disabled={deleting || (selectedDistricts.length === 0 && selectedModules.length === 0)}>
                        {deleting ? 'Deleting...' : 'Delete Selected Orphans'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
            <p style={{ color: '#555', marginTop: 8 }}>
              This will remove only the selected orphan districts and modules.
            </p>
          </div>
        </>
      )}
      {page === "admin-config" && (
        <ConfigurationPage onDbChange={onDbChange} />
      )}
    </div>
  );
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

  // Fetch dispatchers and districts whenever dbRefresh changes
  useEffect(() => {
    getDispatchers().then(setDispatchers);
    getDistricts().then(setDistricts);
  }, [dbRefresh]);

  // Fetch modules when dbRefresh changes
  useEffect(() => {
    getModules().then(setModules);
  }, [dbRefresh]);

  // Also fetch dispatchers when switching to the main page (for dropdown refresh)
  useEffect(() => {
    if (page === "main") {
      getDispatchers().then(setDispatchers);
    }
  }, [page]);

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
      <Menu current={page} setCurrent={setPage} />
      {page === "admin" ? (
        <Admin page={adminPage} setPage={setAdminPage} onDbChange={() => setDbRefresh((v) => v + 1)} />
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
            ]}
            selectOptions={{ district_id: districts }}
            key={"modules-" + dbRefresh}
          />
        </>
      )}
    </div>
  );
}
