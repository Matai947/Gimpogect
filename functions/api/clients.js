// Cloudflare Pages Function: runs the shared handler in api/clients.js, which was written against Node's req/res.
export async function onRequest({ request, env }) {
  Object.assign(process.env, env);
  const { default: handler } = await import('../../api/clients.js');
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.text() : '';
  return new Promise((resolve, reject) => {
    const headers = new Headers();
    const res = {
      code: 200,
      setHeader: (k, v) => headers.set(k, v),
      status(c) { this.code = c; return this; },
      json(o) { headers.set('content-type', 'application/json'); resolve(new Response(JSON.stringify(o), { status: this.code, headers })); },
      end() { resolve(new Response(null, { status: this.code, headers })); },
    };
    handler({ method: request.method, query: Object.fromEntries(url.searchParams), headers: Object.fromEntries(request.headers), body }, res).catch(reject);
  });
}
