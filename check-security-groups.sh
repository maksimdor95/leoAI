#!/bin/bash
# Скрипт для проверки Security Groups

echo "🔍 Checking Security Groups for PostgreSQL access..."

# ID группы безопасности из скриншота
SG_ID="default-sg-enprje2h96j3pp1uld0r"

echo ""
echo "📋 Current Security Group Rules:"
yc vpc security-group get $SG_ID --format json | jq -r '.rules[] | select(.direction == "INGRESS") | "\(.direction) | \(.protocol) | Port: \(.ports.from_port // "all") | Source: \(.cidr_blocks[0] // "N/A")"'

echo ""
echo "✅ Required rule for PostgreSQL:"
echo "   Direction: INGRESS"
echo "   Protocol: TCP"
echo "   Port: 5432"
echo "   Source: CIDR of subnet e9b3gc59l510st1ia93 (or 10.0.0.0/8 for all internal traffic)"

