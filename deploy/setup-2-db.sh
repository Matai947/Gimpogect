#!/bin/sh
# Step 2: the database, its roles, PostgREST with a random password and jwt-secret, the server's database token.
# Expects deploy/schema.sql and deploy/postgrest.service in /tmp/deploy. Prints nothing secret; the token lands in /etc/sevengym.env.
set -e
cd /tmp/deploy
sudo -u postgres psql -tAc "select 1 from pg_database where datname='sevengym'" | grep -q 1 || sudo -u postgres psql -qc "create database sevengym"
sudo -u postgres psql -q -d sevengym -f schema.sql
PW=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 32)
sudo -u postgres psql -q -d sevengym -c "alter role authenticator password '$PW'"
mkdir -p /etc/postgrest
cat > /etc/postgrest/sevengym.conf <<EOF
db-uri = "postgres://authenticator:$PW@127.0.0.1:5432/sevengym"
db-schemas = "public"
db-anon-role = "web_anon"
server-host = "127.0.0.1"
server-port = 3000
db-max-rows = 1000
jwt-secret = "$JWT"
EOF
chmod 600 /etc/postgrest/sevengym.conf
cp postgrest.service /etc/systemd/system/postgrest.service
systemctl daemon-reload && systemctl enable -q --now postgrest && sleep 2 && systemctl restart postgrest && sleep 2
TOKEN=$(node -e "const c=require('crypto'),b=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),h=b({alg:'HS256',typ:'JWT'}),p=b({role:'web_app'});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.argv[1]).update(h+'.'+p).digest('base64url'))" "$JWT")
touch /etc/sevengym.env && chmod 600 /etc/sevengym.env
grep -q '^DB_REST_TOKEN=' /etc/sevengym.env && sed -i "s|^DB_REST_TOKEN=.*|DB_REST_TOKEN=$TOKEN|" /etc/sevengym.env || echo "DB_REST_TOKEN=$TOKEN" >> /etc/sevengym.env
echo "with token: $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:3000/settings?limit=1')  without: $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3000/settings?limit=1')"
echo STEP2-DONE
