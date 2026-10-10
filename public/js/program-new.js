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
    // datetime-local tidak membawa zona waktu; ubah ke ISO dengan zona waktu browser.
    ['start_at', 'end_at'].forEach((k) => {
      const v = body.get(k);
      body.set(k, v ? new Date(v).toISOString() : '');
    });
    if (form.photos.files.length > 5) {
      message.hidden = false;
      message.className = 'alert error';
      message.textContent = 'Maksimal 5 foto.';
      return;
    }

    // multipart/form-data: browser mengatur Content-Type beserta boundary.
    const res = await fetch('/api/programs', { method: 'POST', body });
    const data = await res.json();
    message.hidden = false;
    if (res.ok) {
      message.className = 'alert success';
      message.textContent = 'Kegiatan berhasil dibuat.';
      setTimeout(() => (window.location.href = `/kegiatan/${data.program.id}`), 1000);
    } else {
      message.className = 'alert error';
      message.textContent = data.error;
    }
  });
})();
