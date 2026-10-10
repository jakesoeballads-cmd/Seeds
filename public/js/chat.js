// Percakapan penyelenggara <-> peserta. Pesan baru diambil ulang tiap 5 detik.
(function () {
  const root = document.querySelector('[data-participant-id]');
  const { programId, participantId, me } = root.dataset;
  const chat = document.getElementById('chat');
  const form = document.getElementById('chat-form');
  const errorEl = document.getElementById('chat-error');
  const url = `/api/programs/${programId}/messages/${participantId}`;

  function bubble(m) {
    const div = document.createElement('div');
    div.className = `bubble ${m.sender_id === me ? 'mine' : ''}`;
    div.textContent = m.body;
    const time = document.createElement('time');
    time.textContent = new Date(m.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    div.appendChild(time);
    return div;
  }

  function renderAll(messages) {
    chat.innerHTML = '';
    if (!messages.length) chat.innerHTML = '<p class="muted">Belum ada pesan. Mulai percakapan di bawah.</p>';
    messages.forEach((m) => chat.appendChild(bubble(m)));
    chat.scrollTop = chat.scrollHeight;
  }

  async function refresh() {
    const res = await fetch(url);
    if (res.ok) renderAll((await res.json()).messages);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: form.body.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.hidden = false;
      errorEl.textContent = data.error;
      return;
    }
    errorEl.hidden = true;
    form.body.value = '';
    refresh();
  });

  chat.scrollTop = chat.scrollHeight;
  setInterval(() => document.visibilityState === 'visible' && refresh(), 5000);
})();
