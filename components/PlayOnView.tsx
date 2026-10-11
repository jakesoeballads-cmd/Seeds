'use client';

import { useEffect, useRef, useState } from 'react';

/** Menambah kelas "play" selama elemen terlihat di layar, untuk animasi ikon fitur. */
export function PlayOnView({ className, children }: { className: string; children: React.ReactNode }) {
  const el = useRef<HTMLElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) return setPlay(true);
    const io = new IntersectionObserver(([e]) => setPlay(e.isIntersecting), { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={el} className={`${className}${play ? ' play' : ''}`}>
      {children}
    </section>
  );
}
