/** Ikon Material Design (MDI). Kirim path dari `@mdi/js`, hanya ikon yang dipakai yang ikut dimuat. */
export function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className ? `ico ${className}` : 'ico'} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
