// Copies Vercel config into the static export and pins it to the gym-project Vercel project.
const fs = require('fs');
fs.copyFileSync('vercel.json', 'dist/vercel.json');
// Serverless API (client registry) ships next to the static site.
fs.cpSync('api', 'dist/api', { recursive: true });
fs.writeFileSync('dist/package.json', JSON.stringify({ private: true, dependencies: {} }));
fs.writeFileSync('dist/.vercelignore', '!node_modules\n');
fs.mkdirSync('dist/.vercel', { recursive: true });
fs.writeFileSync('dist/.vercel/project.json', JSON.stringify({ projectId: 'prj_8ErLXzUTAsAhwuxDVJAukwoLMFg0', orgId: 'team_0oLcyoUG9kISILRb8E1ezMtB', projectName: 'gym-project' }));
