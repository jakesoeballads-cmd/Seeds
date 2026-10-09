const test = require('node:test');
const assert = require('node:assert');
const { computeSignature, verifySignature, mapStatus } = require('../src/services/midtrans');
const { parseBenihAmount } = require('../src/services/benih');

const SERVER_KEY = 'SB-Mid-server-test';

test('verifySignature menerima signature yang benar', () => {
  const n = { order_id: 'BENIH-1', status_code: '200', gross_amount: '10000.00' };
  n.signature_key = computeSignature(n, SERVER_KEY);
  assert.strictEqual(verifySignature(n, SERVER_KEY), true);
});

test('verifySignature menolak signature yang diubah atau tanpa server key', () => {
  const n = { order_id: 'BENIH-1', status_code: '200', gross_amount: '10000.00' };
  n.signature_key = computeSignature(n, SERVER_KEY);
  assert.strictEqual(verifySignature({ ...n, gross_amount: '1.00' }, SERVER_KEY), false);
  assert.strictEqual(verifySignature(n, ''), false);
  assert.strictEqual(verifySignature({ ...n, signature_key: undefined }, SERVER_KEY), false);
});

test('mapStatus memetakan status Midtrans', () => {
  assert.strictEqual(mapStatus({ transaction_status: 'settlement' }), 'success');
  assert.strictEqual(mapStatus({ transaction_status: 'capture', fraud_status: 'accept' }), 'success');
  assert.strictEqual(mapStatus({ transaction_status: 'capture', fraud_status: 'challenge' }), 'pending');
  assert.strictEqual(mapStatus({ transaction_status: 'pending' }), 'pending');
  for (const s of ['deny', 'cancel', 'expire', 'failure']) {
    assert.strictEqual(mapStatus({ transaction_status: s }), 'failed');
  }
  assert.strictEqual(mapStatus({ transaction_status: 'refund' }), 'refunded');
});

test('parseBenihAmount memvalidasi jumlah', () => {
  assert.strictEqual(parseBenihAmount('25'), 25);
  assert.throws(() => parseBenihAmount(0));
  assert.throws(() => parseBenihAmount(1.5));
  assert.throws(() => parseBenihAmount('abc'));
});

test('calcWithdrawal memotong 2,5% dari nilai Rp2.000 per Benih', () => {
  const { calcWithdrawal } = require('../src/services/wallet');
  assert.deepStrictEqual(calcWithdrawal(100, 2000, 250), { grossIdr: 200000, feeIdr: 5000, netIdr: 195000 });
  assert.deepStrictEqual(calcWithdrawal(1, 2000, 250), { grossIdr: 2000, feeIdr: 50, netIdr: 1950 });
});
