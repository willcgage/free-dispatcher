// App.jsx - Main frontend for Train Dispatcher Admin UI
// Provides CRUD management for Dispatchers, Districts, Trains, and Modules
// Uses a generic EntityManager component for each entity type

import React, { useEffect, useState } from "react";
import { getLayouts, createLayout, updateLayout, deleteLayout, getDistricts, createDistrict, updateDistrict, deleteDistrict, getDispatchers, createDispatcher, updateDispatcher, deleteDispatcher } from "./api";

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
    if (name === "Modules") {
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
                if (f.type === "select" && f.options) {
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
                          {f.options.map((opt) => (
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
                        autoComplete="off"
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
                if (f.type === "select" && f.options) {
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
                          {f.options.map((opt) => (
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
                        autoComplete="off"
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
 * ConfigurationPage - Only CRUD for Layouts, LayoutDistricts, LayoutDistrictModules.
 * Props:
 *   onDbChange: callback to trigger parent refresh after DB change
 */
function ConfigurationPage({ onDbChange, onBackToAdmin }) {
  const [dbRefresh, setDbRefresh] = useState(0);
  const [layouts, setLayouts] = useState([]);

  useEffect(() => {
    getLayouts().then(setLayouts);
  }, [dbRefresh]);

  return (
    <div className="config-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>Database Tables (CRUD)</h2>
      <button onClick={onBackToAdmin} style={{ marginBottom: 16, fontWeight: 'bold' }}>Back to Admin</button>
      <EntityManager
        name="Layouts"
        getAll={getLayouts}
        create={createLayout}
        update={updateLayout}
        remove={deleteLayout}
        fields={[
          { name: "id", label: "ID" },
          { name: "name", label: "Name" },
          { name: "start_date", label: "Start Date", type: "date" },
          { name: "end_date", label: "End Date", type: "date" },
          { name: "location_city", label: "City" },
          { name: "location_state", label: "State", type: "select", options: [
    { id: "AL", name: "Alabama" }, { id: "AK", name: "Alaska" }, { id: "AZ", name: "Arizona" }, { id: "AR", name: "Arkansas" },
    { id: "CA", name: "California" }, { id: "CO", name: "Colorado" }, { id: "CT", name: "Connecticut" }, { id: "DE", name: "Delaware" },
    { id: "FL", name: "Florida" }, { id: "GA", name: "Georgia" }, { id: "HI", name: "Hawaii" }, { id: "ID", name: "Idaho" },
    { id: "IL", name: "Illinois" }, { id: "IN", name: "Indiana" }, { id: "IA", name: "Iowa" }, { id: "KS", name: "Kansas" },
    { id: "KY", name: "Kentucky" }, { id: "LA", name: "Louisiana" }, { id: "ME", name: "Maine" }, { id: "MD", name: "Maryland" },
    { id: "MA", name: "Massachusetts" }, { id: "MI", name: "Michigan" }, { id: "MN", name: "Minnesota" }, { id: "MS", name: "Mississippi" },
    { id: "MO", name: "Missouri" }, { id: "MT", name: "Montana" }, { id: "NE", name: "Nebraska" }, { id: "NV", name: "Nevada" },
    { id: "NH", name: "New Hampshire" }, { id: "NJ", name: "New Jersey" }, { id: "NM", name: "New Mexico" }, { id: "NY", name: "New York" },
    { id: "NC", name: "North Carolina" }, { id: "ND", name: "North Dakota" }, { id: "OH", name: "Ohio" }, { id: "OK", name: "Oklahoma" },
    { id: "OR", name: "Oregon" }, { id: "PA", name: "Pennsylvania" }, { id: "RI", name: "Rhode Island" }, { id: "SC", name: "South Carolina" },
    { id: "SD", name: "South Dakota" }, { id: "TN", name: "Tennessee" }, { id: "TX", name: "Texas" }, { id: "UT", name: "Utah" },
    { id: "VT", name: "Vermont" }, { id: "VA", name: "Virginia" }, { id: "WA", name: "Washington" }, { id: "WV", name: "West Virginia" },
    { id: "WI", name: "Wisconsin" }, { id: "WY", name: "Wyoming" }
  ] },
        ]}
        refreshKey={dbRefresh}
        onRefresh={() => setDbRefresh((v) => v + 1)}
      />
    </div>
  );
}
/**
 *   setPage: setter for admin subpage
 *   onDbChange: callback for DB changes
 */
function Admin({ page, setPage, onDbChange, versions }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  // Only fetch /status once on mount
  useEffect(() => {
    let mounted = true;
    fetchWithBackendUrl('/status')
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((data) => { if (mounted) setStatus(data); })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          // Log with context
          console.error("Failed to fetch backend status:", e);
        }
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard-container" style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <h2>System Admin</h2>
      {error && (
        <div style={{ color: '#b00', marginBottom: 16, fontWeight: 'bold' }}>
          Error connecting to backend: {error}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <b>Frontend Version:</b> <span className="dashboard-value">{versions && versions.frontend_version ? versions.frontend_version : 'Unknown'}</span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <b>Backend Version:</b> <span className="dashboard-value">{versions && versions.backend_version ? versions.backend_version : 'Unknown'}</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <b>Backend IP Addresses:</b>{' '}
        {status && status.ip && status.ip.length
          ? status.ip.map((ip, idx) => (
              <span key={ip} className="dashboard-value">
                {ip}{idx < status.ip.length - 1 ? ', ' : ''}
              </span>
            ))
          : "Unknown"}
      </div>
      <div style={{ marginBottom: 8 }}>
        {/* <b>Current Time:</b> {status && status.time} */}
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
    <div className="theme-switcher-topright" aria-label="Theme selection">
      <label htmlFor="theme-select" style={{ fontWeight: 500, marginRight: 8 }}>Theme:</label>
      <select
        id="theme-select"
        value={theme}
        onChange={e => setTheme(e.target.value)}
        aria-label="Select theme"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="high-contrast">High Contrast</option>
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
    // If backend returns a list of IPs, try each, but skip Docker-internal/private IPs
    const ips = Array.isArray(data.ip) ? data.ip : [data.ip];
    for (const ip of ips) {
      // Filter out private/internal IPs (Docker, local networks)
      if (/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.)/.test(ip)) continue;
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
  // Fallback: use current hostname (localhost or host network)
  backendUrlCache = candidateUrl;
  return candidateUrl;
}

function getBackendUrl() {
  // Returns a promise that resolves to the backend URL
  return resolveBackendUrl();
}

/**
 * GlobalMenu - A menu button visible on all pages, opens a dropdown with navigation options.
 */
function GlobalMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 2000 }}>
      <button
        aria-label="Open menu"
        style={{ fontSize: 22, borderRadius: 6, padding: '6px 14px', background: 'var(--menu-bg, #222)', color: 'var(--menu-fg, #fff)', border: 'none', boxShadow: '0 2px 8px #0002', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 40, left: 0, background: 'var(--menu-dropdown-bg, #fff)', color: 'var(--menu-dropdown-fg, #222)', border: '1px solid var(--menu-border, #aaa)', borderRadius: 8, minWidth: 180, boxShadow: '0 2px 12px #0003', padding: 8 }}>
          <div style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setOpen(false); onNavigate('dashboard'); }}>App Dashboard</div>
          <div style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setOpen(false); onNavigate('admin'); }}>Admin</div>
          <div style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setOpen(false); onNavigate('admin-config'); }}>Database/Config</div>
          {/* Add more pages here as needed */}
        </div>
      )}
    </div>
  );
}

/**
 * AppDashboard - Main landing page, shows version info and layout selection/creation.
 */
function AppDashboard({ layouts, onCreateLayout, onSelectLayout, versions, onOpenLayoutSelect }) {
  return (
    <div className="app-dashboard">
      <h2 style={{ marginBottom: 16 }}>App Dashboard</h2>
      <div className="app-dashboard-info">
        <b>Frontend Version:</b> <span className="dashboard-value">{versions.frontend_version || 'Unknown'}</span><br />
        <b>Backend Version:</b> <span className="dashboard-value">{versions.backend_version || 'Unknown'}</span>
      </div>
      {(!layouts || layouts.length === 0) ? (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 16, color: 'var(--dashboard-warn, #b00)' }}>
            <b>No Layout exists.</b>
          </div>
          <button
            style={{ fontSize: 18, padding: '10px 28px', background: 'var(--dashboard-btn-create-bg, #1976d2)', color: 'var(--dashboard-btn-create-fg, #fff)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            onClick={onCreateLayout}
          >
            Create Layout!
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 16, color: 'var(--dashboard-info, #1976d2)' }}>
            <b>Layout(s) detected.</b>
          </div>
          <button
            style={{ fontSize: 18, padding: '10px 28px', background: 'var(--dashboard-btn-select-bg, #388e3c)', color: 'var(--dashboard-btn-select-fg, #fff)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            onClick={onOpenLayoutSelect}
          >
            Select Layout
          </button>
        </div>
      )}
    </div>
  );
}

function LayoutSelectPopup({ layouts, onSelect, onClose }) {
  const [search, setSearch] = React.useState("");
  const filteredLayouts = layouts.filter(layout => {
    const q = search.toLowerCase();
    // Check name, city, state, start_date, end_date
    return (
      layout.name.toLowerCase().includes(q) ||
      (layout.location_city && layout.location_city.toLowerCase().includes(q)) ||
      (layout.location_state && layout.location_state.toLowerCase().includes(q)) ||
      (layout.start_date && layout.start_date.toLowerCase().includes(q)) ||
      (layout.end_date && layout.end_date.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 8, minWidth: 320, position: 'relative' }}>
        <h3>Select a Layout</h3>
        <input
          type="text"
          placeholder="Search by name, city, state, or date..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 4, border: '1px solid #aaa' }}
          autoFocus
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflowY: 'auto' }}>
          {filteredLayouts.map(layout => (
            <li key={layout.id} style={{ marginBottom: 12 }}>
              <button
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #aaa', background: '#f5f5f5', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => onSelect(layout)}
              >
                {layout.name} ({layout.location_city}, {layout.location_state})
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {layout.start_date} - {layout.end_date}
                </div>
              </button>
            </li>
          ))}
          {filteredLayouts.length === 0 && (
            <li style={{ color: '#888', textAlign: 'center', marginTop: 24 }}>No layouts found.</li>
          )}
        </ul>
        <button style={{ marginTop: 16 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function LayoutDetailPage({ layout, onBack }) {
  const [districts, setDistricts] = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (layout) {
      getDistricts(layout.id).then(setDistricts);
    }
    getDispatchers().then(setDispatchers);
  }, [layout, refreshKey]);

  return (
    <div style={{ margin: 16, padding: 16, border: "1px solid #aaa" }}>
      <button onClick={onBack} style={{ marginBottom: 16, fontWeight: 'bold' }}>Back to Layouts</button>
      <h2>Layout: {layout.name}</h2>
      <div style={{ marginBottom: 24 }}>
        <b>City:</b> {layout.location_city} <b>State:</b> {layout.location_state} <b>Start:</b> {layout.start_date} <b>End:</b> {layout.end_date}
      </div>
      <EntityManager
        name="Districts"
        getAll={() => getDistricts(layout.id)}
        create={(data) => createDistrict(layout.id, { ...data, layout_id: layout.id })}
        update={updateDistrict}
        remove={deleteDistrict}
        fields={[
          { name: "id", label: "ID" },
          { name: "name", label: "Name" },
          { name: "channel_or_frequency", label: "Channel or Frequency" },
        ]}
        key={"districts-" + layout.id + "-" + refreshKey}
        refreshKey={refreshKey}
        onRefresh={() => setRefreshKey((v) => v + 1)}
      />
      <h3 style={{ marginTop: 32 }}>Dispatchers (Global)</h3>
      <EntityManager
        name="Dispatchers"
        getAll={getDispatchers}
        create={createDispatcher}
        update={updateDispatcher}
        remove={deleteDispatcher}
        fields={[
          { name: "id", label: "ID" },
          { name: "last_name", label: "Last Name" },
          { name: "first_name", label: "First Name" },
          { name: "cell_number", label: "Cell Number" },
        ]}
        key={"dispatchers-" + refreshKey}
        refreshKey={refreshKey}
        onRefresh={() => setRefreshKey((v) => v + 1)}
      />
    </div>
  );
}

function App() {
  const [dbRefresh, setDbRefresh] = useState(0);
  const [page, setPage] = useState("dashboard");
  const [adminPage, setAdminPage] = useState("admin-overview");
  const [layouts, setLayouts] = useState([]);
  const [versions, setVersions] = useState({});
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [showLayoutSelect, setShowLayoutSelect] = useState(false);
  // Add system time state
  const [systemTime, setSystemTime] = useState(new Date());

  useEffect(() => {
    fetch('/versions.json')
      .then(res => res.json())
      .then(setVersions)
      .catch(() => setVersions({}));
  }, []);

  useEffect(() => {
    getLayouts().then(setLayouts);
  }, [page, dbRefresh]);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(new Date());
    }, 1000); // 1 second interval
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = (target) => {
    if (target === 'dashboard') setPage('dashboard');
    else if (target === 'admin') setPage('admin');
    else if (target === 'admin-config') { setPage('admin'); setAdminPage('admin-config'); }
  };

  const handleCreateLayout = () => {
    setPage('admin');
    setAdminPage('admin-config');
  };

  const handleSelectLayout = (layout) => {
    setSelectedLayout(layout);
    setShowLayoutSelect(false);
    setPage('main');
  };

  const handleOpenLayoutSelect = () => setShowLayoutSelect(true);
  const handleCloseLayoutSelect = () => setShowLayoutSelect(false);

  return (
    <>
      <GlobalMenu onNavigate={handleNavigate} />
      <ThemeSwitcher />
      {/* System Time Display */}
      <div style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2em', margin: '10px 0' }}>
        {systemTime.toLocaleString()}
      </div>
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <h1>Train Dispatcher Admin</h1>
        {page === "dashboard" ? (
          <>
            <AppDashboard
              layouts={layouts}
              onCreateLayout={handleCreateLayout}
              onSelectLayout={handleSelectLayout}
              versions={versions}
              onOpenLayoutSelect={handleOpenLayoutSelect}
            />
            {showLayoutSelect && (
              <LayoutSelectPopup
                layouts={layouts}
                onSelect={handleSelectLayout}
                onClose={handleCloseLayoutSelect}
              />
            )}
          </>
        ) : page === "admin" ? (
          adminPage === "admin-config" ? (
            <ConfigurationPage onDbChange={() => setDbRefresh((v) => v + 1)} onBackToAdmin={() => setAdminPage("admin-overview")} />
          ) : (
            <Admin page={adminPage} setPage={setAdminPage} onDbChange={() => setDbRefresh((v) => v + 1)} versions={versions} />
          )
        ) : selectedLayout ? (
          <LayoutDetailPage layout={selectedLayout} onBack={() => setSelectedLayout(null)} />
        ) : (
          <EntityManager
            name="Layouts"
            getAll={getLayouts}
            create={createLayout}
            update={updateLayout}
            remove={deleteLayout}
            fields={[
              { name: "id", label: "ID" },
              { name: "name", label: "Name" },
              { name: "start_date", label: "Start Date", type: "date" },
              { name: "end_date", label: "End Date", type: "date" },
              { name: "location_city", label: "City" },
              { name: "location_state", label: "State", type: "select", options: [
                { id: "AL", name: "Alabama" }, { id: "AK", name: "Alaska" }, { id: "AZ", name: "Arizona" }, { id: "AR", name: "Arkansas" },
                { id: "CA", name: "California" }, { id: "CO", name: "Colorado" }, { id: "CT", name: "Connecticut" }, { id: "DE", name: "Delaware" },
                { id: "FL", name: "Florida" }, { id: "GA", name: "Georgia" }, { id: "HI", name: "Hawaii" }, { id: "ID", name: "Idaho" },
                { id: "IL", name: "Illinois" }, { id: "IN", name: "Indiana" }, { id: "IA", name: "Iowa" }, { id: "KS", name: "Kansas" },
                { id: "KY", name: "Kentucky" }, { id: "LA", name: "Louisiana" }, { id: "ME", name: "Maine" }, { id: "MD", name: "Maryland" },
                { id: "MA", name: "Massachusetts" }, { id: "MI", name: "Michigan" }, { id: "MN", name: "Minnesota" }, { id: "MS", name: "Mississippi" },
                { id: "MO", name: "Missouri" }, { id: "MT", name: "Montana" }, { id: "NE", name: "Nebraska" }, { id: "NV", name: "Nevada" },
                { id: "NH", name: "New Hampshire" }, { id: "NJ", name: "New Jersey" }, { id: "NM", name: "New Mexico" }, { id: "NY", name: "New York" },
                { id: "NC", name: "North Carolina" }, { id: "ND", name: "North Dakota" }, { id: "OH", name: "Ohio" }, { id: "OK", name: "Oklahoma" },
                { id: "OR", name: "Oregon" }, { id: "PA", name: "Pennsylvania" }, { id: "RI", name: "Rhode Island" }, { id: "SC", name: "South Carolina" },
                { id: "SD", name: "South Dakota" }, { id: "TN", name: "Tennessee" }, { id: "TX", name: "Texas" }, { id: "UT", name: "Utah" },
                { id: "VT", name: "Vermont" }, { id: "VA", name: "Virginia" }, { id: "WA", name: "Washington" }, { id: "WV", name: "West Virginia" },
                { id: "WI", name: "Wisconsin" }, { id: "WY", name: "Wyoming" }
            ]},
            ]}
            key={"layouts-" + dbRefresh}
            refreshKey={dbRefresh}
          />
        )}
      </div>
    </>
  );
}

export default App;
