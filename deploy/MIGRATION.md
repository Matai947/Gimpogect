# Переезд Seven Gym на свой сервер (VPS в Казахстане)

Сейчас: сайт и сервер — на Vercel, база — в Supabase.
После переезда всё на одном вашем сервере: приложение, сервер (API), база Postgres и фото.

## 1. Какой сервер заказать

- Ubuntu 24.04, **2 ядра, 4 ГБ памяти, 40 ГБ диска** (хватит с запасом).
- Публичный IP-адрес и доступ по SSH (логин root или пользователь с sudo).
- Провайдер в Казахстане: PS.kz, Hoster.kz или другой — любой с Ubuntu.

## 2. Поставить программы на сервер

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx postgresql certbot python3-certbot-nginx git curl
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt -y install nodejs
# PostgREST (одна программа):
curl -L https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | sudo tar -xJ -C /usr/local/bin
sudo useradd -r -m -d /srv/sevengym sevengym
```

## 3. Код приложения

```bash
sudo -u sevengym git clone https://github.com/Matai947/Gimpogect.git /srv/sevengym/app
cd /srv/sevengym/app && sudo -u sevengym npm ci && sudo -u sevengym npx expo export --platform web && sudo -u sevengym node scripts/prepare-deploy.js
sudo -u sevengym mkdir -p /srv/sevengym/media
```

(Перед этим нужно отправить код в GitHub — сейчас компьютер входит туда как MataiKZ, нужен вход Matai947.)

## 4. База

```bash
sudo -u postgres psql -c "create database sevengym"
sudo -u postgres psql -d sevengym -f /srv/sevengym/app/deploy/schema.sql
sudo -u postgres psql -d sevengym -c "alter role authenticator password 'ПРИДУМАЙТЕ-ДЛИННЫЙ-ПАРОЛЬ'"
sudo mkdir -p /etc/postgrest && sudo cp deploy/postgrest.conf /etc/postgrest/sevengym.conf
# в файле: тот же пароль и jwt-secret — случайная строка: openssl rand -hex 32
sudo cp deploy/postgrest.service /etc/systemd/system/ && sudo systemctl enable --now postgrest
# токен для сервера (подставить свой jwt-secret), его вписать в DB_REST_TOKEN на шаге 5:
node -e "const c=require('crypto'),b=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),h=b({alg:'HS256',typ:'JWT'}),p=b({role:'web_app'});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.argv[1]).update(h+'.'+p).digest('base64url'))" ВАШ-JWT-SECRET
curl -H "Authorization: Bearer ТОКЕН" http://127.0.0.1:3000/settings?limit=1   # ответ [] — база отвечает
curl http://127.0.0.1:3000/settings?limit=1      # без токена — отказ (так и должно быть)
```

## 5. Сервер приложения

```bash
sudo cp deploy/sevengym.env.example /etc/sevengym.env && sudo chmod 600 /etc/sevengym.env
sudo nano /etc/sevengym.env     # OWNER_CODE и TOKEN_SECRET — ТЕ ЖЕ, что на Vercel
sudo cp deploy/sevengym.service /etc/systemd/system/ && sudo systemctl enable --now sevengym
curl http://127.0.0.1:3100/api/clients?op=clubs   # ответ {"clubs":[]} — сервер работает
sudo cp deploy/nginx-sevengym.conf /etc/nginx/sites-available/sevengym
sudo ln -s /etc/nginx/sites-available/sevengym /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

TOKEN_SECRET обязательно тот же: иначе все сотрудники и клиенты выйдут из приложения.

## 6. День переезда (лучше ночью, после закрытия касс — займёт ~30 минут)

1. Все кассы закрыты, на кассе никто не работает.
2. **Свежая копия базы** с Supabase (на компьютере, в папке проекта):
   `SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/db-backup.js` → папка `backup/<дата>`.
3. Скопировать папку на сервер: `scp -r backup/<дата> root@IP:/srv/sevengym/`
4. **Залить в новую базу**:
   `DB_REST_URL=http://127.0.0.1:3000 DB_REST_TOKEN=ТОКЕН node scripts/db-restore.js /srv/sevengym/<дата>`
   Числа «в базе» должны совпасть с `counts.json` копии. Потом счётчики:
   `sudo -u postgres psql -d sevengym -c "select setval(pg_get_serial_sequence('visits','id'), (select coalesce(max(id),1) from visits)); select setval(pg_get_serial_sequence('clicks','id'), (select coalesce(max(id),1) from clicks));"`
5. **DNS** в PS.kz (console.ps.kz → DNS matai.kz): записи `sevengym` и `sevengim` — тип **A**, значение **IP сервера** (вместо записей Vercel).
6. Через 5–30 минут, когда адрес откроется с сервера: `sudo certbot --nginx -d sevengym.matai.kz -d sevengim.matai.kz`
7. Проверить: вход сотрудника, касса открывается, клиент находится, отчёты за октябрь те же.

## 7. Если что-то пошло не так

Вернуть записи DNS на Vercel — всё снова работает как раньше (Vercel и Supabase не удаляем ещё 2–4 недели).
Продажи, сделанные на новом сервере за это время, будут только в новой базе.

## 8. После переезда

- Ночная копия базы на сервере: `crontab -e` → `30 3 * * * /srv/sevengym/app/deploy/backup-cron.sh` (хранит 30 дней).
- Обновление приложения: `cd /srv/sevengym/app && git pull && npx expo export --platform web && node scripts/prepare-deploy.js && sudo systemctl restart sevengym`
- APK для Android смотрит на адрес sevengym.matai.kz — менять не нужно.
- Через 2–4 недели спокойной работы: отключить Vercel и Supabase.
