// Formulir pembuatan kegiatan + pemilih lokasi di peta.
(function () {
  const form = document.getElementById('program-form');
  const message = document.getElementById('form-message');
  let marker = null;

  function setLocation(lat, lng) {
    form.lat.value = lat.toFixed(6);
    form.lng.value = lng.toFixed(6);
  }

  window.initPickerMap = function () {
    const map = new google.maps.Map(document.getElementById('picker-map'), {
      center: { lat: -6.2, lng: 106.816666 },
      zoom: 10,
    });
    navigator.geolocation && navigator.geolocation.getCurrentPosition((pos) => {
      map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    map.addListener('click', (e) => {
      if (marker) marker.setMap(null);
      marker = new google.maps.Marker({ map, position: e.latLng });
      setLocation(e.latLng.lat(), e.latLng.lng());
    });
  };

  // Pratinjau foto sebelum diunggah.
  form.photos.addEventListener('change', () => {
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    Array.from(form.photos.files).slice(0, 5).forEach((file) => {
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = new FormData(form);
    const showError = (text) => {
      message.hidden = false;
      message.className = 'alert error';
      message.textContent = text;
    };
    // Tanggal + jam mulai/selesai -> start_at/end_at tanpa zona waktu; server
    // membacanya dalam zona waktu kegiatan (TIME_ZONE), bukan zona waktu browser.
    const date = body.get('date');
    const startTime = body.get('start_time');
    const endTime = body.get('end_time');
    if (!date || !startTime || !endTime) return showError(t('Isi tanggal, jam mulai, dan jam selesai.'));
    if (endTime <= startTime) return showError(t('Jam selesai harus setelah jam mulai.'));
    ['date', 'start_time', 'end_time'].forEach((k) => body.delete(k));
    body.set('start_at', `${date}T${startTime}`);
    body.set('end_at', `${date}T${endTime}`);
    if (form.photos.files.length > 5) return showError(t('Maksimal {n} foto.', { n: 5 }));

    // multipart/form-data: browser mengatur Content-Type beserta boundary.
    const res = await fetch('/api/programs', { method: 'POST', body });
    const data = await res.json();
    message.hidden = false;
    if (res.ok) {
      message.className = 'alert success';
      message.textContent = t('Kegiatan berhasil dibuat.');
      setTimeout(() => (window.location.href = `/kegiatan/${data.program.id}`), 1000);
    } else {
      message.className = 'alert error';
      message.textContent = data.error;
    }
  });
})();
