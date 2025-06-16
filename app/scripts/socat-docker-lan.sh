#!/bin/bash
# socat-docker-lan.sh
# This script forwards your Mac's LAN IP port 8001 to localhost:8001 for Docker Desktop LAN access.

# Try to auto-detect the active LAN interface
LAN_IP=$(ipconfig getifaddr en0)
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(ipconfig getifaddr en1)
fi
if [ -z "$LAN_IP" ]; then
  echo "Could not determine LAN IP. Please check your network interface (en0, en1, etc.) and set LAN_IP manually."
  exit 1
fi

PORT=8001
LOGFILE="$(dirname "$0")/../socat-lan.log"
SOCAT_PATH=$(which socat)
USER_NAME=$(whoami)

if ! command -v socat &> /dev/null; then
  echo "socat is not installed. Please install it with: brew install socat"
  exit 1
fi

# Check if passwordless sudo is set for socat
SUDOERS_LINE="$USER_NAME ALL=(ALL) NOPASSWD: $SOCAT_PATH"
if ! sudo grep -q "$SUDOERS_LINE" /etc/sudoers; then
  echo "Adding passwordless sudo rule for socat to /etc/sudoers..."
  echo "$SUDOERS_LINE" | sudo EDITOR='tee -a' visudo
fi

echo "Forwarding $LAN_IP:$PORT to 127.0.0.1:$PORT using socat..."
echo "[socat] Starting at $(date)" > "$LOGFILE"
sudo socat TCP-LISTEN:$PORT,bind=$LAN_IP,reuseaddr,fork TCP:127.0.0.1:$PORT >> "$LOGFILE" 2>&1 &
SOCAT_PID=$!
echo "socat is running in the background (PID $SOCAT_PID). Logs: $LOGFILE"
