#!/bin/bash
# Script para analizar la BD de producción - VPS Contabo
# Se copia via scp y se ejecuta en el VPS

DB_USER="aquatech"
DB_PASS="Aquatech2026!Secure"
DB_NAME="aquatech"

echo "=========================================="
echo "  DIAGNÓSTICO DE BASE DE DATOS - PRODUCCIÓN"
echo "=========================================="
echo ""

echo "=== 1. VERIFICAR COLUMNA assigned_users ==="
COLUMN_EXISTS=$(mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "SHOW COLUMNS FROM appointments LIKE 'assigned_users';" 2>&1)
if [ -z "$COLUMN_EXISTS" ]; then
    echo "❌ La columna 'assigned_users' NO existe. Hay que agregarla."
else
    echo "✅ La columna 'assigned_users' YA EXISTE."
fi
echo ""

echo "=== 2. TOTAL DE TAREAS ==="
TOTAL=$(mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "SELECT COUNT(*) FROM appointments;" 2>&1)
echo "Total tareas en BD: $TOTAL"
echo ""

echo "=== 3. TAREAS DUPLICADAS (mismo título + misma fecha) ==="
mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT title, DATE(startTime) as fecha, IFNULL(projectId, 'NULL') as proyecto, COUNT(*) as cantidad
FROM appointments
GROUP BY title, DATE(startTime), projectId
HAVING COUNT(*) > 1
ORDER BY cantidad DESC
LIMIT 20;
" 2>&1
echo ""

echo "=== 4. TAREAS QUE YA TIENEN assigned_users ==="
YA_UNIFICADAS=$(mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "SELECT COUNT(*) FROM appointments WHERE assigned_users IS NOT NULL AND assigned_users != '';" 2>&1)
echo "Tareas con assigned_users (ya unificadas): $YA_UNIFICADAS"
echo ""

echo "=== 5. RESUMEN ==="
echo "------------------"
DUPLICADOS=$(mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "
SELECT SUM(cnt - 1) FROM (
    SELECT COUNT(*) as cnt
    FROM appointments
    GROUP BY title, DATE(startTime), projectId
    HAVING COUNT(*) > 1
) as dupes;
" 2>&1)

if [ -z "$DUPLICADOS" ] || [ "$DUPLICADOS" = "NULL" ]; then
    DUPLICADOS=0
fi

echo "Tareas duplicadas a eliminar: $DUPLICADOS"
echo ""
echo "=========================================="
