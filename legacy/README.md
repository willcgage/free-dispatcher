# Free Dispatcher App

This project is a cross-platform app with a React frontend and FastAPI backend. It now ships with an Electron shell for desktop use; Docker has been retired for local workflows.

## Quick Start

### Electron (new default)
- Install Node deps: `npm install`
- Install Python deps for backend: `cd backend && pip install -r requirements.txt`
- Dev (Vite + Electron shell): `npm run electron:dev`
- Prod preview (build renderer then run packaged layout): `npm run build` then `npm run electron`
- Bundle backend binary (required before packaging): `npm run backend:bundle`
- Package desktop app (dmg/nsis/AppImage): `npm run electron:build`

By default the desktop app uses a local SQLite DB stored in your OS user data directory. To point at Postgres instead, set `DATABASE_URL` before launching Electron.

## Notes
- Default DB: SQLite stored in your OS user data directory. Override with `DATABASE_URL` to point at Postgres.
- Backend bundling: run `npm run backend:bundle` to produce the packaged backend binary used in Electron builds.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
