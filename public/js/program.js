// Halaman detail kegiatan: ikut (relawan/berbayar), donasi, bagikan, dan
// pengelolaan peserta oleh penyelenggara.
(function () {
  const root = document.querySelector('[data-program-id]');
  const programId = root.dataset.programId;

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function show(el, text, kind) {
    el.hidden = false;
    el.className = `alert ${kind}`;
    el.textContent = text;
  }

  const joinForm = document.getElementById('join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = new FormData(joinForm).get('role');
      const { ok, data } = await post(`/api/programs/${programId}/join`, { role });
      const msg = document.getElementById('join-message');
      if (!ok) return show(msg, data.error, 'error');
      if (data.chat_url) {
        window.location.href = data.chat_url;
      } else {
        show(msg, 'Kamu terdaftar sebagai relawan. Sampai jumpa di lokasi!', 'success');
        setTimeout(() => window.location.reload(), 1200);
      }
    });
  }

  const donateForm = document.getElementById('donate-form');
  if (donateForm) {
    donateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(donateForm));
      body.benih_amount = Number(body.benih_amount);
      const { ok, data } = await post(`/api/programs/${programId}/donate`, body);
      const msg = document.getElementById('donate-message');
      if (ok) {
        show(msg, `Terima kasih! ${body.benih_amount} Benih terkirim.`, 'success');
        setTimeout(() => window.location.reload(), 1200);
      } else if (/tidak cukup/.test(data.error || '')) {
        msg.hidden = false;
        msg.className = 'alert error';
        msg.innerHTML = 'Saldo Benih tidak cukup. <a href="/benih">Beli Benih</a>';
      } else {
        show(msg, data.error, 'error');
      }
    });
  }

  // Bagikan
  const copyBtn = document.getElementById('copy-link');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.url);
      copyBtn.textContent = 'Tautan disalin ✓';
    } catch {
      window.prompt('Salin tautan ini:', copyBtn.dataset.url);
    }
  });
  const nativeBtn = document.getElementById('native-share');
  if (navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', () =>
      navigator.share({ title: document.title, text: nativeBtn.dataset.text, url: nativeBtn.dataset.url }).catch(() => {})
    );
  }

  // Penyelenggara: kelola peserta
  const manageMsg = document.getElementById('manage-message');
  document.querySelectorAll('tr[data-user]').forEach((row) => {
    const base = `/api/programs/${programId}/participants/${row.dataset.user}`;
    const handle = async (url, body) => {
      const { ok, data } = await post(url, body);
      if (!ok) return show(manageMsg, data.error, 'error');
      window.location.reload();
    };
    row.querySelector('[data-act="attended"]')?.addEventListener('click', () => handle(`${base}/attended`));
    row.querySelector('[data-act="pay"]')?.addEventListener('click', () => handle(`${base}/pay`));
    row.querySelector('form[data-act="agreement"]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handle(`${base}/agreement`, { benih_amount: Number(e.target.benih_amount.value) });
    });
  });
})();
