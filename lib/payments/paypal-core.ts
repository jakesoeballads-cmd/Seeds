// Fungsi murni PayPal (tanpa impor) agar bisa diuji dengan `node --test`.

/** Rupiah → mata uang PayPal, dibulatkan ke atas ke sen agar tidak kurang bayar. */
export function convertFromIdr(idr: number, rate: number): string {
  return (Math.ceil(Math.round((idr / rate) * 1e6) / 1e4) / 100).toFixed(2);
}

export type CaptureSummary = {
  status?: string;
  captureStatus?: string;
  customId?: string;
  currency?: string;
  value?: string;
};

export type PaypalTrx = { order_id: string; currency: string; provider_amount: number | string | null };

/** Hasil capture dianggap lunas hanya bila semua data cocok dengan transaksi kita. */
export function isPaid(capture: CaptureSummary, trx: PaypalTrx): boolean {
  return (
    capture.status === 'COMPLETED' &&
    capture.captureStatus === 'COMPLETED' &&
    capture.customId === trx.order_id &&
    capture.currency === trx.currency &&
    trx.provider_amount != null &&
    Number(capture.value) === Number(trx.provider_amount)
  );
}
