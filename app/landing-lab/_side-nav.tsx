'use client';

/**
 * Minimal left rail shared by every /landing-lab page.
 *
 * Three items only — Inicio, Mis Páginas, Tienda — to match the user's
 * spec. Tienda routes to the Riverz Configuración → Integraciones tab so
 * the existing Shopify-connect UI is reused (no duplicate UI to maintain).
 * The "← Volver" button at the very top exits the Landing Lab back to the
 * main Riverz dashboard, replacing the larger "Volver a Riverz" link that
 * used to sit on the canvas top bar.
 */
export function SideNav({ active }: { active?: 'inicio' | 'mis-paginas' | 'tienda' }) {
  return (
    <aside className="hidden w-[60px] shrink-0 flex-col items-center border-r border-white/5 bg-[#0e1015] py-4 sm:flex">
      <NavIcon href="/dashboard" label="Volver" icon="←" />
      <a
        href="/landing-lab"
        className="mt-4 grid size-9 place-items-center rounded-lg bg-white/[0.06] text-base font-bold"
        aria-label="Landing Lab"
      >
        L
      </a>
      <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
        <NavIcon href="/landing-lab" label="Inicio" icon="⌂" active={active === 'inicio'} />
        <NavIcon href="/landing-lab/mis-paginas" label="Mis Páginas" icon="📄" active={active === 'mis-paginas'} />
        <NavIcon href="/configuracion?tab=integrations" label="Tienda" icon="🛍" active={active === 'tienda'} />
      </nav>
    </aside>
  );
}

function NavIcon({ href, label, icon, active = false }: { href: string; label: string; icon: string; active?: boolean }) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={
        'group relative grid size-9 place-items-center rounded-lg text-sm transition ' +
        (active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.05] hover:text-white')
      }
    >
      <span aria-hidden>{icon}</span>
      <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md border border-white/10 bg-[#15181f] px-2 py-1 text-xs text-white/80 shadow-lg group-hover:block">
        {label}
      </span>
    </a>
  );
}
