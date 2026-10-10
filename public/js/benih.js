// Halaman beli Benih: checkout via Midtrans Snap (atau simulasi) + riwayat.
(function () {
  const form = document.getElementById('buy-form');
  const totalEl = document.getElementById('total');
  const message = document.getElementById('buy-message');
  const historyEl = document.getElementById('history');
  const price = Number(form.dataset.price);
  const { rupiah } = fmt;

  const statusLabel = { pending: t('Menunggu'), success: t('Berhasil'), failed: t('Gagal'), refunded: t('Dikembalikan') };

  function updateTotal() {
    totalEl.textContent = rupiah((Number(form.benih_amount.value) || 0) * price);
  }

  function showMessage(text, kind) {
    message.hidden = false;
    message.className = `alert ${kind}`;
    message.textContent = text;
  }

  async function loadHistory() {
    const res = await fetch('/api/payments/history');
    const data = await res.json();
    if (!res.ok) {
      historyEl.innerHTML = '<li class="muted"></li>';
      historyEl.firstChild.textContent = data.error;
      return;
    }
    historyEl.innerHTML = data.transactions.length ? '' : `<li class="muted">${t('Belum ada transaksi.')}</li>`;
    data.transactions.forEach((trx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${fmt.num(trx.benih_amount)} Benih · ${rupiah(trx.gross_amount)}</span>
        <span class="badge ${trx.status}">${statusLabel[trx.status] || trx.status}</span>`;
      historyEl.appendChild(li);
    });
  }

  form.benih_amount.addEventListener('input', updateTotal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benih_amount: Number(form.benih_amount.value) }),
    });
    const data = await res.json();
    if (!res.ok) return showMessage(data.error, 'error');

    if (data.simulated || !window.snap) {
      window.location.href = data.redirect_url;
      return;
    }
    // Popup Midtrans Snap. Status final tetap dicatat lewat webhook.
    window.snap.pay(data.snap_token, {
      onSuccess: () => { showMessage(t('Pembayaran berhasil, saldo segera diperbarui.'), 'success'); loadHistory(); },
      onPending: () => { showMessage(t('Menunggu pembayaran.'), 'info'); loadHistory(); },
      onError: () => showMessage(t('Pembayaran gagal.'), 'error'),
      onClose: () => loadHistory(),
    });
  });

  updateTotal();
  loadHistory();

  // Penarikan hasil donasi.
  const wForm = document.getElementById('withdraw-form');
  const wBreakdown = document.getElementById('withdraw-breakdown');
  const wMessage = document.getElementById('withdraw-message');
  const wList = document.getElementById('withdrawals');
  const wPrice = Number(wForm.dataset.price);
  const feeBps = Number(wForm.dataset.feeBps);
  const wStatus = { pending: t('Diproses'), paid: t('Dicairkan'), rejected: t('Ditolak') };

  function updateBreakdown() {
    const amount = Number(wForm.benih_amount.value) || 0;
    const gross = amount * wPrice;
    const fee = Math.round((gross * feeBps) / 10000);
    wBreakdown.textContent = amount
      ? t('Nilai {gross} − potongan {fee} = diterima {net}', { gross: rupiah(gross), fee: rupiah(fee), net: rupiah(gross - fee) })
      : '';
  }

  async function loadWithdrawals() {
    const res = await fetch('/api/wallet/withdrawals');
    const data = await res.json();
    if (!res.ok) {
      wList.innerHTML = '<li class="muted"></li>';
      wList.firstChild.textContent = data.error;
      return;
    }
    wList.innerHTML = data.withdrawals.length ? '' : `<li class="muted">${t('Belum ada penarikan.')}</li>`;
    data.withdrawals.forEach((w) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${fmt.num(w.benih_amount)} Benih · ${t('diterima {net} (potongan {fee})', { net: rupiah(w.net_idr), fee: rupiah(w.fee_idr) })}</span>
        <span class="badge ${w.status}">${wStatus[w.status] || w.status}</span>`;
      wList.appendChild(li);
    });
  }

  wForm.benih_amount.addEventListener('input', updateBreakdown);
  wForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/wallet/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(wForm))),
    });
    const data = await res.json();
    wMessage.hidden = false;
    wMessage.className = `alert ${res.ok ? 'success' : 'error'}`;
    wMessage.textContent = res.ok
      ? t('Penarikan diajukan. {net} akan ditransfer setelah diverifikasi.', { net: rupiah(data.withdrawal.net_idr) })
      : data.error;
    if (res.ok) setTimeout(() => window.location.reload(), 1500);
  });

  loadWithdrawals();
})();
