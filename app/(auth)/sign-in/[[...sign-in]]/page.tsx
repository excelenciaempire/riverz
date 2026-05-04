import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
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
          <p className="app-v2-eyebrow mt-4">Acceso al estudio</p>
          <h1 className="app-v2-page-h2 mt-2">Bienvenido de nuevo</h1>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-transparent shadow-none border-none p-0',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton: 'hidden',
              socialButtonsPlacement: 'hidden',
              dividerRow: 'hidden',
              footer: 'hidden',
              footerAction: 'hidden',
              formFieldLabel:
                'text-[var(--rvz-ink-muted)] text-[10px] uppercase tracking-[0.16em] font-semibold ml-1 mb-1.5',
              formFieldInput:
                'bg-[var(--rvz-input-bg)] border border-[var(--rvz-input-border)] text-[var(--rvz-ink)] rounded-lg px-3.5 py-3 focus:border-[var(--rvz-ink)] focus:ring-2 focus:ring-[var(--rvz-focus-ring)] transition-all outline-none',
              formButtonPrimary:
                'bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent-hover)] text-[var(--rvz-accent-fg)] font-bold uppercase tracking-[0.04em] text-[12px] py-3 rounded-md transition-all mt-4',
              footerActionLink:
                'text-[var(--rvz-ink)] hover:opacity-80 font-medium text-[13px]',
              footerActionText: 'text-[var(--rvz-ink-muted)] text-[13px]',
              identityPreviewText: 'text-[var(--rvz-ink)]',
              identityPreviewEditButton: 'text-[var(--rvz-ink)] ml-2',
              formFieldInputShowPasswordButton:
                'text-[var(--rvz-ink-faint)] hover:text-[var(--rvz-ink)]',
              otpCodeFieldInput:
                'bg-[var(--rvz-input-bg)] border-[var(--rvz-input-border)] text-[var(--rvz-ink)] rounded-lg',
              formResendCodeLink: 'text-[var(--rvz-ink)] hover:opacity-80',
              errorMessage: 'text-red-500 text-[13px] mt-2',
            },
            layout: {
              socialButtonsPlacement: 'bottom',
              showOptionalFields: false,
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/crear"
        />

        <p className="mt-6 text-center text-[13px] text-[var(--rvz-ink-muted)]">
          ¿Aún no tenés cuenta?{' '}
          <Link
            href="/sign-up"
            className="font-semibold text-[var(--rvz-ink)] underline underline-offset-2 hover:opacity-80"
          >
            Únete a la lista de espera
          </Link>
        </p>
      </div>
    </div>
  );
}
