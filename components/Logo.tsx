/**
 * Logo Benih: tunas di atas tanah dengan tulisan "benih" (file PNG/WebP di public/).
 * WebP dipakai bila browser mendukung, PNG sebagai cadangan.
 */
export function Logo({ height = 52 }: { height?: number }) {
  return (
    <picture>
      <source srcSet="/logo-128.webp 1x, /logo-256.webp 2x" type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src="/logo-128.png" srcSet="/logo-256.png 2x" alt="" height={height} width={Math.round((height * 107) / 128)} />
    </picture>
  );
}
