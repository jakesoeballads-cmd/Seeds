'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AVATAR_SIDE, compressPhoto } from '@/lib/compress';
import { AVATAR_BUCKET, MAX_PHOTO_INPUT_BYTES, MEMBER_TYPES } from '@/lib/constants';
import { getBrowserClient } from '@/lib/supabase/client';
import { Avatar } from './Avatar';
import { useI18n } from './I18nProvider';

type Values = { full_name: string; member_type: string; avatar_url: string | null; bio: string; city: string; is_private: boolean };

/** Path file di bucket avatars dari URL publiknya. */
const avatarPath = (url: string) => decodeURIComponent(url.split(`/object/public/${AVATAR_BUCKET}/`)[1] ?? '');

/** Ubah foto profil, nama, jenis member, bio, kota, dan kunci profil. */
export function ProfileForm({ userId, initial }: { userId: string; initial: Values }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** Ganti (file) atau hapus (null) foto profil. Foto langsung tersimpan; file lama dihapus dari Storage. */
  async function setPhoto(file: File | null) {
    const supabase = getBrowserClient();
    if (!supabase) return setPhotoMsg({ ok: false, text: t('err.needSupabase') });
    if (file && (!file.type.startsWith('image/') || file.size > MAX_PHOTO_INPUT_BYTES)) return setPhotoMsg({ ok: false, text: t('toast.photoTooBig') });
    setPhotoBusy(true);
    setPhotoMsg(file ? { ok: true, text: t('f.compressing') } : null);
    try {
      let url: string | null = null;
      if (file) {
        // Dipotong persegi dan diperkecil di browser agar ringan (±20–60 KB).
        const blob = await compressPhoto(file, { square: AVATAR_SIDE }).catch((err: Error) => {
          throw new Error(t(err.message === 'photo-too-large' ? 'toast.photoTooBig' : 'toast.photoUnreadable'));
        });
        const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
        if (up.error) throw up.error;
        url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (error) throw error;
      const old = avatar && avatarPath(avatar);
      if (old) await supabase.storage.from(AVATAR_BUCKET).remove([old]);
      setAvatar(url);
      setPhotoMsg({ ok: true, text: url ? t('profile.photoSaved') : t('profile.photoRemoved') });
      router.refresh();
    } catch (err) {
      setPhotoMsg({ ok: false, text: t('err.generic', { msg: err instanceof Error ? err.message : String(err) }) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: t('err.needSupabase') });
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? '').trim();
    const fullName = v('full_name');
    if (fullName.length < 2) return setMsg({ ok: false, text: t('profile.nameMin') });
    setBusy(true);
    setMsg(null);
    const [a, b] = await Promise.all([
      supabase.from('profiles').update({ full_name: fullName, member_type: v('member_type') }).eq('id', userId),
      supabase.from('profile_details').upsert({
        user_id: userId,
        bio: v('bio') || null,
        city: v('city') || null,
        is_private: fd.get('is_private') === 'on',
        updated_at: new Date().toISOString(),
      }),
    ]);
    setBusy(false);
    const error = a.error ?? b.error;
    setMsg(error ? { ok: false, text: t('err.generic', { msg: error.message }) } : { ok: true, text: t('profile.saved') });
    if (!error) router.refresh();
  }

  return (
    <section className="card narrow stack tight">
      <h1>{t('profile.title')}</h1>
      <div className="avatar-edit">
        <Avatar name={initial.full_name} src={avatar} large />
        <div className="stack tight">
          <strong>{t('profile.photo')}</strong>
          <div className="row">
            <label className={`btn small${photoBusy ? ' disabled' : ''}`}>
              {avatar ? t('profile.photoChange') : t('profile.photoAdd')}
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                disabled={photoBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) setPhoto(file);
                }}
              />
            </label>
            {avatar && (
              <button type="button" className="btn small ghost" disabled={photoBusy} onClick={() => setPhoto(null)}>
                {t('profile.photoRemove')}
              </button>
            )}
          </div>
          {photoMsg && (
            <p className={`alert ${photoMsg.ok ? 'success' : 'error'}`} role="status">
              {photoMsg.text}
            </p>
          )}
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          {t('profile.name')}
          <input name="full_name" required minLength={2} maxLength={80} defaultValue={initial.full_name} />
        </label>
        <MemberTypeSelect defaultValue={initial.member_type} />
        <label>
          {t('profile.city')}
          <input name="city" maxLength={80} defaultValue={initial.city} placeholder={t('profile.cityPh')} />
        </label>
        <label>
          {t('profile.bio')}
          <textarea name="bio" rows={4} maxLength={500} defaultValue={initial.bio} placeholder={t('profile.bioPh')} />
        </label>
        <label className="check">
          <input type="checkbox" name="is_private" defaultChecked={initial.is_private} />
          <span>
            <strong>{t('profile.lock')}</strong>
            <br />
            <span className="muted">{t('profile.lockHelp')}</span>
          </span>
        </label>
        {msg && (
          <p className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
            {msg.text}
          </p>
        )}
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? t('btn.saving') : t('btn.save')}
          </button>
          <Link className="btn ghost" href={`/member/${userId}`}>
            {t('profile.viewPublic')}
          </Link>
        </div>
      </form>
    </section>
  );
}

/** Pilihan jenis member (wajib), dipakai di form daftar dan profil. */
export function MemberTypeSelect({ defaultValue = '' }: { defaultValue?: string }) {
  const { t } = useI18n();
  return (
    <label>
      {t('mt.label')}
      <select name="member_type" required defaultValue={defaultValue}>
        <option value="" disabled>
          {t('mt.choose')}
        </option>
        {MEMBER_TYPES.map((k) => (
          <option key={k} value={k}>
            {t('mt.' + k)}
          </option>
        ))}
      </select>
    </label>
  );
}
