'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from './I18nProvider';

/** Galeri foto kegiatan dengan tampilan layar penuh (panah, geser, Esc). */
export function Gallery({ photos }: { photos: string[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const startX = useRef<number | null>(null);
  const n = photos.length;
  const alt = (i: number) => (n > 1 ? t('photo.n', { n: i + 1 }) : t('photo.one'));

  const show = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);
  const close = useCallback(() => {
    setIndex(null);
    opener.current?.focus();
  }, []);

  function open(i: number, e: React.MouseEvent<HTMLButtonElement>) {
    opener.current = e.currentTarget;
    setIndex(i);
  }

  const isOpen = index !== null;

  // Kelas di body menyembunyikan menu bawah dan mengunci gulir halaman.
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('lightbox-open');
    closeBtn.current?.focus();
    return () => document.body.classList.remove('lightbox-open');
  }, [isOpen]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (index === null) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'Tab') {
      // Fokus tetap di dalam dialog.
      const focusable = Array.from(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const pos = focusable.indexOf(document.activeElement as HTMLButtonElement);
      if (e.shiftKey && pos <= 0) {
        e.preventDefault();
        focusable[focusable.length - 1]?.focus();
      } else if (!e.shiftKey && pos === focusable.length - 1) {
        e.preventDefault();
        focusable[0]?.focus();
      }
    }
  }

  const thumb = (i: number, extra?: number) => (
    <button type="button" className="gallery-item" onClick={(e) => open(i, e)} aria-label={t('lb.open', { n: i + 1, total: n })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i]} alt={alt(i)} loading={i ? 'lazy' : undefined} />
      {extra ? (
        <span className="gallery-more" aria-hidden="true">
          +{extra}
        </span>
      ) : null}
    </button>
  );

  // Tampil maks. 3 foto; sisanya lewat tanda "+n" di foto terakhir.
  const extra = n - 3;
  return (
    <>
      {n > 1 ? (
        <div className="gallery">
          {thumb(0)}
          <div className="side">
            {thumb(1)}
            {n > 2 && thumb(2, extra > 0 ? extra : undefined)}
          </div>
        </div>
      ) : (
        <div className="gallery single">{thumb(0)}</div>
      )}
      {isOpen && (
        <div
          ref={box}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-label={t('lb.caption', { n: index + 1, total: n })}
          onKeyDown={onKeyDown}
          onClick={(e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (e.target === e.currentTarget || tag === 'FIGURE') close();
          }}
          onTouchStart={(e) => {
            startX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (startX.current === null) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            if (Math.abs(dx) > 50 && n > 1) show(index + (dx < 0 ? 1 : -1));
            startX.current = null;
          }}
        >
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[index]} alt={alt(index)} />
            <figcaption aria-live="polite">{t('lb.caption', { n: index + 1, total: n })}</figcaption>
          </figure>
          <button ref={closeBtn} type="button" className="lb-close" aria-label={t('lb.close')} onClick={close}>
            ×
          </button>
          {n > 1 && (
            <>
              <button type="button" className="lb-prev" aria-label={t('lb.prev')} onClick={() => show(index - 1)}>
                ‹
              </button>
              <button type="button" className="lb-next" aria-label={t('lb.next')} onClick={() => show(index + 1)}>
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
