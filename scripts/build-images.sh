#!/bin/bash

set -e

echo "🚀 Building Ticketz Docker Images"
echo "=================================="
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📍 Project root: $PROJECT_ROOT"
echo ""

echo "🔨 Building Backend Image..."
docker build \
  -t ticketz-backend:latest \
  -f backend/Dockerfile.prod \
  backend/

echo ""
echo "✅ Backend image built: ticketz-backend:latest"
echo ""

echo "🔨 Building Frontend Image..."
docker build \
  -t ticketz-frontend:latest \
  -f frontend/Dockerfile.prod \
  frontend/

echo ""
echo "✅ Frontend image built: ticketz-frontend:latest"
echo ""

echo "📋 Images created:"
docker images | grep ticketz

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "Next steps:"
echo "1. Upload to Coolify or Docker Registry"
echo "2. Use docker-compose.coolify-prebuilt.yaml for deployment"
