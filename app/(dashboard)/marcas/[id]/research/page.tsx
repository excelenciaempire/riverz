'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, User, AlertTriangle, Skull, XCircle, Sparkles, 
  Brain, MessageSquare, Heart, Users, Quote, Loader2, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResearchData {
  perfil_demografico?: {
    nombre_avatar?: string;
    nombre_arquetipo?: string;
    edad?: string;
    genero?: string;
    ubicacion?: string;
    nivel_socioeconomico?: string;
    ocupacion?: string;
    comportamiento_online?: string;
    descripcion_detallada?: string;
    descripcion?: string;
  };
  problema_central?: {
    pain_point_principal?: string;
    dolor_principal?: string;
    sintomas_diarios?: string;
    impacto_emocional?: string;
    urgencia?: string;
    como_se_siente?: string;
    emociones?: string[];
  };
  top_5_emociones?: string[];
  miedos_oscuros?: {
    miedo_1?: { miedo?: string; por_que_aterra?: string; escenario_pesadilla?: string };
    miedo_2?: { miedo?: string; por_que_aterra?: string; escenario_pesadilla?: string };
    miedo_3?: { miedo?: string; por_que_aterra?: string; escenario_pesadilla?: string };
    miedo_4?: { miedo?: string; por_que_aterra?: string; escenario_pesadilla?: string };
    miedo_5?: { miedo?: string; por_que_aterra?: string; escenario_pesadilla?: string };
    miedos?: Array<{ miedo?: string; descripcion?: string }>;
  };
  impacto_en_relaciones?: {
    pareja?: string;
    hijos?: string;
    amigos?: string;
    familia_extendida?: string;
    compañeros_trabajo?: string;
  };
  cosas_hirientes_que_dicen?: Array<{ quien?: string; quote?: string }>;
  soluciones_fallidas?: {
    solucion_1?: { que_probaron?: string; por_que_fallo?: string; frustracion?: string; soundbite?: string };
    solucion_2?: { que_probaron?: string; por_que_fallo?: string; frustracion?: string; soundbite?: string };
    solucion_3?: { que_probaron?: string; por_que_fallo?: string; frustracion?: string; soundbite?: string };
    solucion_4?: { que_probaron?: string; por_que_fallo?: string; frustracion?: string; soundbite?: string };
    solucion_5?: { que_probaron?: string; por_que_fallo?: string; frustracion?: string; soundbite?: string };
    productos_fallidos?: Array<{ nombre?: string; razon_fallo?: string; soundbite?: string }>;
  };
  transformacion_deseada?: {
    resultados_genio_magico?: string[];
    impacto_estatus_social?: string;
    cosas_que_diran_otros?: Array<{ quien?: string; quote?: string }>;
  };
  transformacion?: {
    resultados?: string[];
    impacto_estatus?: string;
  };
  creencias_y_objeciones?: {
    si_solo_tuviera?: string;
    por_que_permanecen_en_problema?: string;
    a_quien_culpan?: string[];
    objeciones_principales?: string[];
  };
  creencias?: {
    si_solo_tuviera?: string;
    objeciones?: string[];
    culpables?: string[];
  };
  lenguaje_del_mercado?: {
    frases_que_usan?: string[];
    palabras_que_resuenan?: string[];
    terminos_que_evitar?: string[];
  };
  lenguaje?: {
    palabras_clave?: string[];
  };
  raw_response?: string;
  parse_error?: boolean;
}

function SectionCard({ 
  title, 
  icon: Icon, 
  children, 
  accentColor = 'brand-accent',
  className = ''
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
}) {
  const colorClasses: Record<string, string> = {
    'brand-accent': 'border-brand-accent/30 bg-brand-accent/5',
    'red-500': 'border-red-500/30 bg-red-500/5',
    'purple-500': 'border-purple-500/30 bg-purple-500/5',
    'orange-500': 'border-orange-500/30 bg-orange-500/5',
    'green-500': 'border-green-500/30 bg-green-500/5',
    'blue-500': 'border-blue-500/30 bg-blue-500/5',
    'cyan-500': 'border-cyan-500/30 bg-cyan-500/5',
    'pink-500': 'border-pink-500/30 bg-pink-500/5',
  };

  const iconColors: Record<string, string> = {
    'brand-accent': 'text-brand-accent bg-brand-accent/20',
    'red-500': 'text-red-400 bg-red-500/20',
    'purple-500': 'text-purple-400 bg-purple-500/20',
    'orange-500': 'text-orange-400 bg-orange-500/20',
    'green-500': 'text-green-400 bg-green-500/20',
    'blue-500': 'text-blue-400 bg-blue-500/20',
    'cyan-500': 'text-cyan-400 bg-cyan-500/20',
    'pink-500': 'text-pink-400 bg-pink-500/20',
  };

  return (
    <div className={cn("rounded-2xl border p-6", colorClasses[accentColor], className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2.5 rounded-xl", iconColors[accentColor])}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function QuoteCard({ persona, quote }: { persona: string; quote: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-4 border-l-4 border-brand-accent">
      <Quote className="h-4 w-4 text-brand-accent/50 mb-2" />
      <p className="text-gray-300 italic">"{quote}"</p>
      <p className="text-sm text-gray-500 mt-2">— {persona}</p>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'danger' | 'success' | 'warning' }) {
  const colors = {
    default: 'bg-gray-700/50 text-gray-300 border-gray-600',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
    success: 'bg-green-500/10 text-green-400 border-green-500/30',
    warning: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  };

  return (
    <span className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border", colors[variant])}>
      {children}
    </span>
  );
}

function FearCard({ miedo, porQue, escenario }: { miedo: string; porQue?: string; escenario?: string }) {
  return (
    <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 space-y-2">
      <h4 className="font-semibold text-purple-400">{miedo}</h4>
      {porQue && <p className="text-gray-400 text-sm"><span className="text-purple-300">Por qué aterra:</span> {porQue}</p>}
      {escenario && <p className="text-gray-500 text-sm italic">Escenario pesadilla: {escenario}</p>}
    </div>
  );
}

function SolutionCard({ nombre, razon, soundbite }: { nombre: string; razon?: string; soundbite?: string }) {
  return (
    <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 space-y-2">
      <h4 className="font-semibold text-orange-400">{nombre}</h4>
      {razon && <p className="text-gray-400 text-sm"><span className="text-orange-300">Por qué falló:</span> {razon}</p>}
      {soundbite && <p className="text-gray-500 text-sm italic">"{soundbite}"</p>}
    </div>
  );
}

export default function ResearchPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch product with research data
        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok) throw new Error('Product not found');
        const data = await res.json();
        setProduct(data);
        setResearchData(data.research_data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-gray-400">{error || 'Producto no encontrado'}</p>
        <Button onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  // Handle raw response or no data
  if (!researchData || researchData.parse_error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al producto
        </Button>
        
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Research no disponible</h1>
          <p className="text-gray-400 mb-6">
            {researchData?.raw_response 
              ? 'El research se generó pero no se pudo estructurar. Aquí está la respuesta:'
              : 'Este producto aún no tiene research generado.'
            }
          </p>
          {researchData?.raw_response && (
            <div className="text-left bg-gray-800/50 rounded-xl p-6 text-gray-300 whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">
              {researchData.raw_response}
            </div>
          )}
          <Button onClick={() => router.push(`/marcas/${productId}`)} className="mt-6">
            Volver y regenerar
          </Button>
        </div>
      </div>
    );
  }

  // Extract data with fallbacks for different formats
  const perfil = researchData.perfil_demografico;
  const problema = researchData.problema_central;
  const emociones = researchData.top_5_emociones || problema?.emociones || [];
  const miedos = researchData.miedos_oscuros;
  const relaciones = researchData.impacto_en_relaciones;
  const citasHirientes = researchData.cosas_hirientes_que_dicen || [];
  const soluciones = researchData.soluciones_fallidas;
  const transformacion = researchData.transformacion_deseada || researchData.transformacion;
  const creencias = researchData.creencias_y_objeciones || researchData.creencias;
  const lenguaje = researchData.lenguaje_del_mercado || researchData.lenguaje;

  // Extract fears from object format
  const miedosList = miedos ? [
    miedos.miedo_1, miedos.miedo_2, miedos.miedo_3, miedos.miedo_4, miedos.miedo_5
  ].filter(m => m?.miedo) : (miedos?.miedos || []);

  // Extract solutions from object format
  const solucionesList = soluciones ? [
    soluciones.solucion_1, soluciones.solucion_2, soluciones.solucion_3, 
    soluciones.solucion_4, soluciones.solucion_5
  ].filter(s => s?.que_probaron) : (soluciones?.productos_fallidos || []);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-lg border-b border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push(`/marcas/${productId}`)} className="text-gray-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">Deep Research</h1>
                <p className="text-sm text-gray-500">{product.name}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/marcas/${productId}`)}
              className="border-brand-accent text-brand-accent hover:bg-brand-accent/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Regenerar
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Perfil Demográfico */}
          {perfil && (
            <SectionCard title="Perfil Demográfico" icon={User} accentColor="brand-accent" className="lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-black/30 rounded-xl p-5">
                  <h3 className="text-xl font-bold text-brand-accent mb-1">
                    {perfil.nombre_avatar || perfil.nombre_arquetipo || 'Avatar'}
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    {perfil.edad && `${perfil.edad}`}
                    {perfil.genero && ` • ${perfil.genero}`}
                    {perfil.ubicacion && ` • ${perfil.ubicacion}`}
                  </p>
                  <p className="text-gray-300">
                    {perfil.descripcion_detallada || perfil.descripcion || 'Sin descripción'}
                  </p>
                </div>
                <div className="space-y-3">
                  {perfil.ocupacion && (
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase mb-1">Ocupación</p>
                      <p className="text-gray-300 text-sm">{perfil.ocupacion}</p>
                    </div>
                  )}
                  {perfil.nivel_socioeconomico && (
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase mb-1">Nivel Socioeconómico</p>
                      <p className="text-gray-300 text-sm">{perfil.nivel_socioeconomico}</p>
                    </div>
                  )}
                  {perfil.comportamiento_online && (
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase mb-1">Comportamiento Online</p>
                      <p className="text-gray-300 text-sm">{perfil.comportamiento_online}</p>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Problema Central */}
          {problema && (
            <SectionCard title="Problema Central" icon={AlertTriangle} accentColor="red-500">
              <div className="space-y-4">
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                  <h4 className="font-semibold text-red-400 mb-2">Dolor Principal</h4>
                  <p className="text-gray-300">{problema.pain_point_principal || problema.dolor_principal}</p>
                </div>
                {problema.sintomas_diarios && (
                  <div className="bg-black/20 rounded-lg p-4">
                    <h4 className="text-sm text-gray-500 uppercase mb-2">Síntomas Diarios</h4>
                    <p className="text-gray-400 text-sm">{problema.sintomas_diarios}</p>
                  </div>
                )}
                {problema.como_se_siente && (
                  <div className="bg-black/30 rounded-xl p-4 border-l-4 border-red-500">
                    <p className="text-gray-300 italic">"{problema.como_se_siente}"</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Top Emociones */}
          {emociones.length > 0 && (
            <SectionCard title="Emociones Dominantes" icon={Heart} accentColor="pink-500">
              <div className="flex flex-wrap gap-2">
                {emociones.map((emocion: string, i: number) => (
                  <Badge key={i} variant="danger">{emocion}</Badge>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Miedos Oscuros */}
          {miedosList.length > 0 && (
            <SectionCard title="Miedos Oscuros" icon={Skull} accentColor="purple-500" className="lg:col-span-2">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {miedosList.map((m: any, i: number) => (
                  <FearCard 
                    key={i} 
                    miedo={m.miedo || m} 
                    porQue={m.por_que_aterra} 
                    escenario={m.escenario_pesadilla || m.descripcion} 
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Impacto en Relaciones */}
          {relaciones && (
            <SectionCard title="Impacto en Relaciones" icon={Users} accentColor="pink-500">
              <div className="space-y-3">
                {relaciones.pareja && (
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs text-pink-400 uppercase mb-1">Pareja</p>
                    <p className="text-gray-300 text-sm">{relaciones.pareja}</p>
                  </div>
                )}
                {relaciones.amigos && (
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs text-pink-400 uppercase mb-1">Amigos</p>
                    <p className="text-gray-300 text-sm">{relaciones.amigos}</p>
                  </div>
                )}
                {relaciones.familia_extendida && (
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs text-pink-400 uppercase mb-1">Familia</p>
                    <p className="text-gray-300 text-sm">{relaciones.familia_extendida}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Citas Hirientes */}
          {citasHirientes.length > 0 && (
            <SectionCard title="Cosas Hirientes Que Les Dicen" icon={MessageSquare} accentColor="red-500">
              <div className="space-y-3">
                {citasHirientes.map((cita: any, i: number) => (
                  <QuoteCard key={i} persona={cita.quien || 'Alguien'} quote={cita.quote || ''} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Soluciones Fallidas */}
          {solucionesList.length > 0 && (
            <SectionCard title="Soluciones Fallidas" icon={XCircle} accentColor="orange-500" className="lg:col-span-2">
              <div className="grid gap-3 md:grid-cols-2">
                {solucionesList.map((s: any, i: number) => (
                  <SolutionCard 
                    key={i} 
                    nombre={s.que_probaron || s.nombre || 'Solución'} 
                    razon={s.por_que_fallo || s.razon_fallo} 
                    soundbite={s.soundbite} 
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Transformación */}
          {transformacion && (
            <SectionCard title="La Transformación Deseada" icon={Sparkles} accentColor="green-500">
              <div className="space-y-4">
                {(transformacion as any).resultados_genio_magico && (
                  <div>
                    <h4 className="text-sm text-green-400 uppercase mb-2">Resultados del "Genio Mágico"</h4>
                    <div className="space-y-2">
                      {(transformacion as any).resultados_genio_magico.map((r: string, i: number) => (
                        <div key={i} className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                          <p className="text-gray-300 text-sm">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {((transformacion as any).impacto_estatus_social || (transformacion as any).impacto_estatus) && (
                  <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                    <h4 className="font-semibold text-green-400 mb-2">Impacto en Estatus</h4>
                    <p className="text-gray-300">{(transformacion as any).impacto_estatus_social || (transformacion as any).impacto_estatus}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Creencias y Objeciones */}
          {creencias && (
            <SectionCard title="Creencias y Objeciones" icon={Brain} accentColor="blue-500">
              <div className="space-y-4">
                {((creencias as any).si_solo_tuviera) && (
                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-400 mb-2">"Si solo tuviera..."</h4>
                    <p className="text-gray-300">{(creencias as any).si_solo_tuviera}</p>
                  </div>
                )}
                {((creencias as any).objeciones_principales || (creencias as any).objeciones) && (
                  <div>
                    <h4 className="text-sm text-blue-400 uppercase mb-2">Objeciones</h4>
                    <div className="flex flex-wrap gap-2">
                      {((creencias as any).objeciones_principales || (creencias as any).objeciones || []).map((obj: string, i: number) => (
                        <Badge key={i}>{obj}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {((creencias as any).a_quien_culpan || (creencias as any).culpables) && (
                  <div>
                    <h4 className="text-sm text-blue-400 uppercase mb-2">A Quién Culpan</h4>
                    <div className="flex flex-wrap gap-2">
                      {((creencias as any).a_quien_culpan || (creencias as any).culpables || []).map((c: string, i: number) => (
                        <Badge key={i} variant="warning">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Lenguaje del Mercado */}
          {lenguaje && (
            <SectionCard title="Lenguaje del Mercado" icon={MessageSquare} accentColor="cyan-500" className="lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-3">
                {((lenguaje as any).frases_que_usan || (lenguaje as any).palabras_clave) && (
                  <div>
                    <h4 className="text-sm text-cyan-400 uppercase mb-3">Frases que Usan</h4>
                    <div className="flex flex-wrap gap-2">
                      {((lenguaje as any).frases_que_usan || (lenguaje as any).palabras_clave || []).map((f: string, i: number) => (
                        <span key={i} className="bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg text-sm">
                          "{f}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(lenguaje as any).palabras_que_resuenan && (
                  <div>
                    <h4 className="text-sm text-cyan-400 uppercase mb-3">Palabras que Resuenan</h4>
                    <div className="flex flex-wrap gap-2">
                      {(lenguaje as any).palabras_que_resuenan.map((p: string, i: number) => (
                        <Badge key={i} variant="success">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(lenguaje as any).terminos_que_evitar && (
                  <div>
                    <h4 className="text-sm text-cyan-400 uppercase mb-3">Términos a Evitar</h4>
                    <div className="flex flex-wrap gap-2">
                      {(lenguaje as any).terminos_que_evitar.map((t: string, i: number) => (
                        <Badge key={i} variant="danger">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
}
