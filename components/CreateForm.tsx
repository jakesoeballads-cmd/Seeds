'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CATEGORIES, DEFAULT_CENTER, MAX_PHOTOS, MAX_PHOTO_BYTES, ORG_TYPES, PHOTO_BUCKET } from '@/lib/constants';
import { getBrowserClient } from '@/lib/supabase/client';
import { ActivityMap } from './ActivityMap';
import { useI18n } from './I18nProvider';

type Point = { lat: number; lng: number };

function isoDay(offset: number) {
  const d = new Date(Date.now() + offset * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CreateForm({ userId, defaultOrg }: { userId: string; defaultOrg: string }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pick, setPick] = useState<Point | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [timeErr, setTimeErr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    const ok = all.filter((x) => /^image\/(jpeg|png|webp)$/.test(x.type) && x.size <= MAX_PHOTO_BYTES).slice(0, MAX_PHOTOS);
    setError(all.length > MAX_PHOTOS ? t('toast.max5') : null);
    setFiles(ok);
    setPreviews(ok.map((x) => URL.createObjectURL(x)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setError(t('err.needSupabase'));
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? '').trim();
    const start = v('start');
    const end = v('end');
    if (!(end > start)) return setTimeErr(true);
    setTimeErr(false);
    if (!pick) return setError(t('toast.pickMap'));

    setBusy(true);
    setError(null);
    try {
      // 1. Unggah foto ke folder milik pengguna.
      const urls: string[] = [];
      if (files.length) setStatus(t('f.uploading'));
      for (const file of files) {
        const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw error;
        urls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      }
      setStatus(t('btn.saving'));

      // 2. Simpan kegiatan.
      const num = (k: string) => (v(k) ? Number(v(k)) : null);
      const { data, error } = await supabase
        .from('activities')
        .insert({
          title: v('title'),
          category: v('category'),
          org_name: v('org_name'),
          org_type: v('org_type'),
          description: v('description'),
          location_name: v('location_name'),
          lat: pick.lat,
          lng: pick.lng,
          date: v('date'),
          start_time: start,
          end_time: end,
          max_participants: num('max_participants'),
          target_benih: num('target_benih'),
          photos: urls,
        })
        .select('id')
        .single();
      if (error) throw error;
      router.push(`/kegiatan/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(t('err.generic', { msg: err instanceof Error ? err.message : String(err) }));
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <section className="card stack tight">
      <h1>{t('create.title')}</h1>
      <p className="muted">{t('create.intro')}</p>
      <form className="grid-form" onSubmit={onSubmit}>
        <label>
          {t('f.title')}
          <input name="title" required minLength={3} maxLength={140} />
        </label>
        <label>
          {t('f.cat')}
          <select name="category" defaultValue="reforest">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t('cat.' + c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('f.org')}
          <input name="org_name" required maxLength={140} defaultValue={defaultOrg} placeholder={t('f.orgPh')} />
        </label>
        <label>
          {t('f.type')}
          <select name="org_type" defaultValue="perorangan">
            {ORG_TYPES.map((k) => (
              <option key={k} value={k}>
                {t('org.' + k)}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          {t('f.desc')}
          <textarea name="description" rows={4} maxLength={4000} />
        </label>
        <label className="full">
          {t('f.photos')}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} />
        </label>
        {previews.length > 0 && (
          <div className="full photo-preview">
            {previews.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s} src={s} alt="" />
            ))}
          </div>
        )}
        <label>
          {t('f.loc')}
          <input name="location_name" required maxLength={200} />
        </label>
        <label>
          {t('f.target')}
          <input name="target_benih" type="number" min={1} />
        </label>
        <label>
          {t('f.date')}
          <input name="date" type="date" required min={isoDay(0)} defaultValue={isoDay(7)} />
        </label>
        <label>
          {t('f.max')}
          <input name="max_participants" type="number" min={1} />
        </label>
        <label>
          {t('f.start')}
          <input name="start" type="time" required defaultValue="08:00" aria-invalid={timeErr || undefined} />
        </label>
        <label>
          {t('f.end')}
          <input name="end" type="time" required defaultValue="11:00" aria-invalid={timeErr || undefined} />
        </label>
        {timeErr && (
          <p className="full alert error" role="alert">
            {t('f.timeErr')}
          </p>
        )}
        <div className="full">
          <ActivityMap center={center} picking pick={pick} onPick={setPick} zoom={12} />
        </div>
        <p className="full muted" style={{ margin: 0 }}>
          {pick ? t('f.picked', { lat: f.num(pick.lat, { maximumFractionDigits: 5 }), lng: f.num(pick.lng, { maximumFractionDigits: 5 }) }) : t('f.noPick')}
        </p>
        {error && (
          <p className="full alert error" role="alert">
            {error}
          </p>
        )}
        <div className="full row">
          <button className="btn" type="submit" disabled={busy}>
            {t('f.submit')}
          </button>
          {status && <span className="muted">{status}</span>}
        </div>
      </form>
    </section>
  );
}
