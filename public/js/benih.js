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
})();
