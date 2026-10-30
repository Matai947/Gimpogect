#!/bin/sh
# Nightly copy of the database on the server, the last 30 kept.
# crontab -e (as root):  30 3 * * * /srv/sevengym/app/deploy/backup-cron.sh
set -e
DIR=/srv/sevengym/backups
mkdir -p "$DIR"
sudo -u postgres pg_dump -Fc sevengym > "$DIR/sevengym-$(date +%F).dump"
ls -1t "$DIR"/sevengym-*.dump | tail -n +31 | xargs -r rm --
