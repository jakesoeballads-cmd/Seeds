/** Kunci Google Maps (opsional). Tanpa kunci, peta memakai Leaflet + OpenStreetMap. */
export const GOOGLE_MAPS_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();

/**
 * URL embed Google Maps untuk satu titik. Dengan kunci dipakai Maps Embed API;
 * tanpa kunci dipakai embed publik Google Maps yang tidak perlu kunci.
 */
export function embedUrl(lat: number, lng: number, { key = GOOGLE_MAPS_KEY, zoom = 15, lang = 'id' } = {}) {
  const q = `${lat},${lng}`;
  if (key) return `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q, zoom: String(zoom), language: lang })}`;
  return `https://maps.google.com/maps?${new URLSearchParams({ q, z: String(zoom), output: 'embed', hl: lang })}`;
}

export const openUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GoogleNs = any;

let loading: Promise<GoogleNs> | null = null;

/** Memuat Maps JavaScript API sekali saja (hanya di browser). */
export function loadGoogleMaps(lang: string): Promise<GoogleNs> {
  const w = window as unknown as { google?: { maps?: unknown }; __benihMapsReady?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google);
  loading ??= new Promise((resolve, reject) => {
    w.__benihMapsReady = () => resolve(w.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: GOOGLE_MAPS_KEY, language: lang, callback: '__benihMapsReady', loading: 'async' })}`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('Google Maps gagal dimuat'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type Place = { lat: number; lng: number; name: string };

/** Cari lokasi: Google Geocoder bila ada kunci, selain itu OpenStreetMap Nominatim. */
export async function geocode(query: string, lang: string): Promise<Place | null> {
  if (GOOGLE_MAPS_KEY) {
    const g = await loadGoogleMaps(lang);
    let results: GoogleNs[] = [];
    try {
      ({ results } = await new g.maps.Geocoder().geocode({ address: query, language: lang }));
    } catch (err) {
      if ((err as { code?: string })?.code === 'ZERO_RESULTS') return null;
      throw err;
    }
    if (!results?.length) return null;
    const r = results[0];
    return { lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), name: r.formatted_address };
  }
  const params = new URLSearchParams({ q: query, format: 'json', limit: '1', 'accept-language': lang });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error(String(res.status));
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), name: hit.display_name.split(',').slice(0, 2).join(',') } : null;
}
