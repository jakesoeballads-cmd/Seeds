import type { Category } from './types';

const PALETTES: Record<Category, [string, string, string, string]> = {
  mangrove: ['#bfe0ef', '#7fb7c9', '#4f7a00', '#74ac00'],
  beach: ['#cfe8f5', '#f2dfb3', '#5aa0c8', '#e9c46a'],
  reforest: ['#e3efcf', '#a7c96b', '#4f7a00', '#2f5d1e'],
  edu: ['#fff1d6', '#f4b860', '#74ac00', '#c0662b'],
};

/** Ilustrasi pengganti foto: pemandangan SVG sederhana per kategori, stabil per seed. */
export function scene(kind: Category, seed = 0): string {
  const pal = PALETTES[kind] ?? PALETTES.reforest;
  const r = (n: number) => (Math.sin(seed * 9.1 + n * 3.7) + 1) / 2;
  let shapes = `<rect width="400" height="300" fill="${pal[0]}"/><rect y="${170 + r(1) * 30}" width="400" height="140" fill="${pal[1]}"/>`;
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 55 + r(i) * 20;
    const h = 60 + r(i + 4) * 70;
    const y = 210 - h;
    shapes += `<rect x="${x + 14}" y="${y + h * 0.6}" width="6" height="${h * 0.5}" fill="#5b4632"/><ellipse cx="${x + 17}" cy="${y + h * 0.45}" rx="${18 + r(i + 2) * 12}" ry="${h * 0.42}" fill="${i % 2 ? pal[2] : pal[3]}"/>`;
  }
  shapes += `<circle cx="${320 - r(9) * 60}" cy="${55 + r(8) * 20}" r="22" fill="#fff6c9" opacity=".9"/>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${shapes}</svg>`);
}

/** Seed angka dari id, agar ilustrasi tiap kegiatan konsisten. */
export function seedOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000;
  return h;
}

export function photosOf(a: { id: string; category: Category; photos: string[] }): string[] {
  if (a.photos.length) return a.photos;
  const s = seedOf(a.id);
  return [scene(a.category, s), scene(a.category, s + 7), scene(a.category, s + 13)];
}
