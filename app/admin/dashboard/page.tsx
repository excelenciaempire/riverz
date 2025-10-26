'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { DashboardStats } from '@/components/admin/dashboard/stats';
import { UsersTable } from '@/components/admin/dashboard/users-table';
import { GenerationsTable } from '@/components/admin/dashboard/generations-table';
import { TemplatesManager } from '@/components/admin/dashboard/templates-manager';
import { APIConfigManager } from '@/components/admin/dashboard/api-config-manager';
import { LogsViewer } from '@/components/admin/dashboard/logs-viewer';
import { CreditsManager } from '@/components/admin/dashboard/credits-manager';
import { PricingConfig } from '@/components/admin/dashboard/pricing-config';
import { Loading } from '@/components/admin/ui/loading';

const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push('/admin');
      } else if (!ADMIN_EMAILS.includes(user.emailAddresses[0]?.emailAddress || '')) {
        router.push('/admin/unauthorized');
      }
    }
  }, [user, isLoaded, router]);

  if (!isLoaded) {
    return <Loading text="Verificando acceso..." />;
  }

  if (!user || !ADMIN_EMAILS.includes(user.emailAddresses[0]?.emailAddress || '')) {
    return null;
  }

  const tabs = [
    { id: 'overview', name: 'Resumen' },
    { id: 'users', name: 'Usuarios' },
    { id: 'generations', name: 'Generaciones' },
    { id: 'credits', name: 'Créditos' },
    { id: 'pricing', name: 'Precios' },
    { id: 'templates', name: 'Plantillas' },
    { id: 'api-config', name: 'APIs' },
    { id: 'logs', name: 'Logs' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="border-b border-gray-900 bg-black px-8 py-6">
        <div className="mx-auto max-w-[1800px]">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="mt-2 text-gray-400">Panel de administración de Riverz</p>
        </div>
      </div>

      <div className="border-b border-gray-900 bg-black px-8">
        <div className="mx-auto max-w-[1800px] flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-brand-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        <div className="mx-auto max-w-[1800px]">
          {activeTab === 'overview' && <DashboardStats />}
          {activeTab === 'users' && <UsersTable />}
          {activeTab === 'generations' && <GenerationsTable />}
          {activeTab === 'credits' && <CreditsManager />}
          {activeTab === 'pricing' && <PricingConfig />}
          {activeTab === 'templates' && <TemplatesManager />}
          {activeTab === 'api-config' && <APIConfigManager />}
          {activeTab === 'logs' && <LogsViewer />}
        </div>
      </div>
    </div>
  );
}

