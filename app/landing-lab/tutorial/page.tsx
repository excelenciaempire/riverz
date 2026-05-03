'use client';

/**
 * Tutorial — pantalla de onboarding/recursos. Por ahora muestra un video
 * embebido + links a recursos. Cuando grabemos el demo final, swap el
 * VIDEO_URL constant.
 */
import { SideNav } from '../_side-nav';
import { PlayCircle, FileText, MessageCircle } from 'lucide-react';

const VIDEO_URL = 'https://www.youtube.com/embed/Gr0HJMwmAXc';

export default function TutorialPage() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <SideNav active="tutorial" />
      <main className="ml-56 flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-[#07A498]" />
            <h1 className="text-3xl font-bold">Tutorial</h1>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Aprende a lanzar tu primera landing en menos de 5 minutos.
          </p>

          <div className="mt-8 aspect-video overflow-hidden rounded-2xl border border-gray-800 bg-black">
            <iframe
              src={VIDEO_URL}
              title="Riverz Landing Lab — Tutorial"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ResourceCard
              icon={FileText}
              title="Documentación"
              body="Endpoints API, schema de secciones y guías de integración."
              href="/landing-lab/api-keys"
            />
            <ResourceCard
              icon={MessageCircle}
              title="Soporte"
              body="¿Atascado? Escríbenos y te respondemos en menos de 24h."
              href="mailto:soporte@riverz.app"
            />
            <ResourceCard
              icon={PlayCircle}
              title="Casos de éxito"
              body="Cómo otras marcas usan Riverz para escalar páginas en Shopify."
              href="https://riverz.app/casos"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ResourceCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className="block rounded-lg border border-gray-800 bg-[#0d0d0d] p-5 transition-colors hover:border-[#07A498]"
    >
      <Icon className="h-5 w-5 text-[#07A498]" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </a>
  );
}
