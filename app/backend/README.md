# Free Dispatcher Backend

This is a FastAPI + SQLAlchemy backend service for the Free Dispatcher application. It is
launched either directly during development or as a PyInstaller-bundled binary inside the
packaged Electron app (see `app/electron/main.js` and `run_backend.py`).

## Development

1. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
2. Run the server:
   ```sh
   uvicorn main:app --reload --port 8001
   ```
   Or run the whole stack (backend + frontend) from `app/` with `npm run dev:all`.

By default the backend stores data in a per-user SQLite database (see `database.py`); set
`DATABASE_URL` to point at PostgreSQL or another SQLAlchemy-supported database instead.

## Packaging

The backend is bundled into a standalone binary for the Electron app via PyInstaller:

```sh
npm run backend:bundle
```

This uses `backend-app.spec` and produces the binary consumed by `electron-builder`
(see the root `package.json` `electron:build` script).
