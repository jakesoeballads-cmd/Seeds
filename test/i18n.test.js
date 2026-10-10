const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { dictionaries, translate, formatters } = require('../src/i18n');
const { parseLocalDateTime } = require('../src/services/programs');

const root = path.join(__dirname, '..');
function filesIn(dir, ext) {
  return fs.readdirSync(path.join(root, dir), { recursive: true })
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(root, dir, f));
}

test('setiap teks t(...) punya terjemahan English dan Deutsch', () => {
  const sources = [...filesIn('views', '.ejs'), ...filesIn('public/js', '.js'), ...filesIn('src', '.js')];
  const keys = new Set();
  for (const file of sources) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  // Pesan `raise exception` dari fungsi SQL juga tampil ke pengguna.
  const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
  for (const m of sql.matchAll(/raise exception '([^'%]*)';/g)) keys.add(m[1]);

  for (const lang of ['en', 'de']) {
    const missing = [...keys].filter((k) => !dictionaries[lang][k]);
    assert.deepStrictEqual(missing, [], `belum diterjemahkan ke ${lang}`);
  }
});

test('translate mengisi variabel dan jatuh ke teks Indonesia', () => {
  assert.strictEqual(translate('en', 'Halo, {name}', { name: 'Sari' }), 'Hello, Sari');
  assert.strictEqual(translate('de', 'Halo, {name}', { name: 'Sari' }), 'Hallo, Sari');
  assert.strictEqual(translate('en', 'Teks baru'), 'Teks baru');
});

test('jadwal kegiatan ditampilkan dengan jam mulai dan selesai', () => {
  const start = parseLocalDateTime('2026-10-15T08:00', 'Asia/Jakarta');
  const end = parseLocalDateTime('2026-10-15T11:30', 'Asia/Jakarta');
  assert.strictEqual(start.toISOString(), '2026-10-15T01:00:00.000Z');
  assert.match(formatters('id').schedule(start, end), /15 Okt 2026 · 08\.00–11\.30/);
  assert.match(formatters('en').schedule(start, end), /15 Oct 2026 · 08:00–11:30/);
  assert.match(formatters('de').schedule(start, end), /15\.10\.2026 · 08:00–11:30/);
});

test('bentuk jamak mengikuti jumlah', () => {
  assert.strictEqual(translate('en', '+{n} poin', { n: 1 }), '+1 point');
  assert.strictEqual(translate('en', '+{n} poin', { n: 10 }), '+10 points');
  assert.strictEqual(translate('id', '+{n} poin', { n: 1 }), '+1 poin');
});
