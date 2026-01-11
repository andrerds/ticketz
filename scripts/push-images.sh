#!/bin/bash

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Registry URL required"
  echo ""
  echo "Usage: ./scripts/push-images.sh <registry-url>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/push-images.sh docker.io/username"
  echo "  ./scripts/push-images.sh ghcr.io/username"
  echo "  ./scripts/push-images.sh registry.example.com"
  exit 1
fi

REGISTRY="$1"

echo "🚀 Pushing Ticketz Images to Registry"
echo "======================================"
echo "Registry: $REGISTRY"
echo ""

echo "🏷️  Tagging images..."
docker tag ticketz-backend:latest "$REGISTRY/ticketz-backend:latest"
docker tag ticketz-frontend:latest "$REGISTRY/ticketz-frontend:latest"

echo ""
echo "📤 Pushing backend image..."
docker push "$REGISTRY/ticketz-backend:latest"

echo ""
echo "📤 Pushing frontend image..."
docker push "$REGISTRY/ticketz-frontend:latest"

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "Images available at:"
echo "  - $REGISTRY/ticketz-backend:latest"
echo "  - $REGISTRY/ticketz-frontend:latest"
echo ""
echo "Update docker-compose.coolify-prebuilt.yaml with:"
echo "  backend:"
echo "    image: $REGISTRY/ticketz-backend:latest"
echo "  frontend:"
echo "    image: $REGISTRY/ticketz-frontend:latest"
