'use client';

import { SectionEyebrow } from '../shared/SectionEyebrow';

interface Tile {
  title: string;
  sub: string;
  tools: string[];
  preview: 'foto-ia' | 'photo-editor' | 'face-swap' | 'stealer' | 'upscale' | 'clips';
}

const tiles: Tile[] = [
  {
    title: 'Foto IA',
    sub: 'Foto de producto sin set, sin shooting. Brief → render coherente con tu marca.',
    tools: ['Flux', 'Recraft', 'Nano Banana'],
    preview: 'foto-ia',
  },
  {
    title: 'Photo Editor',
    sub: 'Inpaint, outpaint, retoque y color. Tu Photoshop con cabeza.',
    tools: ['Inpaint', 'Outpaint', 'Color'],
    preview: 'photo-editor',
  },
  {
    title: 'Face Swap',
    sub: 'Cambiá modelos en campañas existentes. Cero re-shooting, lipsync exacto.',
    tools: ['Veo', 'Sora', 'Lip sync'],
    preview: 'face-swap',
  },
  {
    title: 'Stealer',
    sub: 'Pegás un anuncio competidor — extrae producto, copy y estructura para inspirarte.',
    tools: ['Vision', 'Crop', 'Extract'],
    preview: 'stealer',
  },
  {
    title: 'Mejorar calidad',
    sub: 'Upscale × 4. Recuperás detalles que el original no tenía.',
    tools: ['Upscaler', '4×', 'Detail'],
    preview: 'upscale',
  },
  {
    title: 'Clips',
    sub: 'Cortá videos largos en Reels, Shorts y TikToks con subtítulos automáticos.',
    tools: ['Auto-subs', 'Multi-format', 'Hooks'],
    preview: 'clips',
  },
];

export function StudioGallery() {
  return (
    <section
      id="estudio"
      className="lv3-bg-cream2 relative border-y border-black/5"
    >
      <div className="mx-auto max-w-[1480px] px-5 py-24 md:px-9 md:py-32">
        <SectionEyebrow index="06" label="El resto del estudio" />
        <h2 className="editorial-h2 mt-5 max-w-[860px]">
          Seis herramientas más, para los detalles que definen el resultado.
        </h2>
        <p className="mt-6 max-w-[560px] text-[14px] leading-relaxed text-black/65 md:text-[15px]">
          Lo que ningún otro software te da en una sola mesa de trabajo. Hover para ver
          cada uno en acción.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <GalleryTile key={t.title} tile={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function GalleryTile({ tile }: { tile: Tile }) {
  return (
    <div className="lv3-frame group flex flex-col bg-white p-5 transition hover:scale-[1.01]">
      <Preview kind={tile.preview} />
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-[20px] font-semibold tracking-tight text-black">
          {tile.title}
        </h3>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-black/5 text-[13px] text-black/50 transition group-hover:bg-[#f7ff9e] group-hover:text-black">
          →
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-black/60 md:text-[14px]">
        {tile.sub}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {tile.tools.map((tool) => (
          <span key={tool} className="lv3-pill text-[10px]">
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}

function Preview({ kind }: { kind: Tile['preview'] }) {
  switch (kind) {
    case 'foto-ia':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-gradient-to-br from-[#f5f3ec] via-[#e8e3d2] to-[#fafaf7]">
          <div className="absolute inset-x-1/4 inset-y-[18%] rounded-md bg-gradient-to-br from-[#e26a4a] via-[#d8a380] to-[#0a0a0a]/30 ring-1 ring-black/10" />
          <div className="absolute bottom-2 left-2 flex gap-1.5">
            {['#f5f3ec', '#e8e3d2', '#0a0a0a'].map((c) => (
              <span
                key={c}
                className="h-3 w-3 rounded-sm ring-1 ring-black/10"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      );
    case 'photo-editor':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#15151b]">
          {/* simulated tool rail */}
          <div className="absolute inset-y-2 left-2 flex w-9 flex-col gap-1.5 rounded-md bg-white/5 p-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="h-6 w-6 rounded bg-white/10 transition group-hover:bg-[#f7ff9e]"
              />
            ))}
          </div>
          <div className="absolute inset-y-3 left-14 right-3 rounded-md bg-gradient-to-br from-white/15 to-white/5" />
          <span className="absolute right-3 top-3 rounded bg-[#f7ff9e] px-1.5 py-0.5 text-[10px] font-bold text-black">
            INPAINT
          </span>
        </div>
      );
    case 'face-swap':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-gradient-to-r from-[#0a0a0a] via-[#2a2a36] to-[#0a0a0a]">
          <div className="absolute inset-y-3 left-3 right-1/2 rounded-md bg-[radial-gradient(50%_50%_at_50%_45%,#e2b58f,#2a2a32_60%,#0a0a0a)]" />
          <div className="absolute inset-y-3 right-3 left-1/2 rounded-md bg-[radial-gradient(50%_50%_at_50%_45%,#f0c9a4,#3a3a48_60%,#0a0a0a)]" />
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#f7ff9e]" />
        </div>
      );
    case 'stealer':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-gradient-to-br from-[#fafaf7] to-[#e8e3d2]">
          <div className="absolute inset-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-gradient-to-br from-[#1877F2]/30 to-[#0a0a0a]/10 ring-1 ring-black/10" />
            <div className="rounded-md bg-gradient-to-br from-[#14e0cc]/40 to-[#0a0a0a]/10 ring-1 ring-black/10" />
          </div>
          <span className="absolute right-3 top-3 rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-[#f7ff9e]">
            STEAL
          </span>
        </div>
      );
    case 'upscale':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#15151b]">
          <div
            className="absolute inset-3 rounded-md"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 4px, rgba(255,255,255,0.12) 4px 8px)',
            }}
          />
          <div className="absolute inset-y-3 right-3 left-1/2 rounded-md bg-gradient-to-br from-[#14e0cc]/40 via-[#fafaf7]/70 to-[#0a0a0a]/30" />
          <span className="absolute bottom-2 left-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
            4×
          </span>
        </div>
      );
    case 'clips':
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#0a0a0a]">
          <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-[#f7ff9e]" />
          </div>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 rounded bg-white/10"
                style={{ height: 12 + i * 2, opacity: i === 1 ? 1 : 0.5 }}
              />
            ))}
          </div>
          <span className="absolute bottom-2 right-3 rounded bg-[#f7ff9e] px-1.5 py-0.5 text-[10px] font-bold text-black">
            00:09
          </span>
        </div>
      );
  }
}
