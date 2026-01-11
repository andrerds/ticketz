#!/bin/bash

echo "🔍 Listando todas as redes Docker..."
echo ""
docker network ls

echo ""
echo "📊 Detalhes das redes (com ranges de IP):"
echo ""

for network in $(docker network ls --format "{{.Name}}"); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Network: $network"
    docker network inspect "$network" | grep -E '"Subnet"|"Gateway"' | head -2
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Para adicionar uma rede ao pg_hba.conf:"
echo "   host    all    all    <SUBNET>    trust"
echo ""
echo "Exemplo:"
echo "   host    all    all    172.20.0.0/16    trust"
