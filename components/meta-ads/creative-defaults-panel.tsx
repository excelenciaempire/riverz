'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MetaAiFeatures } from '@/types/meta';

/**
 * Panel "Creative Setup" — equivalente al de Meta Ads Manager. Por defecto
 * todo arranca apagado para que los anuncios suban tal cual los hizo el
 * usuario, sin "mejoras automáticas" de Meta. El usuario puede activar lo
 * que quiera; estos toggles se aplican a TODOS los anuncios al lanzar
 * (cada fila puede sobre-escribir desde la celda IA features).
 */

interface Section {
  title: string;
  description?: string;
  toggles: Array<{ key: keyof MetaAiFeatures; label: string }>;
}

const SECTIONS: Section[] = [
  {
    title: 'Multi-Advertiser Ads',
    description: 'Permite a Meta mostrar tu anuncio junto a otros anunciantes en feeds personalizados.',
    toggles: [{ key: 'multi_advertiser_ads', label: 'Multi-Advertiser Ads' }],
  },
  {
    title: 'Imágenes',
    toggles: [
      { key: 'image_overlays', label: 'Añadir overlays' },
      { key: 'image_touchups', label: 'Retoques visuales' },
      { key: 'image_animation', label: 'Animación 3D' },
      { key: 'standard_enhancements', label: 'Ajustar brillo y contraste' },
      { key: 'music', label: 'Música' },
      { key: 'site_extensions', label: 'Añadir detalles al layout' },
      { key: 'store_locations', label: 'Ubicaciones de tienda' },
      { key: 'flex_media', label: 'Flex media' },
    ],
  },
  {
    title: 'Videos',
    toggles: [
      { key: 'video_touch_ups', label: 'Retoques visuales' },
      { key: 'video_filters', label: 'Filtros de video' },
      { key: 'video_auto_crop', label: 'Auto-crop de video' },
    ],
  },
  {
    title: 'Texto y experiencia',
    toggles: [
      { key: 'text_improvements', label: 'Mejoras de texto' },
      { key: 'description_visibility', label: 'Mostrar descripciones' },
      { key: 'relevant_comments', label: 'Comentarios relevantes' },
      { key: 'cta_optimization', label: 'Optimizar CTA' },
      { key: 'translate_text', label: 'Traducir texto' },
      { key: 'optimize_destination', label: 'Optimizar destino del sitio' },
    ],
  },
];

const ALL_KEYS: Array<keyof MetaAiFeatures> = SECTIONS.flatMap((s) =>
  s.toggles.map((t) => t.key),
);

interface Props {
  value: MetaAiFeatures;
  onChange: (next: MetaAiFeatures) => void;
}

export function CreativeDefaultsPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const enabledCount = ALL_KEYS.filter((k) => !!value[k]).length;
  const total = ALL_KEYS.length;
  const allOff = enabledCount === 0;

  const setAll = (state: boolean) => {
    const next: MetaAiFeatures = {};
    for (const key of ALL_KEYS) next[key] = state;
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-bg)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-[var(--rvz-ink-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--rvz-ink-muted)]" />
          )}
          <Sparkles className="h-4 w-4 text-[var(--rvz-ink)]" />
          <span className="text-sm font-medium text-[var(--rvz-ink)]">Creative Setup</span>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] uppercase',
              allOff
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-300',
            )}
          >
            {allOff ? `${total}/${total} apagados` : `${enabledCount} activos · ${total - enabledCount} apagados`}
          </span>
        </div>
        <span className="text-[11px] text-[var(--rvz-ink-muted)]">
          {allOff
            ? 'Todas las "mejoras automáticas" de Meta están desactivadas'
            : 'Tienes mejoras de Meta activas — revisa abajo'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--rvz-card-border)] px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--rvz-ink-muted)]">
              Por defecto desactivamos todo para que el anuncio se publique tal
              como lo armaste. Activa solo lo que quieras que Meta optimice.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setAll(false)}
                className="inline-flex items-center gap-1 rounded border border-[var(--rvz-card-border)] px-2 py-1 text-[10px] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]"
              >
                <Power className="h-3 w-3" /> Apagar todo
              </button>
              <button
                onClick={() => setAll(true)}
                className="rounded border border-[var(--rvz-ink)]/40 bg-[var(--rvz-accent)]/10 px-2 py-1 text-[10px] text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/20"
              >
                Activar todo
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SECTIONS.map((section) => {
              const sectionOn = section.toggles.filter((t) => !!value[t.key]).length;
              return (
                <div
                  key={section.title}
                  className="rounded border border-[var(--rvz-card-border)] bg-black/30 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--rvz-ink)]">{section.title}</h4>
                    <span className="text-[10px] text-[var(--rvz-ink-muted)]">
                      {sectionOn === 0 ? 'todos OFF' : `${sectionOn}/${section.toggles.length} ON`}
                    </span>
                  </div>
                  {section.description && (
                    <p className="mb-2 text-[11px] text-[var(--rvz-ink-muted)]">{section.description}</p>
                  )}
                  <div className="space-y-1.5">
                    {section.toggles.map((t) => (
                      <label
                        key={t.key}
                        className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-[var(--rvz-bg)]"
                      >
                        <input
                          type="checkbox"
                          checked={!!value[t.key]}
                          onChange={(e) =>
                            onChange({ ...value, [t.key]: e.target.checked })
                          }
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-[var(--rvz-ink-muted)]">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const ALL_AI_FEATURE_KEYS = ALL_KEYS;
