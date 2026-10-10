// Tautan dan URL embed Google Maps untuk satu titik.
// Dengan API key dipakai Maps Embed API (aktifkan "Maps Embed API" untuk key
// yang sama); tanpa key dipakai embed publik Google Maps yang tidak perlu key.
function embedUrl(lat, lng, { key, zoom = 15, lang = 'id' } = {}) {
  const q = `${lat},${lng}`;
  if (key) {
    const params = new URLSearchParams({ key, q, zoom: String(zoom), language: lang });
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }
  const params = new URLSearchParams({ q, z: String(zoom), output: 'embed', hl: lang });
  return `https://maps.google.com/maps?${params}`;
}

const openUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;

module.exports = { embedUrl, openUrl, directionsUrl };
