// Beranda: peta Google Maps + daftar program di sekitar pengunjung.
(function () {
  const DEFAULT_CENTER = { lat: -6.2, lng: 106.816666 }; // Jakarta, bila lokasi tidak diizinkan
  let map = null;
  let markers = [];
  let center = DEFAULT_CENTER;

  const statusEl = document.getElementById('status');
  const listEl = document.getElementById('program-list');
  const radiusEl = document.getElementById('radius');

  function formatDate(iso) {
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ORGANIZER_TYPES = { perorangan: 'Perorangan', komunitas: 'Komunitas', organisasi: 'Organisasi', badan_usaha: 'Badan usaha' };

  async function donate(id, button) {
    if (!window.BENIH.loggedIn) {
      window.location.href = '/login?next=/';
      return;
    }
    const amount = Number(window.prompt('Berapa Benih yang ingin kamu donasikan?', '10'));
    if (!Number.isInteger(amount) || amount < 1) return;
    button.disabled = true;
    const res = await fetch(`/api/programs/${id}/donate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benih_amount: amount }),
    });
    const data = await res.json();
    button.disabled = false;
    if (res.ok) {
      window.alert(`Terima kasih! ${amount} Benih terkirim.`);
      load();
    } else if (res.status === 400 && /tidak cukup/.test(data.error)) {
      if (window.confirm(`${data.error} Beli Benih sekarang?`)) window.location.href = '/benih';
    } else {
      window.alert(data.error);
    }
  }

  function render(programs) {
    markers.forEach((m) => m.setMap(null));
    markers = [];
    listEl.innerHTML = '';

    statusEl.textContent = programs.length
      ? `${programs.length} program dalam radius ${radiusEl.value} km`
      : 'Belum ada program di sekitarmu. Jadilah yang pertama membuat kegiatan!';

    programs.forEach((p) => {
      const li = document.createElement('li');
      const photo = (p.photo_urls || [])[0];
      const url = `/kegiatan/${encodeURIComponent(p.id)}`;
      li.innerHTML = `
        ${photo ? `<img class="thumb" src="${escapeHtml(photo)}" alt="" loading="lazy">` : '<div class="thumb" aria-hidden="true">🌱</div>'}
        <div>
          <h3><a href="${url}">${escapeHtml(p.title)}</a></h3>
          <p class="org">oleh <strong>${escapeHtml(p.organizer_name)}</strong>
            <span class="org-type">${ORGANIZER_TYPES[p.organizer_type] || ''}</span></p>
          <p class="muted">${escapeHtml(p.location_name || '')} · ${p.distance_km.toFixed(1)} km</p>
          <p class="muted">${formatDate(p.start_at)}</p>
          <p class="muted">🌱 ${p.benih_collected} ${p.benih_target ? `/ ${p.benih_target} ` : ''}Benih terkumpul</p>
          <div class="actions">
            <a class="btn small" href="${url}">Ikuti</a>
            <button class="btn small ghost" data-action="donate">Donasi Benih</button>
          </div>
        </div>`;
      li.querySelector('[data-action="donate"]').addEventListener('click', (e) => donate(p.id, e.currentTarget));
      listEl.appendChild(li);

      if (map) {
        const marker = new google.maps.Marker({ map, position: { lat: p.lat, lng: p.lng }, title: p.title });
        marker.addListener('click', () => li.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        markers.push(marker);
      }
    });
  }

  async function load() {
    statusEl.textContent = 'Memuat program…';
    try {
      const params = new URLSearchParams({ lat: center.lat, lng: center.lng, radius_km: radiusEl.value });
      const res = await fetch(`/api/programs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      render(data.programs);
    } catch (err) {
      statusEl.textContent = `Gagal memuat program: ${err.message}`;
    }
  }

  function locate() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(DEFAULT_CENTER);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(DEFAULT_CENTER),
        { timeout: 8000 }
      );
    });
  }

  // Dipanggil oleh script Google Maps (callback=initMap), atau langsung bila
  // API key belum diisi sehingga daftar tetap tampil tanpa peta.
  window.initMap = async function () {
    center = await locate();
    if (window.google && google.maps) {
      map = new google.maps.Map(document.getElementById('map'), { center, zoom: 11 });
      new google.maps.Marker({
        map,
        position: center,
        title: 'Lokasimu',
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
    }
    load();
  };

  radiusEl.addEventListener('change', load);
})();
