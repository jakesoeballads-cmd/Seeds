const config = require('../config');

// Rincian penarikan dalam Rupiah. Perhitungan yang sama dilakukan oleh fungsi
// SQL request_withdrawal; fungsi ini untuk pratinjau dan tes.
function calcWithdrawal(benihAmount, priceIdr = config.benihPriceIdr, feeBps = config.withdrawalFeeBps) {
  const grossIdr = benihAmount * priceIdr;
  const feeIdr = Math.round((grossIdr * feeBps) / 10000);
  return { grossIdr, feeIdr, netIdr: grossIdr - feeIdr };
}

module.exports = { calcWithdrawal };
