'use client';

import { GOOGLE_MAPS_KEY } from '@/lib/maps';
import { GoogleMap } from './GoogleMap';
import { LeafletMap, type MapProps } from './LeafletMap';

/** Peta kegiatan: Google Maps bila NEXT_PUBLIC_GOOGLE_MAPS_API_KEY diisi, selain itu Leaflet + OpenStreetMap. */
export function ActivityMap(props: MapProps) {
  return GOOGLE_MAPS_KEY ? <GoogleMap {...props} /> : <LeafletMap {...props} />;
}
