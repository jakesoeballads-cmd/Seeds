'use client';

import { useEffect, useRef, useState } from 'react';
import type { SeedScene } from '@/lib/seed3d';

/**
 * Benih 3D di hero beranda. three.js baru dimuat setelah hero terlihat dan halaman
 * senggang, jadi beranda tetap cepat. Tanpa WebGL, bagian ini tidak tampil.
 */
export function SeedHero({ labels, label }: { labels: string[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const scene = useRef<SeedScene | null>(null);
  const auto = useRef(true);
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    let cancelled = false;
    const start = async () => {
      const mod = await import('@/lib/seed3d');
      if (cancelled) return;
      if (!mod.hasWebGL()) return setReady(false);
      try {
        scene.current = mod.mountSeed(node, 0, () => { auto.current = false; });
        setReady(true);
      } catch {
        setReady(false);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (idle) idle(() => void start()); else setTimeout(() => void start(), 200);
    });
    io.observe(node);
    return () => { cancelled = true; io.disconnect(); scene.current?.destroy(); scene.current = null; };
  }, []);

  // Putar otomatis dari benih sampai hutan, berhenti begitu pengunjung memilih sendiri.
  useEffect(() => {
    if (!ready || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (!auto.current) return clearInterval(id);
      setStage((s) => (s + 1) % labels.length);
    }, 3800);
    return () => clearInterval(id);
  }, [ready, labels.length]);

  useEffect(() => { scene.current?.setStage(stage); }, [stage]);

  if (ready === false) return null;
  return (
    <div className="seed-hero">
      <div ref={box} className="seed-hero-canvas" aria-hidden="true" />
      <div className="seed-hero-stages" role="group" aria-label={label} hidden={!ready}>
        {labels.map((l, i) => (
          <button key={l} type="button" aria-pressed={stage === i} onClick={() => { auto.current = false; setStage(i); }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
