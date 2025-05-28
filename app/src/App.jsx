import React, { useEffect, useState, useRef } from "react";
import {
  getDispatchers, createDispatcher, updateDispatcher, deleteDispatcher,
  getDistricts, createDistrict, updateDistrict, deleteDistrict,
  getModules, createModule, updateModule, deleteModule,
  getTrains, createTrain, updateTrain, deleteTrain
} from "./api";

function EntityManager({ name, getAll, create, update, remove, fields, selectOptions = {} }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const fetchItems = async () => {
    try {
      setItems(await getAll());
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await update(editingId, form);
      } else {
        await create(form);
      }
      setForm({});
      setEditingId(null);
      fetchItems();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditingId(item.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this record?")) {
      await remove(id);
      fetchItems();
    }
  };

  return (
    <div style={{ border: "1px solid #ccc", margin: 16, padding: 16 }}>
      <h2>{name}</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginBottom: 8 }}>
        {fields.map((f) => (
          selectOptions[f.name] ? (
            <select
              key={f.name}
              name={f.name}
              value={form[f.name] || ""}
              onChange={handleChange}
              style={{ marginRight: 8 }}
            >
              <option value="">Select {f.label}</option>
              {selectOptions[f.name].map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          ) : (
            <input
              key={f.name}
              name={f.name}
              placeholder={f.label}
              value={form[f.name] || ""}
              onChange={handleChange}
              style={{ marginRight: 8 }}
            />
          )
        ))}
        <button type="submit">{editingId ? "Update" : "Create"}</button>
        {editingId && <button type="button" onClick={() => { setForm({}); setEditingId(null); }}>Cancel</button>}
      </form>
      <table>
        <thead>
          <tr>
            {fields.map((f) => <th key={f.name}>{f.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {fields.map((f) => <td key={f.name}>{item[f.name]}</td>)}
              <td>
                <button onClick={() => handleEdit(item)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigurationPage({ onDbChange }) {
  const [message, setMessage] = useState("");
  const fileInput = useRef();

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
    <div style={{ margin: 16, padding: 16, border: "1px solid #aaa", background: "#f9f9f9" }}>
      <h2>Database Configuration</h2>
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

function Menu({ current, setCurrent }) {
  return (
    <nav style={{ display: "flex", gap: 16, marginBottom: 24, borderBottom: "1px solid #ccc", paddingBottom: 8 }}>
      <button onClick={() => setCurrent("config")}
        style={{ fontWeight: current === "config" ? "bold" : "normal" }}>
        Configuration
      </button>
      <button onClick={() => setCurrent("main")}
        style={{ fontWeight: current === "main" ? "bold" : "normal" }}>
        Main
      </button>
    </nav>
  );
}

export default function App() {
  const [dbRefresh, setDbRefresh] = useState(0);
  const [page, setPage] = useState("main");
  const [dispatchers, setDispatchers] = useState([]);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    getDispatchers().then(setDispatchers);
    getDistricts().then(setDistricts);
  }, [dbRefresh]);

  return (
    <div style={{ maxWidth: 900, margin: "auto" }}>
      <h1>Train Dispatcher Admin</h1>
      <Menu current={page} setCurrent={setPage} />
      {page === "config" ? (
        <ConfigurationPage onDbChange={() => setDbRefresh((v) => v + 1)} />
      ) : (
        <>
          <EntityManager
            name="Dispatchers"
            getAll={getDispatchers}
            create={createDispatcher}
            update={updateDispatcher}
            remove={deleteDispatcher}
            fields={[{ name: "name", label: "Name" }]}
            key={"dispatchers-" + dbRefresh}
          />
          <EntityManager
            name="Districts"
            getAll={getDistricts}
            create={createDistrict}
            update={updateDistrict}
            remove={deleteDistrict}
            fields={[
              { name: "name", label: "Name" },
              { name: "dispatcher_id", label: "Dispatcher" },
            ]}
            selectOptions={{ dispatcher_id: dispatchers }}
            key={"districts-" + dbRefresh}
          />
          <EntityManager
            name="Modules"
            getAll={getModules}
            create={createModule}
            update={updateModule}
            remove={deleteModule}
            fields={[
              { name: "name", label: "Name" },
              { name: "district_id", label: "District" },
            ]}
            selectOptions={{ district_id: districts }}
            key={"modules-" + dbRefresh}
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
        </>
      )}
    </div>
  );
}
