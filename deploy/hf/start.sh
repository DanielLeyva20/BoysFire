#!/usr/bin/env bash
# Arranque del contenedor: base de datos -> restauración -> API -> sitio web.
# Si cualquiera de los procesos se cae, el contenedor termina y Hugging Face lo reinicia.
set -euo pipefail
mkdir -p "$HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME"

# Contraseñas internas, nuevas en cada arranque: la base solo se alcanza desde dentro del contenedor.
export MSSQL_SA_PASSWORD="$(openssl rand -hex 16)Aa!"
export DB_APP_PASSWORD="$(openssl rand -hex 16)Aa!"
export DB_NAME=boysfire DB_APP_USER=boysfire_app
SQLCMD="/opt/mssql-tools18/bin/sqlcmd -C -S 127.0.0.1 -U sa -P $MSSQL_SA_PASSWORD"

echo "[1/4] Iniciando SQL Server"
/opt/mssql/bin/sqlservr > /tmp/sqlserver.log 2>&1 &
for _ in $(seq 1 90); do
  $SQLCMD -Q "SELECT 1" -b >/dev/null 2>&1 && break
  sleep 2
done
$SQLCMD -Q "SELECT 1" -b >/dev/null 2>&1 || { echo "SQL Server no arrancó"; tail -40 /tmp/sqlserver.log; exit 1; }

echo "[2/4] Restaurando la base desde el respaldo"
# restore.sql (compartido con deploy/) apunta a /backup; aquí el respaldo vive en /app.
sed 's#/backup/boysfire.bak#/app/boysfire.bak#' /app/restore.sql > /tmp/restore.sql
files=$($SQLCMD -h -1 -W -s "|" -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'/app/boysfire.bak'")
LOGICAL_DATA=$(echo "$files" | awk -F'|' '$3=="D"{print $1; exit}')
LOGICAL_LOG=$(echo "$files" | awk -F'|' '$3=="L"{print $1; exit}')
[ -n "$LOGICAL_DATA" ] && [ -n "$LOGICAL_LOG" ] || { echo "No se leyó el respaldo:"; echo "$files" | head -5; exit 1; }
$SQLCMD -b \
  -v DB_NAME="$DB_NAME" DB_APP_USER="$DB_APP_USER" DB_APP_PASSWORD="$DB_APP_PASSWORD" \
     LOGICAL_DATA="$LOGICAL_DATA" LOGICAL_LOG="$LOGICAL_LOG" \
  -i /tmp/restore.sql >/tmp/restore.log 2>&1 || { tail -30 /tmp/restore.log; exit 1; }

echo "[3/4] Iniciando la API"
DB_HOST=127.0.0.1 DB_PORT=1433 API_PORT=8080 \
  "$JAVA_HOME/bin/java" -Xmx768m -XX:+ExitOnOutOfMemoryError -jar /app/app.jar > /tmp/api.log 2>&1 &
for _ in $(seq 1 90); do
  curl -fs http://127.0.0.1:8080/api/meta >/dev/null 2>&1 && break
  sleep 2
done
curl -fs http://127.0.0.1:8080/api/meta >/dev/null 2>&1 || { echo "La API no arrancó"; tail -40 /tmp/api.log; exit 1; }

echo "[4/4] Sitio web en el puerto 7860"
caddy run --config /app/Caddyfile --adapter caddyfile &

# El contenedor vive mientras vivan los tres procesos.
wait -n
echo "Un proceso terminó: se reinicia el contenedor."
exit 1
