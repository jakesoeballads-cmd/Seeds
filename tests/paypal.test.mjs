// Jalankan: npm test  (Node ≥ 22.18 membaca file .ts langsung)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertFromIdr, isPaid } from '../lib/payments/paypal-core.ts';

test('convertFromIdr membulatkan ke atas ke sen', () => {
  assert.equal(convertFromIdr(2000, 16000), '0.13'); // 0,125 → 0,13
  assert.equal(convertFromIdr(20000, 16000), '1.25');
  assert.equal(convertFromIdr(32000, 16000), '2.00');
  assert.equal(convertFromIdr(16001, 16000), '1.01');
  assert.equal(convertFromIdr(2000 * 100000, 16000), '12500.00');
});

const trx = { order_id: 'BENIH-1', currency: 'USD', provider_amount: '1.25' };
const ok = { status: 'COMPLETED', captureStatus: 'COMPLETED', customId: 'BENIH-1', currency: 'USD', value: '1.25' };

test('isPaid menerima capture yang cocok', () => {
  assert.equal(isPaid(ok, trx), true);
  assert.equal(isPaid(ok, { ...trx, provider_amount: 1.25 }), true);
});

test('isPaid menolak bila ada yang tidak cocok', () => {
  assert.equal(isPaid({ ...ok, status: 'PAYER_ACTION_REQUIRED' }, trx), false);
  assert.equal(isPaid({ ...ok, captureStatus: 'PENDING' }, trx), false);
  assert.equal(isPaid({ ...ok, customId: 'BENIH-2' }, trx), false);
  assert.equal(isPaid({ ...ok, currency: 'EUR' }, trx), false);
  assert.equal(isPaid({ ...ok, value: '1.24' }, trx), false);
  assert.equal(isPaid(ok, { ...trx, provider_amount: null }), false);
});
