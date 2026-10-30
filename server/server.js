// Seven Gym on our own server: the web app (the `dist` folder from `npx expo export --platform web`),
// the API (the same api/clients.js that ran on Vercel) and uploaded photos (MEDIA_DIR), with no dependencies.
// nginx in front terminates HTTPS and proxies to this process on PORT (127.0.0.1 only).
//
//   PORT=3100 DIST_DIR=/srv/sevengym/dist MEDIA_DIR=/srv/sevengym/media PUBLIC_URL=https://sevengym.matai.kz \
//   DB_REST_URL=http://127.0.0.1:3000 DB_REST_TOKEN=… BEHIND_NGINX=1 OWNER_CODE=… TOKEN_SECRET=… node server/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const handler = require('../api/clients.js');
const PORT = Number(process.env.PORT) || 3100;
const DIST = path.resolve(process.env.DIST_DIR || path.join(__dirname, '..', 'dist'));
const MEDIA = process.env.MEDIA_DIR ? path.resolve(process.env.MEDIA_DIR) : '';
const MAX_BODY = 6 * 1024 * 1024; // a photo is at most 2.5 MB, base64 makes it a third bigger

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.map': 'application/json' };

/** A file inside `root`, or null: no way out of the folder with ../ */
function inside(root, rel) {
  let clean;
  try {
    clean = decodeURIComponent(rel);
  } catch {
    return null; // a broken %-escape is just not a file
  }
  const p = path.resolve(root, '.' + path.posix.normalize('/' + clean));
  return p === root || p.startsWith(root + path.sep) ? p : null;
}
const isFile = (p) => {
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function sendFile(res, file, immutable) {
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

/** The Vercel request/response the API was written for: req.query, req.body, res.status().json(). */
async function api(req, res, url) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(c);
  }
  req.query = Object.fromEntries(url.searchParams);
  req.body = Buffer.concat(chunks).toString('utf8');
  let code = 200;
  res.status = (c) => ((code = c), res);
  res.json = (d) => {
    if (!res.headersSent) res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(d));
  };
  const end = res.end.bind(res);
  res.end = (...a) => {
    if (!res.headersSent) res.writeHead(code);
    return end(...a);
  };
  try {
    await handler(req, res);
  } catch (e) {
    console.error(new Date().toISOString(), url.pathname, url.searchParams.get('op'), e && e.message);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    if (!res.writableEnded) end(JSON.stringify({ error: 'server' }));
  }
}

function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p === '/api/clients' || p.startsWith('/api/clients/')) return void api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405).end();
    if (MEDIA && p.startsWith('/media/')) {
      const f = inside(MEDIA, p.slice('/media/'.length));
      return isFile(f) ? sendFile(res, f, true) : void res.writeHead(404).end();
    }
    // the exported app: the file itself, a page of the static export (/owner → owner.html or owner/index.html), else the app shell
    const f = inside(DIST, p);
    for (const c of [f, f && f + '.html', f && path.join(f, 'index.html')]) if (isFile(c)) return sendFile(res, c, p.startsWith('/_expo/static/'));
    if (p.startsWith('/_expo/') || p.startsWith('/assets/')) return void res.writeHead(404).end();
    return sendFile(res, path.join(DIST, 'index.html'), false);
}

http
  .createServer((req, res) => {
    // a bad request never takes the server down
    try {
      route(req, res);
    } catch (e) {
      console.error(new Date().toISOString(), req.url, e && e.message);
      if (!res.headersSent) res.writeHead(400);
      res.end();
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Seven Gym on http://127.0.0.1:${PORT} (app ${DIST}${MEDIA ? `, media ${MEDIA}` : ''})`));
