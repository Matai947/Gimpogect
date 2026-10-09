// Prepares the static export for Cloudflare Pages: SPA fallback, and no node_modules folder
// (Pages drops any folder with that name, which took the icon and font files with it).
const fs = require('fs');
const path = require('path');
fs.writeFileSync('dist/_redirects', '/* /index.html 200\n');
if (fs.existsSync('dist/assets/node_modules')) fs.renameSync('dist/assets/node_modules', 'dist/assets/vendor');
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|json)$/.test(e.name)) {
      const s = fs.readFileSync(p, 'utf8');
      if (s.includes('assets/node_modules/')) fs.writeFileSync(p, s.split('assets/node_modules/').join('assets/vendor/'));
    }
  }
})('dist');
