'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CENTER, RADII, distanceKm } from '@/lib/constants';
import { photosOf } from '@/lib/scene';
import type { Activity } from '@/lib/types';
import { ActivityMap } from './ActivityMap';
import { ProgressBar, collectedText, when } from './ActivityBits';
import { useI18n } from './I18nProvider';

export function NearbyActivities({ activities, userId }: { activities: Activity[]; userId: string | null }) {
  const { t, f } = useI18n();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [located, setLocated] = useState<boolean | null>(null);
  const [radius, setRadius] = useState<number>(25);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return setLocated(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocated(true);
      },
      () => setLocated(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  const list = useMemo(
    () =>
      activities
        .map((a) => ({ ...a, km: distanceKm(center, a) }))
        .filter((a) => a.km <= radius)
        .sort((a, b) => a.km - b.km),
    [activities, center, radius],
  );

  const pins = useMemo(() => list.map((a) => ({ id: a.id, title: a.title, lat: a.lat, lng: a.lng })), [list]);

  function select(id: string) {
    setActiveId(id);
    document.getElementById('item-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="map-layout">
      <ActivityMap center={center} pins={pins} activeId={activeId} onSelect={select} showYou zoom={radius > 25 ? 10 : 11} />
      <aside>
        <div className="list-header">
          <h3 style={{ margin: 0 }}>{t('home.list')}</h3>
          <select aria-label={t('home.radius')} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {f.num(r)} km
              </option>
            ))}
          </select>
        </div>
        {located === false && <p className="muted" style={{ fontSize: '.85rem' }}>{t('home.locFallback')}</p>}
        <p className="muted">{list.length ? t('home.count', { n: list.length, r: f.num(radius) }) : t('home.none')}</p>
        <ul className="program-list">
          {list.map((a) => {
            const own = userId === a.owner_id;
            return (
              <li key={a.id} id={'item-' + a.id} className={activeId === a.id ? 'active' : ''}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={photosOf(a)[0]} alt="" loading="lazy" />
                <div>
                  <h3>
                    <Link href={`/kegiatan/${a.id}`} style={{ fontWeight: 700 }}>{a.title}</Link>
                  </h3>
                  <p>
                    {t('by', { name: '' })}
                    <strong>{own ? t('me.you') : a.org_name}</strong> <span className="org-type">{t('org.' + a.org_type)}</span>
                  </p>
                  <p className="muted">
                    {a.location_name} · {f.km(a.km)} km · {when(t, f, a)}
                  </p>
                  <ProgressBar a={a} />
                  <p className="muted">🌱 {collectedText(t, f, a)}</p>
                  <div className="row" style={{ marginTop: 6 }}>
                    <Link className="btn small" href={`/kegiatan/${a.id}`}>
                      {own ? t('btn.manage') : t('btn.viewJoin')}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
