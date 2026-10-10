// Beranda: peta Google Maps + daftar program di sekitar pengunjung.
(function () {
  const DEFAULT_CENTER = { lat: -6.2, lng: 106.816666 }; // Jakarta, bila lokasi tidak diizinkan
  let map = null;
  let markers = [];
  let center = DEFAULT_CENTER;
  let placeName = null; // diisi saat pengunjung mencari lokasi lain
  let youMarker = null;

  const statusEl = document.getElementById('status');
  const listEl = document.getElementById('program-list');
  const radiusEl = document.getElementById('radius');

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ORGANIZER_TYPES = { perorangan: 'Perorangan', komunitas: 'Komunitas', organisasi: 'Organisasi', badan_usaha: 'Badan usaha' };

  async function donate(id, button) {
    if (!window.BENIH.loggedIn) {
      window.location.href = '/login?next=/';
      return;
    }
    const amount = Number(window.prompt(t('Berapa Benih yang ingin kamu donasikan?'), '10'));
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
      window.alert(t('Terima kasih! {n} Benih terkirim.', { n: fmt.num(amount) }));
      load();
    } else if (data.code === 'insufficient_balance') {
      if (window.confirm(`${data.error} ${t('Beli Benih sekarang?')}`)) window.location.href = '/benih';
    } else {
      window.alert(data.error);
    }
  }

  function render(programs) {
    markers.forEach((m) => m.setMap(null));
    markers = [];
    listEl.innerHTML = '';

    if (placeName) {
      statusEl.textContent = programs.length
        ? t('{n} program dalam radius {km} km dari {place}', { n: programs.length, km: radiusEl.value, place: placeName })
        : t('Belum ada program di sekitar {place}.', { place: placeName });
    } else {
      statusEl.textContent = programs.length
        ? t('{n} program dalam radius {km} km', { n: programs.length, km: radiusEl.value })
        : t('Belum ada program di sekitarmu. Jadilah yang pertama membuat kegiatan!');
    }

    programs.forEach((p) => {
      const li = document.createElement('li');
      const photo = (p.photo_urls || [])[0];
      const url = `/kegiatan/${encodeURIComponent(p.id)}`;
      li.innerHTML = `
        ${photo ? `<img class="thumb" src="${escapeHtml(photo)}" alt="" loading="lazy">` : '<div class="thumb" aria-hidden="true">🌱</div>'}
        <div>
          <h3><a href="${url}">${escapeHtml(p.title)}</a></h3>
          <p class="org">${t('oleh {name}', { name: `<a class="org-link" href="/member/${encodeURIComponent(p.organizer_id)}"><strong>${escapeHtml(p.organizer_name)}</strong></a>` })}
            <span class="org-type">${ORGANIZER_TYPES[p.organizer_type] ? t(ORGANIZER_TYPES[p.organizer_type]) : ''}</span></p>
          <p class="muted">${escapeHtml(p.location_name || '')} · ${p.distance_km.toLocaleString(window.BENIH_I18N.locale, { maximumFractionDigits: 1 })} km</p>
          <p class="muted">${fmt.schedule(p.start_at, p.end_at)}</p>
          <p class="muted">🌱 ${fmt.num(p.benih_collected)} ${p.benih_target ? `/ ${fmt.num(p.benih_target)} ` : ''}${t('Benih terkumpul')}</p>
          <div class="actions">
            <a class="btn small" href="${url}">${t('Ikuti')}</a>
            <button class="btn small ghost" data-action="donate">${t('Donasi Benih')}</button>
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
    statusEl.textContent = t('Memuat program…');
    try {
      const params = new URLSearchParams({ lat: center.lat, lng: center.lng, radius_km: radiusEl.value });
      const res = await fetch(`/api/programs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      render(data.programs);
    } catch (err) {
      statusEl.textContent = t('Gagal memuat program: {error}', { error: err.message });
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

  // Cari lokasi lain (mis. pengunjung di Jerman mencari kegiatan di Bandung).
  // Pakai Google Geocoder bila peta aktif; tanpa API key pakai OpenStreetMap Nominatim.
  async function geocode(query) {
    if (window.google && google.maps && google.maps.Geocoder) {
      const { results } = await new google.maps.Geocoder().geocode({ address: query, language: window.BENIH_I18N.lang });
      if (!results.length) return null;
      const r = results[0];
      return { lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), name: r.formatted_address };
    }
    const params = new URLSearchParams({ q: query, format: 'json', limit: '1', 'accept-language': window.BENIH_I18N.lang });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), name: hit.display_name.split(',').slice(0, 2).join(',') } : null;
  }

  function moveTo(point, name) {
    center = { lat: point.lat, lng: point.lng };
    placeName = name;
    if (map) {
      map.setCenter(center);
      if (youMarker) youMarker.setVisible(!name);
    }
    load();
  }

  const searchForm = document.getElementById('place-search');
  const searchInput = document.getElementById('cari');
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    statusEl.textContent = t('Mencari {place}…', { place: query });
    try {
      const hit = await geocode(query);
      if (!hit) {
        statusEl.textContent = t('Lokasi "{place}" tidak ditemukan. Coba nama kota atau daerah.', { place: query });
        return;
      }
      moveTo(hit, hit.name);
    } catch (err) {
      statusEl.textContent = t('Pencarian lokasi gagal. Coba lagi.');
    }
  });
  document.getElementById('my-location').addEventListener('click', async () => {
    searchInput.value = '';
    statusEl.textContent = t('Mencari lokasimu…');
    moveTo(await locate(), null);
  });
  // Tab "Cari" di menu bawah membuka /#cari.
  if (window.location.hash === '#cari') searchInput.focus();

  // Dipanggil oleh script Google Maps (callback=initMap), atau langsung bila
  // API key belum diisi sehingga daftar tetap tampil tanpa peta.
  window.initMap = async function () {
    center = await locate();
    if (window.google && google.maps) {
      map = new google.maps.Map(document.getElementById('map'), { center, zoom: 11 });
      youMarker = new google.maps.Marker({
        map,
        position: center,
        title: t('Lokasimu'),
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      });
    }
    load();
  };

  radiusEl.addEventListener('change', load);
})();
