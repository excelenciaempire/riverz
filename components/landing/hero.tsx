import Link from 'next/link';

const flowCards = [
  { tag: 'BRIEF', title: 'Lanzá colección', sub: 'Producto + ángulos' },
  { tag: 'IMAGEN', title: 'Static Ad', sub: 'Nano Banana Pro' },
  { tag: 'TEXTO', title: 'Hooks · Headlines', sub: 'Variaciones A/B' },
  { tag: 'VIDEO', title: 'UGC · Avatar', sub: 'Sora · Veo · Kling' },
  { tag: 'EXPORT', title: 'Meta · TikTok', sub: 'Multiformato' },
];

export function Hero() {
  return (
    <section className="lv2-page relative overflow-hidden border-b border-black/5">
      <div className="mx-auto max-w-[1480px] px-5 pt-12 pb-12 md:px-9 md:pt-16 md:pb-20">
        {/* Massive split heading — same rhythm as Weave's "Figma Weave / Artistic Intelligence" */}
        <div className="grid items-end gap-2 md:grid-cols-2 md:gap-12">
          <h1 className="editorial-h1 lv2-rv">Riverz</h1>
          <h1 className="editorial-h1 lv2-rv text-black/85" data-rv-delay="60">
            Estudio Creativo IA
          </h1>
        </div>

        <p className="lv2-rv mt-8 max-w-[640px] text-[15px] leading-relaxed text-black/65 md:text-[16px]">
          Producí <strong className="text-black">UGC, anuncios estáticos, foto de producto y video</strong> con la
          consistencia de un estudio premium. Acceso a todos los modelos y a las herramientas pro
          que un creativo necesita — en una sola plataforma node-based.
        </p>

        {/* Flow cards — equivalent of Weave's hero node graph */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:mt-16 md:grid-cols-5 md:gap-4">
          {flowCards.map((c, i) => (
            <FlowCard key={c.tag} card={c} index={i} />
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="lv2-yellow editorial-eyebrow inline-flex items-center gap-2 rounded-md px-5 py-3 text-[12px] font-bold"
          >
            Únete a la lista de espera →
          </Link>
          <a
            href="#flujos"
            className="editorial-eyebrow inline-flex items-center gap-2 rounded-md border border-black/15 px-5 py-3 text-black/70 transition hover:border-black/30 hover:text-black"
          >
            Ver flujos
          </a>
        </div>
      </div>
    </section>
  );
}

function FlowCard({
  card,
  index,
}: {
  card: { tag: string; title: string; sub: string };
  index: number;
}) {
  return (
    <div
      className="lv2-rv group relative aspect-[3/4] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 md:aspect-[4/5]"
      data-rv-delay={String(60 * index)}
    >
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <span className="editorial-eyebrow text-black/45">{card.tag}</span>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-3 top-9 bottom-[68px] rounded-md bg-gradient-to-br from-black/10 via-black/[0.04] to-transparent"
      >
        <span className="absolute inset-0 grid place-items-center text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
          {card.tag}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
        <div className="text-[14px] font-semibold tracking-tight text-black">{card.title}</div>
        <div className="text-[11px] text-black/50">{card.sub}</div>
      </div>
    </div>
  );
}
