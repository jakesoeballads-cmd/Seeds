'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, type GoogleNs } from '@/lib/maps';
import { useI18n } from './I18nProvider';
import type { MapProps } from './LeafletMap';

const PIN = '#d93025';
const pinIcon = (g: GoogleNs, active: boolean) => {
  const w = active ? 36 : 28;
  const h = active ? 46 : 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 28 36"><path d="M14 35C4 21 1 17 1 13a13 13 0 1 1 26 0c0 4-3 8-13 22Z" fill="${PIN}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`;
  return { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), scaledSize: new g.maps.Size(w, h), anchor: new g.maps.Point(w / 2, h) };
};

/** Peta Google Maps (Maps JavaScript API) dengan props yang sama seperti peta Leaflet. */
export function GoogleMap({ center, pins = [], activeId, onSelect, picking, pick, onPick, showYou, zoom = 11 }: MapProps) {
  const { t, lang } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const g = useRef<GoogleNs>(null);
  const map = useRef<GoogleNs>(null);
  const markers = useRef<GoogleNs[]>([]);
  const handlers = useRef({ onSelect, onPick, picking });
  handlers.current = { onSelect, onPick, picking };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Membuat peta sekali.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(lang)
      .then((google) => {
        if (cancelled || !el.current || map.current) return;
        g.current = google;
        map.current = new google.maps.Map(el.current, {
          center,
          zoom,
          gestureHandling: 'cooperative',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          draggableCursor: picking ? 'crosshair' : undefined,
        });
        map.current.addListener('click', (e: GoogleNs) => {
          if (handlers.current.picking && e.latLng) handlers.current.onPick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pindah ke pusat baru (mis. setelah lokasi pengguna diketahui atau dicari).
  useEffect(() => {
    map.current?.panTo(center);
  }, [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) map.current?.setZoom(zoom);
  }, [zoom, ready]);

  // Gambar ulang penanda saat data berubah.
  useEffect(() => {
    const google = g.current;
    if (!ready || !google || !map.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];
    if (showYou) {
      markers.current.push(
        new google.maps.Marker({
          map: map.current,
          position: center,
          title: t('map.you'),
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
          zIndex: 500,
        }),
      );
    }
    for (const p of pins) {
      const active = p.id === activeId;
      const m = new google.maps.Marker({ map: map.current, position: { lat: p.lat, lng: p.lng }, title: p.title, icon: pinIcon(google, active), zIndex: active ? 1000 : 1 });
      m.addListener('click', () => handlers.current.onSelect?.(p.id));
      markers.current.push(m);
    }
    if (pick) markers.current.push(new google.maps.Marker({ map: map.current, position: pick, icon: pinIcon(google, true), zIndex: 1000 }));
  }, [ready, pins, activeId, pick, showYou, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map">
      <div ref={el} className="google-map" style={picking ? { cursor: 'crosshair' } : undefined} role="region" aria-label={t('map.label')}>
        {failed && <p className="alert error" style={{ margin: 16 }}>{t('map.loadFail')}</p>}
      </div>
      <div className="map-note muted">{t('map.noteGoogle')}</div>
    </div>
  );
}
