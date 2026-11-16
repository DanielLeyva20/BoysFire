#!/usr/bin/env bash
# Prepara una VM Ubuntu limpia: Docker, memoria de respaldo (swap) y firewall.
# Uso (en la VM):  sudo bash setup-vm.sh
set -euo pipefail

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# SQL Server y la API se llevan casi toda la RAM: 4 GB de swap evitan que el sistema mate un contenedor.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Solo SSH, HTTP y HTTPS entran; la base de datos nunca se expone.
if command -v ufw >/dev/null; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

echo "VM lista."
