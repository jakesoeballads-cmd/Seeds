import type { LegalDoc } from '@/lib/legal';

/** Halaman Kebijakan Privasi / Syarat Penggunaan. Paragraf berawalan "• " menjadi butir daftar. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <article className="card narrow stack tight legal" style={{ maxWidth: 760 }}>
      <h1>{doc.title}</h1>
      <p className="muted">{doc.lead}</p>
      {doc.sections.map((s) => {
        const items = s.p.filter((x) => x.startsWith('• '));
        const before = s.p.filter((x, i) => !x.startsWith('• ') && i < s.p.findIndex((y) => y.startsWith('• ')));
        const rest = items.length ? s.p.filter((x, i) => !x.startsWith('• ') && i > s.p.findIndex((y) => y.startsWith('• '))) : s.p;
        return (
          <section key={s.h} className="stack tight">
            <h2>{s.h}</h2>
            {before.map((x) => <p key={x}>{x}</p>)}
            {items.length > 0 && (
              <ul>
                {items.map((x) => <li key={x}>{x.slice(2)}</li>)}
              </ul>
            )}
            {rest.map((x) => <p key={x}>{x}</p>)}
          </section>
        );
      })}
    </article>
  );
}
