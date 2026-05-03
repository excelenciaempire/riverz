'use client';

/**
 * Refer & Earn — comparte tu código y gana créditos cuando un amigo
 * publica su primera landing.
 *
 * Riverz no cobra, así que en lugar del 25% commission de EcomWize, el
 * incentivo es +créditos. Cuando un referido publica su primera página,
 * `referrals.status` pasa a 'activated' y otorgamos N créditos a ambos
 * (lógica del trigger vive en /api/landing-pages/[id]/publish — cuando
 * la primera publicación de un user con referral existe, se acreditan).
 */

import { useEffect, useState } from 'react';
import { Gift, Copy, Check, Loader2, Users, Coins } from 'lucide-react';
import { SideNav } from '../_side-nav';

const CREDITS_PER_REFERRAL = 200;

interface ReferralRow {
  id: string;
  status: string;
  credits_awarded: number;
  signed_up_at: string;
  activated_at: string | null;
}

export default function ReferPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [activated, setActivated] = useState(0);
  const [credits, setCredits] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referrals/code')
      .then((r) => r.json())
      .then((j) => {
        setCode(j.code);
        setReferrals(j.referrals ?? []);
        setActivated(j.activated_count ?? 0);
        setCredits(j.total_credits_earned ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const referLink = code ? `${typeof window !== 'undefined' ? window.location.origin : 'https://riverz.app'}/?ref=${code}` : '';

  async function handleCopy() {
    await navigator.clipboard.writeText(referLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <SideNav active="refer" />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-[#07A498]" />
            <h1 className="text-3xl font-bold">Invita y gana créditos</h1>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Cada amigo que se registre con tu link y publique su primera landing te suma {CREDITS_PER_REFERRAL} créditos a tu cuenta. Sin tope.
          </p>

          {/* Link */}
          <div className="mt-8 rounded-lg border border-gray-800 bg-[#0d0d0d] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tu link de referido</div>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-black/50 px-3 py-2 font-mono text-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <span className="flex-1 break-all">{referLink}</span>}
              <button onClick={handleCopy} disabled={!referLink} className="shrink-0 text-gray-400 hover:text-white">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Stat icon={Users} label="Referidos activados" value={activated.toString()} />
            <Stat icon={Coins} label="Créditos ganados" value={credits.toString()} />
          </div>

          {/* Cómo funciona */}
          <div className="mt-10 rounded-lg border border-gray-800 bg-[#0d0d0d] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Cómo funciona</h2>
            <ol className="mt-4 space-y-3 text-sm">
              <Step n={1} title="Comparte tu link" body="A clientes, comunidad, en Twitter — donde sea." />
              <Step n={2} title="Tu amigo se registra" body="Con un click en tu link queda asociado a ti." />
              <Step n={3} title="Publica su primera landing" body={`Ahí ambos reciben +${CREDITS_PER_REFERRAL} créditos.`} />
            </ol>
          </div>

          {/* Referidos */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Tus referidos</h2>
            {loading ? (
              <div className="mt-4 text-sm text-gray-500">Cargando…</div>
            ) : referrals.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-800 p-8 text-center text-sm text-gray-500">
                Aún no hay nadie. Comparte tu link arriba.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-gray-800 bg-[#0d0d0d] p-3 text-xs">
                    <div>
                      <div>
                        <span className="font-medium">Anónimo</span>
                        <span
                          className={`ml-2 rounded-full px-2 py-[1px] text-[10px] font-semibold ${
                            r.status === 'activated'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-gray-700/40 text-gray-400'
                          }`}
                        >
                          {r.status === 'activated' ? 'Activado' : 'Sin activar'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        Registrado {new Date(r.signed_up_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#07A498]">+{r.credits_awarded}</div>
                      <div className="text-[10px] text-gray-500">créditos</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#0d0d0d] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#07A498]/20 text-xs font-bold text-[#07A498]">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-gray-400">{body}</div>
      </div>
    </li>
  );
}
