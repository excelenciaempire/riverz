'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Check, Crown, CreditCard, User, Globe, Bell, Plug, Palette, Moon, Sun } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/types';
import { ShopifyConnectionPanel } from '@/components/settings/shopify-connection';
import { AiProviderPanel } from '@/components/settings/ai-provider-panel';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { useTheme } from '@/components/theme/theme-provider';

type TabType = 'billing' | 'account' | 'appearance' | 'notifications' | 'integrations';

function ConfiguracionContent() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('billing');
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab === 'integrations' ||
      tab === 'billing' ||
      tab === 'account' ||
      tab === 'appearance' ||
      tab === 'notifications'
    ) {
      setActiveTab(tab as TabType);
    }
    const shopify = searchParams.get('shopify');
    if (shopify === 'connected') {
      const shop = searchParams.get('shop');
      toast.success(`Shopify conectado${shop ? ': ' + shop : ''}`);
    } else if (shopify === 'error') {
      const reason = searchParams.get('reason') || 'unknown';
      toast.error(`Error al conectar Shopify (${reason})`);
    }
  }, [searchParams]);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const queryClient = useQueryClient();

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok && (response.status === 406 || response.status === 404)) {
        const initResponse = await fetch('/api/user/init', { method: 'POST' });
        if (!initResponse.ok) throw new Error('Failed to initialize user');
        const initData = await initResponse.json();
        return initData.data;
      }
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!user,
    retry: 1,
  });

  const updateLanguage = useMutation({
    mutationFn: async (lang: 'es' | 'en') => {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      if (!response.ok) throw new Error('Failed to update language');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Idioma actualizado');
    },
  });

  const createCheckout = async (planType: string) => {
    try {
      const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];
      if (!plan || !('priceId' in plan) || !plan.priceId) {
        toast.error('Plan no configurado. Por favor contacta al administrador.');
        return;
      }
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.priceId, planType }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Error al crear sesión de pago');
    }
  };

  const buyCredits = async () => {
    try {
      const amount = 5;
      const response = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) throw new Error('Failed to create checkout');
      const { url } = await response.json();
      window.location.href = url;
    } catch {
      toast.error('Error al crear sesión de pago');
    }
  };

  if (isLoading) {
    return <Loading text="Cargando configuración..." />;
  }

  const tabs: Array<{ id: TabType; label: string; icon: typeof CreditCard }> = [
    { id: 'billing', label: 'Plan & Créditos', icon: CreditCard },
    { id: 'account', label: 'Cuenta', icon: User },
    { id: 'appearance', label: 'Apariencia', icon: Palette },
    { id: 'integrations', label: 'Integraciones', icon: Plug },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
  ];

  return (
    <div className="space-y-8">
      <section className="page-hero">
        <p className="app-v2-eyebrow">Configuración</p>
        <h1 className="app-v2-page-h1 mt-2">
          Tu cuenta,
          <br />
          <span className="text-[var(--rvz-ink-muted)]">tu estudio.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--rvz-ink-muted)]">
          Gestioná plan, créditos, integraciones y apariencia. Lo que cambies acá afecta a
          todos los agentes y a la app entera.
        </p>
      </section>

      <div className="border-b border-[var(--rvz-section-rule)]">
        <div className="-mb-px flex flex-wrap gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-[12px] font-semibold uppercase tracking-[0.08em] transition ${
                  isActive
                    ? 'border-[var(--rvz-ink)] text-[var(--rvz-ink)]'
                    : 'border-transparent text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'integrations' && (
        <div className="grid gap-6 md:grid-cols-1">
          <div className="card-cream p-6 md:p-8">
            <AiProviderPanel />
          </div>
          <div className="card-cream p-6 md:p-8">
            <ShopifyConnectionPanel />
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="card-cream p-6 md:p-8">
            <p className="app-v2-eyebrow">Plan actual</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="app-v2-page-h2">
                  {SUBSCRIPTION_PLANS[userData?.plan_type as keyof typeof SUBSCRIPTION_PLANS]
                    ?.name || 'Free'}
                </p>
                <p className="mt-1 text-[13px] text-[var(--rvz-ink-muted)]">
                  {userData?.credits || 0} créditos disponibles
                </p>
              </div>
              <Button onClick={buyCredits}>Comprar Créditos</Button>
            </div>
          </div>

          <div>
            <p className="app-v2-eyebrow">Planes</p>
            <h2 className="app-v2-page-h2 mt-2">Elegí el que te queda</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {Object.entries(SUBSCRIPTION_PLANS)
                .filter(([key]) => key !== 'free')
                .map(([key, plan]) => {
                  const isCurrent = userData?.plan_type === key;
                  return (
                    <div
                      key={key}
                      className={`card-cream flex flex-col p-6 transition ${
                        isCurrent ? 'border-[var(--rvz-ink)] ring-2 ring-[var(--rvz-accent)]' : ''
                      }`}
                    >
                      <h3 className="text-[20px] font-medium tracking-tight">{plan.name}</h3>
                      <p className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-[36px] font-medium leading-none tracking-tight">
                          ${plan.price}
                        </span>
                        <span className="text-[13px] text-[var(--rvz-ink-muted)]">/mes</span>
                      </p>

                      <ul className="mt-5 flex-1 space-y-2.5">
                        {plan.features.map((feature, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-[13px] text-[var(--rvz-ink-muted)]"
                          >
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--rvz-ink)]" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {isCurrent ? (
                        <Button variant="outline" className="mt-6 w-full" disabled>
                          <Crown className="mr-1.5 h-3.5 w-3.5" />
                          Plan Actual
                        </Button>
                      ) : (
                        <Button onClick={() => createCheckout(key)} className="mt-6 w-full">
                          {userData?.plan_type === 'free' ? 'Comenzar' : 'Cambiar Plan'}
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="card-cream p-6 md:p-8">
            <p className="app-v2-eyebrow">Historial</p>
            <h3 className="mt-2 text-[18px] font-medium tracking-tight">Facturación</h3>
            <p className="mt-2 text-[13px] text-[var(--rvz-ink-muted)]">
              Próximamente vas a poder ver acá tu historial de pagos y descargar las facturas.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="card-cream p-6 md:p-8">
            <p className="app-v2-eyebrow">Tema</p>
            <h3 className="mt-2 text-[22px] font-medium tracking-tight">
              Claro u oscuro — vos elegís.
            </h3>
            <p className="mt-2 max-w-lg text-[13px] text-[var(--rvz-ink-muted)]">
              El tema se guarda en tu navegador y se aplica a toda la app, incluido Landing Lab.
              Cambialo cuando quieras desde acá.
            </p>
            <div className="mt-5">
              <ThemeToggle size="md" />
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              <ThemePreview mode="light" />
              <ThemePreview mode="dark" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="card-cream p-6 md:p-8">
            <p className="app-v2-eyebrow">Personal</p>
            <h3 className="mt-2 text-[22px] font-medium tracking-tight">Información de cuenta</h3>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.emailAddresses[0]?.emailAddress || ''}
                  disabled
                  className="mt-1"
                />
                <p className="mt-1.5 text-[11px] text-[var(--rvz-ink-faint)]">
                  Se gestiona desde tu cuenta de autenticación.
                </p>
              </div>
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  type="text"
                  value={user?.fullName || ''}
                  disabled
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="card-cream p-6 md:p-8">
            <p className="app-v2-eyebrow flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Idioma
            </p>
            <h3 className="mt-2 text-[22px] font-medium tracking-tight">Cómo te hablamos</h3>
            <div className="mt-5 inline-flex items-center gap-0.5 rounded-lg border border-[var(--rvz-card-border)] bg-[var(--rvz-bg-soft)] p-0.5">
              {(['es', 'en'] as const).map((lang) => {
                const isActive = (userData?.language || language) === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang);
                      updateLanguage.mutate(lang);
                    }}
                    className={`rounded-md px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] transition ${
                      isActive
                        ? 'bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)]'
                        : 'text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]'
                    }`}
                  >
                    {lang === 'es' ? 'Español' : 'English'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card-cream border-red-300/40 p-6 md:p-8">
            <p className="app-v2-eyebrow text-red-500">Zona de peligro</p>
            <h3 className="mt-2 text-[18px] font-medium tracking-tight text-red-600">
              Eliminar cuenta
            </h3>
            <p className="mt-2 text-[13px] text-[var(--rvz-ink-muted)]">
              Esto borra tus marcas, generaciones y plan. No se puede deshacer.
            </p>
            <Button variant="destructive" className="mt-4">
              Eliminar Cuenta
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card-cream p-6 md:p-8">
          <p className="app-v2-eyebrow">Notificaciones</p>
          <h3 className="mt-2 text-[22px] font-medium tracking-tight">¿Cuándo te avisamos?</h3>

          <div className="mt-6 space-y-4">
            {[
              {
                title: 'Notificaciones por Email',
                hint: 'Recibí actualizaciones sobre tus generaciones y cuenta',
                checked: true,
              },
              {
                title: 'Generación Completada',
                hint: 'Avisar cuando un video o imagen esté listo',
                checked: true,
              },
              {
                title: 'Créditos Bajos',
                hint: 'Alertar cuando tus créditos estén por agotarse',
                checked: true,
              },
              {
                title: 'Novedades y Ofertas',
                hint: 'Información sobre nuevas funciones y promociones',
                checked: false,
              },
            ].map((row) => (
              <div
                key={row.title}
                className="flex items-start justify-between gap-4 border-b border-[var(--rvz-section-rule)] pb-4 last:border-b-0 last:pb-0"
              >
                <div>
                  <h4 className="text-[14px] font-medium">{row.title}</h4>
                  <p className="mt-0.5 text-[12px] text-[var(--rvz-ink-muted)]">{row.hint}</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-[var(--rvz-card-border)] accent-[var(--rvz-ink)]"
                  defaultChecked={row.checked}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => toast.success('Preferencias guardadas')}>
              Guardar Preferencias
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemePreview({ mode }: { mode: 'light' | 'dark' }) {
  const { theme, setTheme } = useTheme();
  const isActive = theme === mode;
  const Icon = mode === 'dark' ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => setTheme(mode)}
      className={`group relative overflow-hidden rounded-xl border-2 transition ${
        isActive
          ? 'border-[var(--rvz-ink)]'
          : 'border-[var(--rvz-card-border)] hover:border-[var(--rvz-card-hover-border)]'
      }`}
      style={{
        background: mode === 'dark' ? '#0a0a0a' : '#fafaf7',
        color: mode === 'dark' ? '#fafaf7' : '#0a0a0a',
      }}
    >
      <div className="flex aspect-[4/3] flex-col p-4 text-left">
        <div className="flex items-center justify-between">
          <span
            className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold"
            style={{
              background: mode === 'dark' ? '#fafaf7' : '#0a0a0a',
              color: mode === 'dark' ? '#0a0a0a' : '#f7ff9e',
            }}
          >
            R
          </span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="mt-auto">
          <div className="text-[20px] font-medium leading-none tracking-tight">
            {mode === 'dark' ? 'Oscuro' : 'Claro'}
          </div>
          <div
            className="mt-1 text-[11px]"
            style={{ color: mode === 'dark' ? 'rgba(250,250,247,0.55)' : 'rgba(10,10,10,0.55)' }}
          >
            {mode === 'dark' ? 'Negro profundo + acento amarillo' : 'Cream editorial + tinta'}
          </div>
        </div>
      </div>
      <div className="absolute right-2.5 top-2.5">
        {isActive && (
          <span className="flex h-5 items-center gap-1 rounded-full bg-[#f7ff9e] px-2 text-[9px] font-bold uppercase tracking-[0.1em] text-black">
            Activo
          </span>
        )}
      </div>
    </button>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<Loading text="Cargando configuración..." />}>
      <ConfiguracionContent />
    </Suspense>
  );
}
