'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';

/**
 * Two-state segmented control. Used in the sidebar footer + Configuración →
 * Apariencia. Always shows both states so the user can see they're in a
 * preference, not a binary action.
 */
export function ThemeToggle({
  variant = 'segmented',
  size = 'md',
}: {
  variant?: 'segmented' | 'icon';
  size?: 'sm' | 'md';
}) {
  const { theme, setTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        className="grid h-9 w-9 place-items-center rounded-md border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] text-[var(--rvz-ink)] transition hover:border-[var(--rvz-card-hover-border)]"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  const padding = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[12px]';

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] p-0.5">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium uppercase tracking-[0.06em] transition ${padding} ${
          theme === 'light'
            ? 'bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
            : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
        }`}
        aria-pressed={theme === 'light'}
      >
        <Sun className="h-3.5 w-3.5" />
        Claro
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium uppercase tracking-[0.06em] transition ${padding} ${
          theme === 'dark'
            ? 'bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
            : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
        }`}
        aria-pressed={theme === 'dark'}
      >
        <Moon className="h-3.5 w-3.5" />
        Oscuro
      </button>
    </div>
  );
}
