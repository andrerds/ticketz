#!/bin/bash

set -e

echo "🔨 Pre-build images for Coolify deployment"
echo "==========================================="

cd "$(dirname "$0")/.."

echo "📦 Building backend image..."
docker build -t ticketz-backend:latest -f backend/Dockerfile.prod backend/

echo "📦 Building frontend image..."
docker build -t ticketz-frontend:latest -f frontend/Dockerfile.prod frontend/

echo "✅ Images built successfully!"
docker images | grep ticketz
