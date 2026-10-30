#!/bin/sh
# Step 3: the app's files are in /srv/sevengym/app (copied from the computer); the env, systemd service and nginx site.
# OWNER_CODE is put into /etc/sevengym.env by hand; TOKEN_SECRET is a fresh random one (Vercel's cannot be read back).
set -e
cd /srv/sevengym/app
chown -R sevengym:sevengym /srv/sevengym
ENV=/etc/sevengym.env
touch $ENV && chmod 600 $ENV
set_kv() { grep -q "^$1=" $ENV && sed -i "s|^$1=.*|$1=$2|" $ENV || echo "$1=$2" >> $ENV; }
# a placeholder nobody can type at the login (not digits) until the real owner code is put in by hand
grep -q '^OWNER_CODE=.\+' $ENV || set_kv OWNER_CODE "unset-$(openssl rand -hex 16)"
# only a real 64-hex secret counts; anything else (a placeholder, an old short one) is replaced
grep -Eq '^TOKEN_SECRET=[0-9a-f]{64}$' $ENV || set_kv TOKEN_SECRET "$(openssl rand -hex 32)"
set_kv PORT 3100
set_kv DIST_DIR /srv/sevengym/app/dist
set_kv MEDIA_DIR /srv/sevengym/media
set_kv PUBLIC_URL https://sevengym.matai.kz
set_kv DB_REST_URL http://127.0.0.1:3000
set_kv BEHIND_NGINX 1
cp deploy/sevengym.service /etc/systemd/system/sevengym.service
systemctl daemon-reload && systemctl enable -q --now sevengym && sleep 2 && systemctl restart sevengym && sleep 2
cp deploy/nginx-sevengym.conf /etc/nginx/sites-available/sevengym
ln -sf /etc/nginx/sites-available/sevengym /etc/nginx/sites-enabled/sevengym
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
echo "app: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)  api: $(curl -s 'http://127.0.0.1:3100/api/clients?op=clubs')  via nginx: $(curl -s -o /dev/null -w '%{http_code}' -H 'Host: sevengym.matai.kz' http://127.0.0.1/)"
systemctl is-active sevengym postgrest nginx | tr '\n' ' '; echo
echo STEP3-DONE
