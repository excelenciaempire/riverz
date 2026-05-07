const row = [
  'Sora',
  'Veo 3',
  'Nano Banana Pro',
  'Flux',
  'Kling',
  'Recraft',
  'ElevenLabs',
  'GPT-4o',
  'Gemini',
  'Hailuo',
  'Luma',
  'Stable Diffusion',
];

export function ModelsMarquee() {
  // Duplicate the row so the loop is seamless.
  const repeated = [...row, ...row];

  return (
    <section className="lv3-bg-ink relative overflow-hidden border-y border-white/10 py-10 md:py-14">
      <div className="mx-auto mb-6 max-w-[1480px] px-5 md:px-9">
        <p className="editorial-eyebrow text-white/40">Modelos integrados</p>
      </div>

      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
          style={{
            background: 'linear-gradient(to right, #0a0a0a, transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
          style={{
            background: 'linear-gradient(to left, #0a0a0a, transparent)',
          }}
        />

        <div className="flex w-max gap-12 whitespace-nowrap will-change-transform [animation:lv3-marquee_36s_linear_infinite] md:gap-16">
          {repeated.map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="text-[clamp(28px,4vw,52px)] font-light tracking-tight text-white/45"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes lv3-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lv3-bg-ink [class*="lv3-marquee"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
