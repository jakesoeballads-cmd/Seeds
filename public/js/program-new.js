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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    // datetime-local tidak membawa zona waktu; ubah ke ISO dengan zona waktu browser.
    ['start_at', 'end_at'].forEach((k) => {
      body[k] = body[k] ? new Date(body[k]).toISOString() : '';
    });

    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    message.hidden = false;
    if (res.ok) {
      message.className = 'alert success';
      message.textContent = 'Kegiatan berhasil dibuat.';
      setTimeout(() => (window.location.href = '/'), 1000);
    } else {
      message.className = 'alert error';
      message.textContent = data.error;
    }
  });
})();
