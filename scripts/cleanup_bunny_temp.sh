#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Cleanup BunnyCDN Temp Folder — Daily Cron Script
# ──────────────────────────────────────────────────────────────
# Uso desde el VPS (host, fuera de Docker):
#   0 3 * * * /root/cleanup_bunny_temp.sh >> /var/log/cleanup_bunny_temp.log 2>&1
#
# O desde dentro de una máquina con curl:
#   curl -s "https://aquatech.duckdns.org/api/cron/cleanup-temp?secret=aquatech_cron_secure_2024"
# ──────────────────────────────────────────────────────────────

# ─── Config ───────────────────────────────────────────────────
API_URL="${1:-http://localhost:3000}"        # Primer argumento o default
CRON_SECRET="aquatech_cron_secure_2024"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "[$TIMESTAMP] Iniciando limpieza de temp en BunnyCDN..."
echo "[$TIMESTAMP] URL: $API_URL/api/cron/cleanup-temp?secret=..."

# ─── Ejecutar ─────────────────────────────────────────────────
RESPONSE=$(curl -s "$API_URL/api/cron/cleanup-temp?secret=$CRON_SECRET" 2>&1)
CURL_EXIT=$?

if [ $CURL_EXIT -ne 0 ]; then
  echo "[$TIMESTAMP] ERROR: curl falló con código $CURL_EXIT"
  echo "[$TIMESTAMP] Respuesta: $RESPONSE"
  exit 1
fi

# ─── Mostrar resumen ──────────────────────────────────────────
echo "[$TIMESTAMP] Respuesta:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

echo "[$TIMESTAMP] Limpieza completada."
echo "──────────────────────────────────────────────────────────────"
