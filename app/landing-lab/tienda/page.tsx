'use client';

import { ShopifyConnectionPanel } from '@/components/settings/shopify-connection';
import { SideNav } from '../_side-nav';

export default function LandingLabTiendaPage() {
  return (
    <div className="app-v2 fixed inset-0 z-[9999] flex">
      <SideNav active="tienda" />
      <div className="ml-0 h-full flex-1 overflow-y-auto sm:ml-56">
        <main className="mx-auto max-w-[760px] px-6 pt-12 pb-24 sm:px-8">
          <h1 className="text-3xl font-bold">Tienda</h1>
          <p className="mt-1 text-sm text-white/55">
            Conectá tu Shopify para que las landings creadas en Riverz se publiquen como Pages
            con imágenes en Shopify Files. Una sola tienda por cuenta.
          </p>
          <div className="mt-8">
            <ShopifyConnectionPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
