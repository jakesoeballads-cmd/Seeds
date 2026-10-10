'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { useI18n } from './I18nProvider';

type Point = { lat: number; lng: number };
type Pin = Point & { id: string; title: string };

type Props = {
  center: Point;
  pins?: Pin[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Mode memilih lokasi: klik peta untuk menaruh pin. */
  picking?: boolean;
  pick?: Point | null;
  onPick?: (p: Point) => void;
  showYou?: boolean;
  zoom?: number;
};

const pinHtml = (active: boolean, color = 'var(--pin)') =>
  `<svg width="${active ? 36 : 28}" height="${active ? 46 : 36}" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35C4 21 1 17 1 13a13 13 0 1 1 26 0c0 4-3 8-13 22Z" style="fill:${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`;

/** Peta OpenStreetMap (Leaflet). Dimuat hanya di browser. */
export function ActivityMap({ center, pins = [], activeId, onSelect, picking, pick, onPick, showYou, zoom = 11 }: Props) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const handlers = useRef({ onSelect, onPick });
  handlers.current = { onSelect, onPick };

  // Membuat peta sekali.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      const m = mod.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], zoom);
      mod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // Prefix teks saja: ikon bendera bawaan Leaflet ikut membesar oleh gaya halaman.
      m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      m.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (picking) handlers.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      layer.current = mod.layerGroup().addTo(m);
      map.current = m;
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pindah ke pusat baru (mis. setelah lokasi pengguna diketahui).
  useEffect(() => {
    map.current?.setView([center.lat, center.lng], map.current.getZoom());
  }, [center.lat, center.lng]);

  function draw() {
    const mod = L.current;
    const g = layer.current;
    if (!mod || !g) return;
    g.clearLayers();
    if (showYou) {
      mod.circleMarker([center.lat, center.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip(t('map.you'))
        .addTo(g);
    }
    for (const p of pins) {
      const active = p.id === activeId;
      const icon = mod.divIcon({ html: pinHtml(active), className: '', iconSize: active ? [36, 46] : [28, 36], iconAnchor: active ? [18, 46] : [14, 36] });
      mod.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true, zIndexOffset: active ? 1000 : 0 })
        .on('click', () => handlers.current.onSelect?.(p.id))
        .addTo(g);
    }
    if (pick) {
      const icon = mod.divIcon({ html: pinHtml(true), className: '', iconSize: [36, 46], iconAnchor: [18, 46] });
      mod.marker([pick.lat, pick.lng], { icon }).addTo(g);
    }
  }

  // Gambar ulang pin saat data berubah.
  useEffect(draw, [pins, activeId, pick, showYou, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map">
      <div ref={el} className="leaflet-map" style={picking ? { cursor: 'crosshair' } : undefined} role="region" aria-label={t('map.label')} />
      <div className="map-note muted">{t('map.noteReal')}</div>
    </div>
  );
}
