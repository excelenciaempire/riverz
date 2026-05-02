import {
  Brain,
  Wand2,
  Sparkles,
  Image as ImageIcon,
  Film,
  Mic,
  Layers,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { GenerationType } from '@/types';

export type AgentRoute = {
  href: string;
  label: string;
};

export type Agent = {
  id:
    | 'investigador'
    | 'estratega'
    | 'director'
    | 'disenador'
    | 'productor'
    | 'voz'
    | 'post'
    | 'performance';
  name: string;
  role: string;
  description: string;
  hue: string;
  icon: LucideIcon;
  routes: AgentRoute[];
  requiresBrand: boolean;
  capabilities: string[];
};

export const AGENTS: Agent[] = [
  {
    id: 'investigador',
    name: 'Investigador',
    role: 'Conoce tu marca',
    description: 'Investiga audiencia, competencia y tendencias para guiar todo lo demás.',
    hue: '#60A5FA',
    icon: Brain,
    routes: [
      { href: '/marcas', label: 'Marcas' },
      { href: '/inspiracion', label: 'Inspiración' },
    ],
    requiresBrand: false,
    capabilities: ['Audiencia', 'Competencia', 'Insights'],
  },
  {
    id: 'estratega',
    name: 'Estratega',
    role: 'Diseña la campaña',
    description: 'Define ángulos, hooks y la arquitectura del funnel.',
    hue: '#A78BFA',
    icon: Wand2,
    routes: [
      { href: '/landing-lab', label: 'Landing Lab' },
      { href: '/campanas/meta', label: 'Brief de campaña' },
    ],
    requiresBrand: true,
    capabilities: ['Ángulos', 'Hooks', 'Funnel'],
  },
  {
    id: 'director',
    name: 'Director Creativo',
    role: 'Genera las ideas',
    description: 'Storyboards, copys y guiones con la voz exacta de tu marca.',
    hue: '#F472B6',
    icon: Sparkles,
    routes: [
      { href: '/crear/stealer', label: 'Stealer' },
      { href: '/inspiracion', label: 'Inspiración' },
    ],
    requiresBrand: true,
    capabilities: ['Storyboards', 'Copys', 'A/B'],
  },
  {
    id: 'disenador',
    name: 'Diseñador',
    role: 'Tu identidad visual',
    description: 'Anuncios estáticos y foto de producto con tu paleta y tipografía.',
    hue: '#14E0CC',
    icon: ImageIcon,
    routes: [
      { href: '/crear/static-ads', label: 'Static Ads' },
      { href: '/crear/editar-foto', label: 'Editar Foto' },
    ],
    requiresBrand: true,
    capabilities: ['Static Ads', 'Producto', 'Branding'],
  },
  {
    id: 'productor',
    name: 'Productor de Video',
    role: 'UGC y clips',
    description: 'Avatares hiperrealistas presentando tu producto en cualquier idioma.',
    hue: '#22D3EE',
    icon: Film,
    routes: [
      { href: '/crear/clips', label: 'Clips' },
      { href: '/crear/face-swap', label: 'Face Swap' },
    ],
    requiresBrand: true,
    capabilities: ['Clips', 'Reels', 'Face Swap'],
  },
  {
    id: 'voz',
    name: 'Voz y Guion',
    role: 'Habla por tu marca',
    description: 'Voces consistentes, multilingüe y sincronizadas a labio.',
    hue: '#F59E0B',
    icon: Mic,
    routes: [{ href: '/crear/ugc', label: 'UGC' }],
    requiresBrand: true,
    capabilities: ['Voiceover', 'Multi-idioma', 'Sync'],
  },
  {
    id: 'post',
    name: 'Post-producción',
    role: 'Listo para publicar',
    description: 'Mejora a 4K, recorta a cada formato y entrega para Meta, TikTok y tu tienda.',
    hue: '#34D399',
    icon: Layers,
    routes: [{ href: '/crear/mejorar-calidad', label: 'Mejorar Calidad' }],
    requiresBrand: false,
    capabilities: ['Upscale', 'Multiformato', 'Render'],
  },
  {
    id: 'performance',
    name: 'Performance',
    role: 'Aprende de resultados',
    description: 'Detecta los anuncios ganadores y le pide más al equipo de la misma fórmula.',
    hue: '#FB7185',
    icon: BarChart3,
    routes: [{ href: '/campanas/meta', label: 'Meta Ads' }],
    requiresBrand: true,
    capabilities: ['Ganadores', 'KPIs', 'ROAS'],
  },
];

const TYPE_TO_AGENT: Record<GenerationType, Agent['id']> = {
  ugc: 'voz',
  face_swap: 'productor',
  clips: 'productor',
  editar_foto_crear: 'disenador',
  editar_foto_editar: 'disenador',
  editar_foto_combinar: 'disenador',
  editar_foto_clonar: 'disenador',
  mejorar_calidad_video: 'post',
  mejorar_calidad_imagen: 'post',
  static_ad_generation: 'disenador',
};

const TYPE_LABEL: Record<GenerationType, string> = {
  ugc: 'UGC',
  face_swap: 'Face Swap',
  clips: 'Clip',
  editar_foto_crear: 'Foto · Crear',
  editar_foto_editar: 'Foto · Editar',
  editar_foto_combinar: 'Foto · Combinar',
  editar_foto_clonar: 'Foto · Clonar',
  mejorar_calidad_video: 'Upscale Video',
  mejorar_calidad_imagen: 'Upscale Imagen',
  static_ad_generation: 'Static Ad',
};

const TYPE_ROUTE: Record<GenerationType, string> = {
  ugc: '/crear/ugc',
  face_swap: '/crear/face-swap',
  clips: '/crear/clips',
  editar_foto_crear: '/crear/editar-foto',
  editar_foto_editar: '/crear/editar-foto',
  editar_foto_combinar: '/crear/editar-foto',
  editar_foto_clonar: '/crear/editar-foto',
  mejorar_calidad_video: '/crear/mejorar-calidad',
  mejorar_calidad_imagen: '/crear/mejorar-calidad',
  static_ad_generation: '/crear/static-ads',
};

const VIDEO_TYPES = new Set<GenerationType>([
  'ugc',
  'face_swap',
  'clips',
  'mejorar_calidad_video',
]);

export function getAgentForType(type: GenerationType): Agent {
  const id = TYPE_TO_AGENT[type];
  return AGENTS.find((a) => a.id === id) ?? AGENTS[3];
}

export function getTypeLabel(type: GenerationType): string {
  return TYPE_LABEL[type] ?? type;
}

export function getTypeRoute(type: GenerationType): string {
  return TYPE_ROUTE[type] ?? '/crear';
}

export function isVideoType(type: GenerationType): boolean {
  return VIDEO_TYPES.has(type);
}
