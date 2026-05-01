'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertOctagon } from 'lucide-react';

interface Props {
  retryAfterSec: number;
  message?: string;
  /** Optional callback when the countdown reaches 0 — useful for auto-refetch. */
  onExpire?: () => void;
}

/**
 * Shows a yellow banner with a live countdown until the Meta BUC cooldown
 * lifts. Used both inside the connection card and at the top of /anuncios.
 *
 * The countdown ticks locally — we don't poll the server for it. When it
 * reaches 0 we fire `onExpire` so the parent can re-trigger the affected
 * query (e.g. invalidate ['meta-ads']).
 */
export function RateLimitBanner({ retryAfterSec, message, onExpire }: Props) {
  const [remaining, setRemaining] = useState(retryAfterSec);

  useEffect(() => {
    setRemaining(retryAfterSec);
  }, [retryAfterSec]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining, onExpire]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const timeLabel = m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-200">
          Meta nos pidió esperar antes de seguir
        </p>
        <p className="mt-1 text-xs text-amber-100/80">
          {message ||
            'Tu cuenta publicitaria llegó al límite de llamadas por hora (BUC). La app está en modo desarrollo de Meta — actualizar a Acceso Estándar sube el límite ~600x. Mientras tanto podemos esperar.'}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200">
          <Clock className="h-3 w-3" />
          {remaining > 0 ? `Reintenta en ${timeLabel}` : 'Listo, recarga la página'}
        </p>
      </div>
    </div>
  );
}
