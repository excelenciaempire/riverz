'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'sign-up' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(
          data?.error === 'invalid_email'
            ? 'Por favor introduce un correo válido.'
            : 'No pudimos guardarte. Intenta de nuevo en unos segundos.',
        );
        return;
      }
      setStatus(data?.alreadyOnList ? 'already' : 'success');
    } catch {
      setStatus('error');
      setErrorMsg('Error de red. Revisa tu conexión.');
    }
  }

  const success = status === 'success' || status === 'already';

  return (
    <div className="app-v2 flex min-h-screen items-center justify-center bg-[var(--rvz-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rvz-ink)] text-[var(--rvz-accent)] text-[14px] font-bold">
              R
            </span>
            <span className="text-[20px] font-semibold tracking-tight text-[var(--rvz-ink)]">
              Riverz
            </span>
          </Link>
          <p className="app-v2-eyebrow mt-4">Lista de espera</p>
          <h1 className="app-v2-page-h2 mt-2">Únete al estudio</h1>
          <p className="mt-3 text-[13px] text-[var(--rvz-ink-muted)]">
            Estamos cerrando registros. Te avisamos en cuanto abramos cupos.
          </p>
        </div>

        {success ? (
          <div className="card-cream p-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-[18px] font-medium tracking-tight">
              {status === 'already' ? 'Ya estás en la lista' : '¡Estás dentro!'}
            </h2>
            <p className="mt-2 text-[13px] text-[var(--rvz-ink-muted)]">
              Te avisamos a <span className="font-medium text-[var(--rvz-ink)]">{email}</span> en
              cuanto abramos nuevos cupos.
            </p>
            <Link
              href="/sign-in"
              className="mt-5 inline-block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--rvz-ink-muted)] transition hover:text-[var(--rvz-ink)]"
            >
              ¿Ya tenés cuenta? Iniciar sesión →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="waitlist-email"
                className="ml-1 mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--rvz-ink-muted)]"
              >
                Correo electrónico
              </label>
              <input
                id="waitlist-email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                className="w-full rounded-lg border border-[var(--rvz-input-border)] bg-[var(--rvz-input-bg)] px-3.5 py-3 text-[var(--rvz-ink)] placeholder:text-[var(--rvz-ink-faint)] outline-none transition-all focus:border-[var(--rvz-ink)] focus:ring-2 focus:ring-[var(--rvz-focus-ring)] disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="app-v2-cta mt-2 w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'loading' ? 'Enviando…' : 'Unirme a la lista de espera'}
            </button>

            {status === 'error' && (
              <p className="text-[13px] text-red-500">{errorMsg}</p>
            )}

            <p className="pt-2 text-center text-[13px] text-[var(--rvz-ink-muted)]">
              ¿Ya tenés cuenta?{' '}
              <Link
                href="/sign-in"
                className="font-semibold text-[var(--rvz-ink)] underline underline-offset-2 hover:opacity-80"
              >
                Iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
