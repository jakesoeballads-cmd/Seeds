import { createClient } from './supabase/server';
import { sampleActivities } from './sample';
import type { Activity } from './types';

const ACTIVITY_COLUMNS =
  'id, owner_id, title, category, org_name, org_type, description, location_name, lat, lng, date, start_time, end_time, max_participants, target_benih, collected_benih, participant_count, photos';

function todayIso() {
  const d = new Date(Date.now() - 864e5);
  return d.toISOString().slice(0, 10);
}

/** Kegiatan mendatang (mulai kemarin). Di mode contoh mengembalikan data contoh. */
export async function getUpcomingActivities(): Promise<Activity[]> {
  const supabase = await createClient();
  if (!supabase) return sampleActivities();
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .gte('date', todayIso())
    .order('date', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Activity[];
}

export async function getActivity(id: string): Promise<Activity | null> {
  const supabase = await createClient();
  if (!supabase) return sampleActivities().find((a) => a.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from('activities').select(ACTIVITY_COLUMNS).eq('id', id).maybeSingle();
  return (data as unknown as Activity | null) ?? null;
}
