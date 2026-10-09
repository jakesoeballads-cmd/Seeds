// Halaman beli Benih: checkout via Midtrans Snap (atau simulasi) + riwayat.
(function () {
  const form = document.getElementById('buy-form');
  const totalEl = document.getElementById('total');
  const message = document.getElementById('buy-message');
  const historyEl = document.getElementById('history');
  const price = Number(form.dataset.price);
  const rupiah = (n) => 'Rp' + Number(n).toLocaleString('id-ID');

  const statusLabel = { pending: 'Menunggu', success: 'Berhasil', failed: 'Gagal', refunded: 'Dikembalikan' };

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
      historyEl.innerHTML = `<li class="muted">${data.error}</li>`;
      return;
    }
    historyEl.innerHTML = data.transactions.length ? '' : '<li class="muted">Belum ada transaksi.</li>';
    data.transactions.forEach((t) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${t.benih_amount} Benih · ${rupiah(t.gross_amount)}</span>
        <span class="badge ${t.status}">${statusLabel[t.status] || t.status}</span>`;
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
      onSuccess: () => { showMessage('Pembayaran berhasil, saldo segera diperbarui.', 'success'); loadHistory(); },
      onPending: () => { showMessage('Menunggu pembayaran.', 'info'); loadHistory(); },
      onError: () => showMessage('Pembayaran gagal.', 'error'),
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
  const wStatus = { pending: 'Diproses', paid: 'Dicairkan', rejected: 'Ditolak' };

  function updateBreakdown() {
    const amount = Number(wForm.benih_amount.value) || 0;
    const gross = amount * wPrice;
    const fee = Math.round((gross * feeBps) / 10000);
    wBreakdown.textContent = amount
      ? `Nilai ${rupiah(gross)} − potongan ${rupiah(fee)} = diterima ${rupiah(gross - fee)}`
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
    wList.innerHTML = data.withdrawals.length ? '' : '<li class="muted">Belum ada penarikan.</li>';
    data.withdrawals.forEach((w) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${w.benih_amount} Benih · diterima ${rupiah(w.net_idr)} (potongan ${rupiah(w.fee_idr)})</span>
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
      ? `Penarikan diajukan. ${rupiah(data.withdrawal.net_idr)} akan ditransfer setelah diverifikasi.`
      : data.error;
    if (res.ok) setTimeout(() => window.location.reload(), 1500);
  });

  loadWithdrawals();
})();
