'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useActiveBrand } from '@/hooks/useActiveBrand';
import { Check, ChevronDown, Package, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Investigación pendiente', tone: 'text-amber-300 bg-amber-300/10' },
  processing: { label: 'Investigando…', tone: 'text-blue-300 bg-blue-300/10' },
  completed: { label: 'Investigación lista', tone: 'text-emerald-300 bg-emerald-300/10' },
  failed: { label: 'Investigación falló', tone: 'text-rose-300 bg-rose-300/10' },
};

export function ActiveBrandSwitcher() {
  const { activeBrand, brands, setActiveBrandId, isLoading } = useActiveBrand();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="glass-strong h-[68px] w-full max-w-sm animate-pulse-subtle rounded-2xl" />
    );
  }

  if (brands.length === 0) {
    return (
      <Link
        href="/marcas"
        className="glass-strong group flex w-full max-w-sm items-center justify-between rounded-2xl px-4 py-3 transition hover:border-white/20"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#07A498]/15 text-[#14E0CC]">
            <Plus className="h-4 w-4" />
          </span>
          <div className="text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
              Marca activa
            </p>
            <p className="text-sm font-semibold text-white">Crea tu primera marca</p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-white/40 transition group-hover:text-white/80" />
      </Link>
    );
  }

  const status = activeBrand?.research_status
    ? STATUS_LABEL[activeBrand.research_status]
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="glass-strong group flex w-full max-w-sm items-center justify-between rounded-2xl px-4 py-3 transition hover:border-white/20"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {activeBrand?.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeBrand.images[0]}
                  alt={activeBrand.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-4 w-4 text-white/50" />
              )}
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                Marca activa
              </p>
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">
                  {activeBrand?.name ?? 'Selecciona una marca'}
                </p>
                {status && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                      status.tone,
                    )}
                  >
                    {status.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-white/40 transition group-hover:text-white/80',
              open && 'rotate-180 text-white/80',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="glass-strong w-[320px] rounded-2xl border-white/10 p-2 text-white"
      >
        <div className="px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
          Tus marcas
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {brands.map((brand) => {
            const isActive = brand.id === activeBrand?.id;
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => {
                  setActiveBrandId(brand.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition',
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
                  {brand.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.images[0]}
                      alt={brand.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-white/50" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{brand.name}</p>
                  {brand.research_status && (
                    <p className="text-[10px] text-white/45">
                      {STATUS_LABEL[brand.research_status]?.label ?? brand.research_status}
                    </p>
                  )}
                </div>
                {isActive && <Check className="h-4 w-4 text-[#14E0CC]" />}
              </button>
            );
          })}
        </div>
        <div className="mt-1 border-t border-white/[0.06] pt-1">
          <Link
            href="/marcas"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-white/80 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Agregar nueva marca
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
