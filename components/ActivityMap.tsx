'use client';

import { useState } from 'react';
import { GOOGLE_MAPS_KEY, embedUrl, geocode, type MapProps } from '@/lib/maps';
import { GoogleMap } from './GoogleMap';
import { useI18n } from './I18nProvider';
import { mdiMapMarker } from '@mdi/js';
import { Icon } from './Icon';

/** Peta kegiatan, selalu Google Maps: interaktif bila NEXT_PUBLIC_GOOGLE_MAPS_API_KEY diisi, selain itu embed Google Maps. */
export function ActivityMap(props: MapProps) {
  return GOOGLE_MAPS_KEY ? <GoogleMap {...props} /> : <GoogleEmbedMap {...props} />;
}

/**
 * Embed Google Maps tanpa kunci. Embed hanya bisa menampilkan satu titik dan tidak bisa diklik,
 * jadi titik dipilih lewat pencarian alamat atau lokasi perangkat.
 */
function GoogleEmbedMap({ center, pins = [], activeId, picking, pick, onPick, zoom = 11 }: MapProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = pins.find((p) => p.id === activeId);
  const spot = pick ?? active ?? center;

  async function search() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setMsg(t('search.searching', { place: q }));
    try {
      const hit = await geocode(q, lang);
      if (!hit) return setMsg(t('search.notFound', { place: q }));
      onPick?.({ lat: hit.lat, lng: hit.lng });
      setMsg(hit.name);
    } catch {
      setMsg(t('search.failed'));
    } finally {
      setBusy(false);
    }
  }

  function here() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        onPick?.({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMsg(null);
      },
      () => setMsg(t('home.locFallback')),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="stack tight">
      {picking && (
        <div className="search-bar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                search();
              }
            }}
            placeholder={t('map.pickPh')}
            aria-label={t('map.pickPh')}
          />
          <button className="btn" type="button" onClick={search} disabled={busy}>
            {t('search.btn')}
          </button>
          <button className="btn ghost" type="button" onClick={here}>
            <Icon path={mdiMapMarker} /> {t('search.mine')}
          </button>
        </div>
      )}
      {msg && <p className="muted" role="status" style={{ margin: 0 }}>{msg}</p>}
      <div className="map">
        <iframe
          className="google-map"
          src={embedUrl(spot.lat, spot.lng, { zoom: picking || active ? 15 : zoom, lang })}
          title={t('map.label')}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="map-note muted">{t('map.noteGoogle')}</div>
      </div>
    </div>
  );
}
