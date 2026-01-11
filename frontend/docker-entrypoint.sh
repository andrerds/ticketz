#!/bin/bash
set -e

echo "Creating config.json from environment variables..."

# Create config.json from environment variables
{
    echo "{"
    env | while IFS='=' read -r name value; do
        printf '  "%s": "%s",\n' "$name" "$value"
    done | sed '$ s/,$//'
    echo "}"
} > /var/www/public/config.json

echo "config.json created successfully"
cat /var/www/public/config.json

# Add backend to hosts if BACKEND_SERVICE is set
if [ -n "$BACKEND_SERVICE" ]; then
    echo "Resolving BACKEND_SERVICE: $BACKEND_SERVICE"
    BACKEND_IP=$(getent hosts "$BACKEND_SERVICE" | awk '{ print $1 }')
    if [ -n "$BACKEND_IP" ]; then
        echo "$BACKEND_IP backend" >> /etc/hosts
        echo "Added $BACKEND_IP backend to /etc/hosts"
    else
        echo "Warning: Could not resolve $BACKEND_SERVICE"
    fi
fi

echo "Starting nginx..."
exec nginx -g "daemon off;"
