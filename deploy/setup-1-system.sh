#!/bin/sh
# Step 1 on a fresh Ubuntu 24.04: swap, updates, nginx, Postgres, Node 24, PostgREST, the service user and folders.
set -e
export DEBIAN_FRONTEND=noninteractive
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install nginx postgresql certbot python3-certbot-nginx curl xz-utils ufw
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get -y -q install nodejs
fi
if [ ! -x /usr/local/bin/postgrest ]; then
  curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C /usr/local/bin
fi
id sevengym >/dev/null 2>&1 || useradd -r -m -d /srv/sevengym -s /usr/sbin/nologin sevengym
mkdir -p /srv/sevengym/app/dist /srv/sevengym/media /srv/sevengym/backups
chown -R sevengym:sevengym /srv/sevengym
# only SSH and the web are open from outside
ufw allow OpenSSH >/dev/null && ufw allow 'Nginx Full' >/dev/null && ufw --force enable >/dev/null
echo "node $(node -v) | $(psql --version) | $(/usr/local/bin/postgrest --version | head -1) | $(nginx -v 2>&1)"
echo STEP1-DONE
