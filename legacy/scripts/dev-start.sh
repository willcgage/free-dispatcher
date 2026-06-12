#!/bin/bash
# This script starts the backend, waits for it to be ready, then starts the frontend.

# Start backend in background
(cd backend && uvicorn main:app --host 0.0.0.0 --port 8001 &)
BACKEND_PID=$!

# Wait for backend to be ready
npx wait-on http://localhost:8001/docs

# Start frontend
npm run dev

# Optional: kill backend when frontend exits
kill $BACKEND_PID
