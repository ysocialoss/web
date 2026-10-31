// Run after pnpm build. No request is sent to CNS.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import render from '../.output/server/_chunks/ssr-renderer.mjs';

for (const [path, title] of [['/login', 'Sign in to ysocial'], ['/onboarding', 'Choose your handle']]) {
  const response = await render({ req: new Request(`http://localhost${path}`) });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes(title));
}
assert.equal((await render({ req: new Request('http://localhost/test') })).status, 404);

const mock = createServer((req, res) => {
  assert.equal(req.headers.cookie, 'session=local-test');
  if (req.url === '/auth/login') {
    res.setHeader('Set-Cookie', ['oauth_browser=browser; HttpOnly; SameSite=Lax; Path=/', 'second=value; HttpOnly; Path=/']);
    res.setHeader('Location', 'https://example.invalid/login');
    res.writeHead(302); res.end();
  } else {
    assert.equal(req.headers.origin, 'http://localhost:3000');
    res.writeHead(204); res.end();
  }
});
mock.listen(0, '127.0.0.1'); await once(mock, 'listening');
try {
  const address = mock.address();
  process.env.API_URL = `http://127.0.0.1:${address.port}`;
  // Import through a TS-capable loader is unnecessary: the built API route is standalone JS.
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(new URL('../.output/server/', import.meta.url));
  const candidates = files.filter(file => file.startsWith('_...path_') && file.endsWith('.mjs'));
  assert.ok(candidates.length, 'built auth proxy exists');
  const modules = await Promise.all(candidates.map(file => import(new URL(`../.output/server/${file}`, import.meta.url))));
  const GET = modules.map(module => module.GET).find(Boolean);
  const POST = modules.map(module => module.POST).find(Boolean);
  assert.ok(GET && POST);
  const request = new Request('http://localhost:3000/auth/login', { headers: { Cookie: 'session=local-test', Accept: 'text/html' } });
  const response = await GET({ request });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://example.invalid/login');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const oversized = await POST({ request: new Request('http://localhost:3000/auth/profile', {
    method: 'POST', body: 'x'.repeat(16 * 1024 + 1),
  }) });
  assert.equal(oversized.status, 413);
  const logout = await POST({ request: new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { Cookie: 'session=local-test', Origin: 'http://localhost:3000' } }) });
  assert.equal(logout.status, 204);
} finally { await new Promise(resolve => mock.close(resolve)); }
console.info('Auth pages and proxy checks passed using a local backend only.');
