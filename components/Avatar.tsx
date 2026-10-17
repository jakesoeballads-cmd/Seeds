/** Foto profil member, atau lingkaran inisial nama bila belum ada foto. */
export function Avatar({ name, src, large }: { name: string | null | undefined; src?: string | null; large?: boolean }) {
  const cls = `avatar${large ? ' large' : ''}`;
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className={cls} src={src} alt="" loading="lazy" />;
  const initials =
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <span className={cls} aria-hidden="true">
      {initials}
    </span>
  );
}
