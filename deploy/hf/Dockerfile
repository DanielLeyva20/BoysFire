# BoysFire completo en un solo contenedor para Hugging Face Spaces (SDK Docker):
# SQL Server + API de Spring Boot + Caddy (sirve el sitio y reenvía /api).
FROM caddy:2 AS caddy

FROM mcr.microsoft.com/mssql/server:2022-latest
USER root

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Java 25 (solo el entorno de ejecución).
RUN mkdir -p /opt/java \
 && curl -fsSL "https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jre/hotspot/normal/eclipse" \
    | tar -xz -C /opt/java --strip-components=1

COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

WORKDIR /app
COPY app.jar Caddyfile restore.sql start.sh boysfire.bak ./
COPY www /srv/www

# Hugging Face ejecuta el contenedor con el usuario 1000, sin privilegios de administrador.
RUN chmod +x start.sh \
 && chown -R 1000:1000 /app /srv/www /var/opt/mssql

USER 1000
ENV HOME=/tmp/home \
    JAVA_HOME=/opt/java \
    ACCEPT_EULA=Y \
    MSSQL_PID=Developer \
    MSSQL_MEMORY_LIMIT_MB=3072 \
    XDG_DATA_HOME=/tmp/caddy-data \
    XDG_CONFIG_HOME=/tmp/caddy-config

EXPOSE 7860
ENTRYPOINT ["/app/start.sh"]
CMD []
