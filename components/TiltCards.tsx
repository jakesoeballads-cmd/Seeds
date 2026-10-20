'use client';

import { useEffect } from 'react';

// Kartu yang ikut miring: fitur beranda, kartu kegiatan, dan kotak angka di dasbor/profil.
const TILT = '.feature, .program-list li, .stat';
const MAX = 6;

function setTilt(el: HTMLElement, px: number, py: number) {
  el.style.setProperty('--ry', `${((px - 0.5) * MAX * 2).toFixed(2)}deg`);
  el.style.setProperty('--rx', `${((0.5 - py) * MAX * 2).toFixed(2)}deg`);
  el.style.setProperty('--gx', `${Math.round(px * 100)}%`);
  el.style.setProperty('--gy', `${Math.round(py * 100)}%`);
}

function clearTilt(el: HTMLElement) {
  el.classList.remove('lift');
  el.style.removeProperty('--rx');
  el.style.removeProperty('--ry');
}

/**
 * Efek 3D kartu: dengan mouse, kartu miring mengikuti kursor dan diberi kilau cahaya.
 * Di HP yang mengizinkan sensor tanpa bertanya (Android), kartu yang terlihat ikut miring
 * mengikuti kemiringan HP. Mati bila pengguna memilih kurangi gerakan.
 */
export function TiltCards() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let current: HTMLElement | null = null;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(TILT) ?? null;
      if (current && current !== el) clearTilt(current);
      current = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.classList.add('lift');
      setTilt(el, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    const leave = () => { if (current) clearTilt(current); current = null; };

    let frame = 0;
    const orient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null || frame) return;
      const gamma = e.gamma, beta = e.beta;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const px = Math.max(0, Math.min(1, 0.5 + gamma / 50));
        const py = Math.max(0, Math.min(1, 0.5 + (beta - 40) / 50));
        document.querySelectorAll<HTMLElement>(TILT).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom > 0 && r.top < window.innerHeight) setTilt(el, px, py);
        });
      });
    };
    // iOS meminta izin sensor; di sana efek miring HP dilewati supaya tidak muncul pertanyaan izin.
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined;
    const gyro = !!D && typeof D.requestPermission !== 'function' && matchMedia('(pointer: coarse)').matches;

    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    if (gyro) window.addEventListener('deviceorientation', orient);
    return () => {
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('deviceorientation', orient);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
