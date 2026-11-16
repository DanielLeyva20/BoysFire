#!/usr/bin/env bash
# Restaura la base desde deploy/backup/boysfire.bak dentro del contenedor sqlserver.
# Uso (en la VM, dentro de deploy/):  ./setup-db.sh
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

DB_NAME="${DB_NAME:-boysfire}"
DB_APP_USER="${DB_APP_USER:-boysfire_app}"
SQLCMD="/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $MSSQL_SA_PASSWORD"
[ -f backup/boysfire.bak ] || { echo "Falta deploy/backup/boysfire.bak"; exit 1; }

docker compose -f docker-compose.prod.yml up -d sqlserver
until docker compose -f docker-compose.prod.yml exec -T sqlserver $SQLCMD -Q "SELECT 1" -b >/dev/null 2>&1; do sleep 3; done

# Nombres lógicos de los archivos dentro del respaldo (cambian según dónde se hizo).
files=$(docker compose -f docker-compose.prod.yml exec -T sqlserver $SQLCMD -h -1 -W -s "|" \
  -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'/backup/boysfire.bak'")
LOGICAL_DATA=$(echo "$files" | awk -F'|' '$3=="D"{print $1; exit}')
LOGICAL_LOG=$(echo "$files" | awk -F'|' '$3=="L"{print $1; exit}')
echo "Archivos lógicos: datos=$LOGICAL_DATA registro=$LOGICAL_LOG"

docker compose -f docker-compose.prod.yml exec -T sqlserver $SQLCMD -b \
  -v DB_NAME="$DB_NAME" DB_APP_USER="$DB_APP_USER" DB_APP_PASSWORD="$DB_APP_PASSWORD" \
     LOGICAL_DATA="$LOGICAL_DATA" LOGICAL_LOG="$LOGICAL_LOG" \
  -i /dev/stdin < restore.sql
echo "Base restaurada."
