import Link from 'next/link';

type Workflow = {
  title: string;
  sub: string;
  tools: string[];
};

const workflows: Workflow[] = [
  {
    title: 'Static Ads',
    sub: 'Anuncios estáticos para Meta y TikTok. Un brief, decenas de variantes A/B.',
    tools: ['Nano Banana Pro', 'Brand voice', 'Multiformato'],
  },
  {
    title: 'UGC con Avatar',
    sub: 'Avatares hiperrealistas presentando tu producto en cualquier idioma.',
    tools: ['Sora', 'Veo 3', 'ElevenLabs'],
  },
  {
    title: 'Foto IA',
    sub: 'Generá foto de producto consistente sin set, sin shooting.',
    tools: ['Flux', 'Recraft', 'Stealer'],
  },
  {
    title: 'Photo Editor',
    sub: 'Editá fotos de producto: fondos, retoque, color, escala. Como Photoshop con IA.',
    tools: ['Inpaint', 'Outpaint', 'Upscale'],
  },
  {
    title: 'Face Swap',
    sub: 'Cambiá modelos en tus campañas existentes con cero re-shooting.',
    tools: ['Veo · Sora', 'Lip sync', 'Multiformato'],
  },
  {
    title: 'Landing Lab',
    sub: 'Construí product pages y advertorials que se publican directo en Shopify.',
    tools: ['Templates', 'Editor visual', 'Shopify Sync'],
  },
];

/**
 * "Explore Our Workflows" — horizontal-scroll carousel of agent cards.
 * Mirrors Weave's bottom carousel exactly: each card is a workflow with
 * a node-graph thumbnail and a yellow "Probar" pill.
 */
export function UseCases() {
  return (
    <section id="contenido" className="lv2-section-dark relative overflow-hidden">
      <div className="mx-auto max-w-[1480px] px-5 py-24 md:px-9 md:py-36">
        <p className="editorial-eyebrow lv2-rv text-white/45">05 · Flujos</p>
        <h2 className="editorial-h2 lv2-rv mt-5 max-w-[760px]">
          Explorá los
          <br />
          flujos
        </h2>
        <p className="lv2-rv mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/55">
          De foto de producto a video publicitario, Riverz orquesta cada agente. Probá cualquiera
          y mirá cómo se conectan entre sí.
        </p>

        <div className="lv2-rv mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-3">
          {workflows.map((w, i) => (
            <WorkflowCard key={w.title} workflow={w} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowCard({ workflow, index }: { workflow: Workflow; index: number }) {
  return (
    <div
      className="lv2-rv group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#15151b] p-5 transition hover:border-white/25"
      data-rv-delay={String(60 * index)}
    >
      {/* Node-graph thumbnail */}
      <div className="mb-4 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#1f1f29] via-[#0a0a0a] to-[#1f1f29] ring-1 ring-white/5">
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="h-12 w-16 rounded bg-white/[0.07] ring-1 ring-white/10"
              style={{ transform: `translateY(${(j - 1) * 6}px)` }}
            />
          ))}
        </div>
      </div>
      <div className="font-editorial text-[20px] font-semibold tracking-tight text-white">
        {workflow.title}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">{workflow.sub}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {workflow.tools.map((t) => (
          <span
            key={t}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-5 pt-4">
        <Link
          href="/sign-up"
          className="lv2-yellow editorial-eyebrow inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[11px] font-bold"
        >
          Probar →
        </Link>
      </div>
    </div>
  );
}
