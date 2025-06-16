#!/bin/bash
# run-with-lan.sh
#
# Cross-platform automation script for LAN access to Docker backend.
#
# - On macOS: Sets Docker Compose to bind backend to localhost, then runs socat to forward LAN IP:8001 to localhost:8001.
# - On Linux/Windows: Uses direct LAN port mapping (no socat needed).
#
# Usage:
#   ./scripts/run-with-lan.sh
#
# This script ensures the correct setup for LAN access on all platforms.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

# Detect platform
OS_NAME=$(uname)

cd "$PROJECT_ROOT"

if [[ "$OS_NAME" == "Darwin" ]]; then
  echo "Detected macOS. Using socat for LAN access."
  export BACKEND_PORT_MAPPING=127.0.0.1:8001:8000
  docker compose up -d
  # Check if Docker is only listening on 127.0.0.1:8001
  BIND_ADDR=$(lsof -iTCP:8001 -sTCP:LISTEN -n -P | grep com.docke | awk '{print $9}' | cut -d: -f1)
  if [[ "$BIND_ADDR" != "127.0.0.1" ]]; then
    echo "Error: Docker is not binding to 127.0.0.1:8001. socat cannot run."
    echo "Check your Docker Compose port mapping and try again."
    exit 1
  fi
  "$SCRIPT_DIR/socat-docker-lan.sh"
else
  echo "Detected $OS_NAME. Using direct LAN port mapping."
  unset BACKEND_PORT_MAPPING
  docker compose up -d
fi
