#!/bin/sh
# Quick health check of the server: services, memory, backups, cron, open drawers, content sections. Run with sudo.
echo "services: $(systemctl is-active sevengym postgrest nginx postgresql | tr '\n' ' ')"
echo "mem: $(free -m | awk '/Mem/{print $3"/"$2" MB"}')  disk: $(df -h / | awk 'NR==2{print $3"/"$2}')  tz: $(date +%Z) now: $(date '+%H:%M')"
echo "cron: $(crontab -l 2>/dev/null | grep -c backup-cron) line(s); certbot timer: $(systemctl is-active certbot.timer)"
echo "backups: $(ls -la /srv/sevengym/backups 2>/dev/null | tail -n +4 | awk '{print $5, $9}' | tr '\n' ';')"
echo "db: $(sudo -u postgres psql -At -d sevengym -c "select (select count(*) from clients)||' clients, '||(select count(*) from sales)||' sales, '||(select count(*) from visits)||' visits, '||(select count(*) from settings)||' settings'")"
echo "open drawers: $(sudo -u postgres psql -At -d sevengym -c "select string_agg(data->>'clubId' || ' since ' || to_char(to_timestamp((data->>'open')::bigint/1000 + 5*3600), 'DD.MM HH24:MI'), ', ') from settings where key like 'cash:%' and data->>'close' is null")"
echo "content: $(sudo -u postgres psql -At -d sevengym -c "select string_agg(key, ' ') from settings where key like 'content:%'")"
echo "app errors (2h): $(journalctl -u sevengym --since '2 hours ago' --no-pager | grep -ci 'error')"
