'use client';

import { useEffect, useRef, useState } from 'react';
import { AVATAR_SIDE, compressPhoto } from '@/lib/compress';
import { useI18n } from './I18nProvider';

/** Ukuran bingkai potong di layar (px). */
const FRAME = 280;
const MAX_ZOOM = 4;

type Size = { w: number; h: number };

/**
 * Jendela potong foto profil: geser foto dan atur zoom agar pas di bingkai bulat.
 * Hasilnya dipotong dan dikompres jadi 512 × 512 px sebelum diunggah.
 */
export function AvatarCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const { t } = useI18n();
  const [url] = useState(() => URL.createObjectURL(file));
  const [size, setSize] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // Skala tampilan: zoom 1 = sisi terpendek foto pas memenuhi bingkai.
  const scale = size ? (FRAME / Math.min(size.w, size.h)) * zoom : 1;

  /** Jaga agar foto selalu menutupi bingkai. */
  function clamp(p: { x: number; y: number }, s = scale) {
    if (!size) return p;
    return {
      x: Math.min(0, Math.max(FRAME - size.w * s, p.x)),
      y: Math.min(0, Math.max(FRAME - size.h * s, p.y)),
    };
  }

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const s = { w: img.naturalWidth, h: img.naturalHeight };
    const k = FRAME / Math.min(s.w, s.h);
    setSize(s);
    setPos({ x: (FRAME - s.w * k) / 2, y: (FRAME - s.h * k) / 2 });
  }

  function changeZoom(z: number) {
    // Zoom ke arah tengah bingkai.
    const k = (FRAME / Math.min(size!.w, size!.h)) * z;
    const cx = (FRAME / 2 - pos.x) / scale;
    const cy = (FRAME / 2 - pos.y) / scale;
    setZoom(z);
    setPos(clamp({ x: FRAME / 2 - cx * k, y: FRAME / 2 - cy * k }, k));
  }

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setPos((p) => clamp({ x: p.x + d[0], y: p.y + d[1] }));
  }

  async function save() {
    if (!size) return;
    setBusy(true);
    setError(null);
    try {
      const crop = { x: -pos.x / scale, y: -pos.y / scale, size: FRAME / scale };
      onDone(await compressPhoto(file, { square: AVATAR_SIDE, crop }));
    } catch (err) {
      setError(t((err as Error).message === 'photo-too-large' ? 'toast.photoTooBig' : 'toast.photoUnreadable'));
      setBusy(false);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('crop.title')}>
      <div className="card stack tight cropper">
        <h2>{t('crop.title')}</h2>
        <p className="muted">{t('crop.help')}</p>
        <div
          className="crop-frame"
          style={{ width: FRAME, height: FRAME }}
          tabIndex={0}
          aria-label={t('crop.help')}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, ...pos };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setPos(clamp({ x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => size && changeZoom(Math.min(MAX_ZOOM, Math.max(1, zoom - e.deltaY / 500)))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={onLoad}
            onError={() => setError(t('toast.photoUnreadable'))}
            style={size ? { width: size.w * scale, height: size.h * scale, transform: `translate(${pos.x}px, ${pos.y}px)` } : { opacity: 0 }}
          />
          <span className="crop-ring" aria-hidden="true" />
        </div>
        <label className="crop-zoom">
          {t('crop.zoom')}
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!size} onChange={(e) => changeZoom(Number(e.target.value))} />
        </label>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button className="btn" type="button" onClick={save} disabled={!size || busy}>
            {busy ? t('btn.saving') : t('crop.use')}
          </button>
          <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
            {t('crop.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
