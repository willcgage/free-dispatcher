# Free Dispatcher App

This project is a cross-platform web application with a React frontend, FastAPI backend, and PostgreSQL database, designed for easy LAN access and development.

## Quick Start

### Linux/Windows
- Run: `docker compose up -d`
- Backend will be available on your LAN at `http://<your-lan-ip>:8001`

### macOS (Docker Desktop)
- Run: `./scripts/run-with-lan.sh`
- This script starts Docker Compose with backend bound to localhost and uses socat to forward your LAN IP:8001 to localhost:8001.
- See `scripts/socat-docker-lan.sh` for details and logs.

## LAN Access Details
- On macOS, socat is required due to Docker Desktop networking limitations.
- On Linux/Windows, LAN access works out of the box.
- Database is exposed on port 5432 for development (restrict in production).

## Scripts
- `scripts/run-with-lan.sh`: Automates Docker Compose and socat for cross-platform LAN access.
- `scripts/socat-docker-lan.sh`: Handles LAN port forwarding and passwordless sudo setup for socat.

## More Info
- See comments in `docker-compose.yml` and scripts for platform-specific details.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
