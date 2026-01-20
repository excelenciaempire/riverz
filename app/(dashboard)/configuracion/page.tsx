'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Check, Crown, CreditCard, User, Globe, Bell } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/types';

type TabType = 'billing' | 'account' | 'notifications';

export default function ConfiguracionPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('billing');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const queryClient = useQueryClient();

  // Fetch user data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/user');
      
      // Si el usuario no existe (error 406 o 404), inicializarlo
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

  // Update language
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

  // Create checkout session
  const createCheckout = async (planType: string) => {
    try {
      // Obtener el priceId del plan
      const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];
      
      console.log('Plan:', plan);
      console.log('Price ID:', plan?.priceId);
      
      if (!plan || !plan.priceId) {
        toast.error('Plan no configurado. Por favor contacta al administrador.');
        console.error('Plan configuration missing:', { planType, plan });
        return;
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: plan.priceId,
          planType 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Error al crear sesión de pago');
    }
  };

  // Buy credits
  const buyCredits = async () => {
    try {
      // Mínimo $5 USD
      const amount = 5;
      
      const response = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }), // $5 USD = 500 créditos
      });

      if (!response.ok) throw new Error('Failed to create checkout');

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast.error('Error al crear sesión de pago');
    }
  };

  if (isLoading) {
    return <Loading text="Cargando configuración..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="mt-2 text-gray-400">
          Gestiona tu cuenta, plan y preferencias
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex items-center gap-2 pb-4 ${
              activeTab === 'billing'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            Billing & Planes
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 pb-4 ${
              activeTab === 'account'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <User className="h-5 w-5" />
            Cuenta
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 pb-4 ${
              activeTab === 'notifications'
                ? 'border-b-2 border-brand-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="h-5 w-5" />
            Notificaciones
          </button>
        </div>
      </div>

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Current Plan */}
      <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">Plan Actual</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium capitalize text-brand-accent">
              {SUBSCRIPTION_PLANS[userData?.plan_type as keyof typeof SUBSCRIPTION_PLANS]?.name || 'Free'}
            </p>
            <p className="text-sm text-gray-400">
              {userData?.credits || 0} créditos disponibles
            </p>
          </div>
          <Button onClick={buyCredits}>Comprar Créditos</Button>
        </div>
      </div>

      {/* Subscription Plans */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Planes de Suscripción
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(SUBSCRIPTION_PLANS)
            .filter(([key]) => key !== 'free')
            .map(([key, plan]) => (
              <div
                key={key}
                className={`rounded-lg border p-6 ${
                  userData?.plan_type === key
                    ? 'border-brand-accent bg-brand-accent/10'
                    : 'border-gray-700 bg-brand-dark-secondary'
                }`}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-2">
                    <span className="text-3xl font-bold text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-400">/mes</span>
                  </p>
                </div>

                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {userData?.plan_type === key ? (
                  <Button variant="outline" className="w-full" disabled>
                    <Crown className="mr-2 h-4 w-4" />
                    Plan Actual
                  </Button>
                ) : (
                  <Button
                    onClick={() => createCheckout(key)}
                    className="w-full"
                  >
                    {userData?.plan_type === 'free' ? 'Comenzar' : 'Cambiar Plan'}
                  </Button>
                )}
              </div>
            ))}
        </div>
      </div>

          {/* Billing History */}
          <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              Historial de Facturación
            </h2>
            <p className="text-sm text-gray-400">
              Próximamente podrás ver tu historial de pagos y facturas aquí.
            </p>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Personal Information */}
          <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
            <h2 className="mb-6 text-xl font-semibold text-white">
              Información Personal
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.emailAddresses[0]?.emailAddress || ''}
                  disabled
                  className="bg-gray-800"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El email se gestiona a través de tu cuenta de autenticación
                </p>
              </div>

              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  type="text"
                  value={user?.fullName || ''}
                  disabled
                  className="bg-gray-800"
                />
              </div>
            </div>
          </div>

          {/* Language Settings */}
          <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">
              <Globe className="mb-2 inline h-5 w-5" /> Idioma
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Selecciona el idioma de la interfaz
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setLanguage('es');
                  updateLanguage.mutate('es');
                }}
                className={`rounded-lg px-6 py-3 ${
                  userData?.language === 'es'
                    ? 'bg-brand-accent text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🇪🇸 Español
              </button>
              <button
                onClick={() => {
                  setLanguage('en');
                  updateLanguage.mutate('en');
                }}
                className={`rounded-lg px-6 py-3 ${
                  userData?.language === 'en'
                    ? 'bg-brand-accent text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="rounded-lg border border-red-900 bg-red-900/10 p-6">
            <h2 className="mb-4 text-xl font-semibold text-red-400">
              Zona de Peligro
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Acciones irreversibles relacionadas con tu cuenta
            </p>
            <Button variant="destructive">
              Eliminar Cuenta
            </Button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
            <h2 className="mb-6 text-xl font-semibold text-white">
              Preferencias de Notificaciones
            </h2>

            <div className="space-y-6">
              {/* Email Notifications */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white">
                    Notificaciones por Email
                  </h3>
                  <p className="text-sm text-gray-400">
                    Recibe actualizaciones sobre tus generaciones y cuenta
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-600 bg-gray-700"
                  defaultChecked
                />
              </div>

              {/* Generation Complete */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white">
                    Generación Completada
                  </h3>
                  <p className="text-sm text-gray-400">
                    Notificar cuando un video o imagen esté listo
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-600 bg-gray-700"
                  defaultChecked
                />
              </div>

              {/* Low Credits */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white">
                    Créditos Bajos
                  </h3>
                  <p className="text-sm text-gray-400">
                    Alertar cuando tus créditos estén por agotarse
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-600 bg-gray-700"
                  defaultChecked
                />
              </div>

              {/* Marketing */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white">
                    Novedades y Ofertas
                  </h3>
                  <p className="text-sm text-gray-400">
                    Recibir información sobre nuevas funciones y promociones
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-600 bg-gray-700"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => toast.success('Preferencias guardadas')}>
                Guardar Preferencias
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

