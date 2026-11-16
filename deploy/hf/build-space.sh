#!/usr/bin/env bash
# Arma deploy/hf/space/ con todo lo que Hugging Face necesita (Dockerfile, jar, sitio y respaldo).
# Requisitos: el jar compilado (backend/target), el frontend compilado (frontend/dist) y deploy/backup/boysfire.bak.
set -euo pipefail
cd "$(dirname "$0")"
OUT=space
rm -rf "$OUT" && mkdir -p "$OUT"

JAR=../../backend/target/boysfire-api-0.1.0.jar
WWW=../../frontend/dist/frontend/browser
BAK=../backup/boysfire.bak
for f in "$JAR" "$WWW/index.html" "$BAK"; do [ -e "$f" ] || { echo "Falta $f"; exit 1; }; done

cp Dockerfile Caddyfile start.sh README.md "$OUT"/
cp ../restore.sql "$OUT"/
cp "$JAR" "$OUT/app.jar"
cp "$BAK" "$OUT/boysfire.bak"
cp -r "$WWW" "$OUT/www"
echo "Listo: $(du -sh "$OUT" | cut -f1) en deploy/hf/space/"
