/** Lingkaran inisial nama member. */
export function Avatar({ name, large }: { name: string | null | undefined; large?: boolean }) {
  const initials =
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <span className={`avatar${large ? ' large' : ''}`} aria-hidden="true">
      {initials}
    </span>
  );
}
