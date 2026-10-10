const test = require('node:test');
const assert = require('node:assert');
const paypal = require('../src/services/paypal');

test('convertFromIdr membulatkan ke atas ke sen', () => {
  assert.strictEqual(paypal.convertFromIdr(20000, 16000), '1.25');
  assert.strictEqual(paypal.convertFromIdr(2000, 16000), '0.13'); // 0,125 -> 0,13
  assert.strictEqual(paypal.convertFromIdr(1000000, 16000), '62.50');
});

test('isPaid hanya menerima capture yang cocok dengan transaksi', () => {
  const trx = { order_id: 'BENIH-1', currency: 'USD', provider_amount: '1.25' };
  const ok = { status: 'COMPLETED', captureStatus: 'COMPLETED', customId: 'BENIH-1', currency: 'USD', value: '1.25' };
  assert.ok(paypal.isPaid(ok, trx));
  assert.ok(!paypal.isPaid({ ...ok, value: '1.00' }, trx));
  assert.ok(!paypal.isPaid({ ...ok, customId: 'BENIH-2' }, trx));
  assert.ok(!paypal.isPaid({ ...ok, captureStatus: 'PENDING' }, trx));
  assert.ok(!paypal.isPaid({ ...ok, currency: 'EUR' }, trx));
});
