/** Logo Benih: benih bertunas dengan dua daun. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 30" width={size} height={(size * 30) / 26} aria-hidden="true">
      <path d="M13 28V14" stroke="#74ac00" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M13 16C13 9 8 5 2 5c0 7 4 11 11 11Z" fill="#74ac00" />
      <path d="M13 13c0-6 4-10 11-10 0 6-4 10-11 10Z" fill="#4f7a00" />
    </svg>
  );
}
