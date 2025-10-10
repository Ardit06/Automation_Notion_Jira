#!/bin/bash

# Keep Tunnel Alive Script
# This script ensures the tunnel stays active all the time

echo "🚀 Starting persistent tunnel for Notion-Jira Automation"
echo "📧 Email: ardit@91.life"
echo "🔗 Project: 91.life"

# Function to start tunnel
start_tunnel() {
    echo "🔧 Starting LocalTunnel..."
    npx localtunnel --port 3003
}

# Function to restart tunnel if it fails
restart_tunnel() {
    echo "⚠️  Tunnel disconnected. Restarting in 5 seconds..."
    sleep 5
    start_tunnel
}

# Main loop to keep tunnel alive
while true; do
    echo "🔄 Starting tunnel at $(date)"
    start_tunnel
    restart_tunnel
done
