'use client';

import { useEffect, useRef } from 'react';
import type { GlobeScene } from '@/lib/globe3d';

/**
 * Hero beranda dengan globe Bumi 3D sebagai latar. three.js dan citra satelit baru dimuat
 * setelah hero terlihat dan halaman senggang, jadi teks dan tombol tampil lebih dulu.
 * Tanpa WebGL, hero tetap tampil dengan latar zaitun biasa. Saat digulir, globe bergerak lebih
 * lambat dari teks (paralaks) lewat variabel CSS --par.
 */
export function GlobeHero({ children }: { children: React.ReactNode }) {
  const hero = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = hero.current, node = box.current;
    if (!area || !node) return;
    let scene: GlobeScene | null = null;
    let cancelled = false;
    const start = async () => {
      const mod = await import('@/lib/globe3d');
      if (cancelled || !mod.hasWebGL()) return;
      try { scene = mod.mountGlobe(node, area); } catch { /* latar zaitun tetap tampil */ }
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (idle) idle(() => void start()); else setTimeout(() => void start(), 200);
    });
    io.observe(area);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        area.style.setProperty('--par', `${Math.min(window.scrollY, area.offsetHeight) * 0.35}px`);
      });
    };
    if (!still) window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelled = true; io.disconnect(); scene?.destroy();
      window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={hero} className="hero-photo globe-hero full-bleed">
      <div ref={box} className="globe-bg" aria-hidden="true" />
      {children}
    </section>
  );
}
