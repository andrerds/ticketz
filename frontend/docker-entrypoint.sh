#!/bin/bash
set -e

CONFIG_PATH="/var/www/public/config.json"

echo "Creating config.json from environment variables..."

{
    echo "{"
    first=true
    while IFS='=' read -r name value; do
        escaped_value=$(echo "$value" | sed 's/"/\\"/g')
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        printf '  "%s": "%s"' "$name" "$escaped_value"
    done < <(env)
    echo ""
    echo "}"
} > "$CONFIG_PATH"

echo "config.json created at $CONFIG_PATH"

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
