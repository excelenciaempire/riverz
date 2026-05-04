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
            : 'No pudimos guardarte. Intenta de nuevo en unos segundos.'
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
    <div className="flex min-h-screen items-center justify-center bg-[#000000]">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#07A498] tracking-wider">RIVERZ</h1>
          <p className="mt-2 text-sm text-gray-500">
            Estamos cerrando registros — únete a la lista de espera
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-[#07A498]/40 bg-[#07A498]/5 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#07A498]/20 text-[#07A498]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              {status === 'already' ? 'Ya estás en la lista' : '¡Estás dentro!'}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Te avisaremos a <span className="text-gray-200">{email}</span> en cuanto abramos
              nuevos cupos.
            </p>
            <Link
              href="/sign-in"
              className="mt-5 inline-block text-sm font-medium text-[#07A498] hover:text-[#068f84]"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="waitlist-email"
                className="ml-1 mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400"
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
                className="w-full rounded-xl border border-gray-800 bg-[#0a0a0a] px-4 py-3 text-white outline-none transition-all focus:border-[#07A498] focus:ring-1 focus:ring-[#07A498] disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="mt-2 w-full rounded-xl bg-[#07A498] py-3 font-medium text-white shadow-lg shadow-[#07A498]/20 transition-all hover:bg-[#068f84] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'loading' ? 'Enviando…' : 'Unirme a la lista de espera'}
            </button>

            {status === 'error' && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}

            <p className="pt-2 text-center text-sm text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <Link href="/sign-in" className="font-medium text-[#07A498] hover:text-[#068f84]">
                Inicia sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
