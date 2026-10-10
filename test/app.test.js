const test = require('node:test');
const assert = require('node:assert');

// Tanpa variabel Supabase: aplikasi tetap jalan, fitur database membalas 503.
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_MAPS_API_KEY']) {
  process.env[k] = '';
}
const app = require('../src/app');

test('halaman dan endpoint dasar merespons', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.deepStrictEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok' });

  for (const path of ['/', '/login', '/register']) {
    const res = await fetch(`${base}${path}`);
    assert.strictEqual(res.status, 200, path);
  }

  const programs = await fetch(`${base}/api/programs?lat=-6.2&lng=106.8`);
  assert.strictEqual(programs.status, 503);

  const benih = await fetch(`${base}/benih`, { redirect: 'manual' });
  assert.strictEqual(benih.status, 302);
  assert.match(benih.headers.get('location'), /^\/login\?next=/);

  const oauth = await fetch(`${base}/auth/google`, { redirect: 'manual' });
  assert.strictEqual(oauth.status, 302);
  assert.strictEqual(oauth.headers.get('location'), '/login');

  const login = await (await fetch(`${base}/login`)).text();
  assert.match(login, /\/auth\/google/);
  assert.match(login, /\/auth\/facebook/);
  assert.match(login, /\/auth\/x/);

  const home = await (await fetch(`${base}/`)).text();
  assert.match(home, /Selamat datang di Benih\./);

  assert.strictEqual((await fetch(`${base}/kegiatan/abc`)).status, 503);

  const missing = await fetch(`${base}/api/tidak-ada`);
  assert.strictEqual(missing.status, 404);
});
