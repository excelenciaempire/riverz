'use client';

import { useState } from 'react';
import { X, ChevronDown, ChevronUp, User, AlertTriangle, Skull, XCircle, Sparkles, Brain, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResearchData {
  perfil_demografico?: {
    nombre_arquetipo?: string;
    edad?: string;
    descripcion?: string;
  };
  problema_central?: {
    dolor_principal?: string;
    emociones?: string[];
  };
  miedos_oscuros?: {
    miedos?: Array<{ miedo?: string; descripcion?: string }>;
    impacto_relaciones?: string[];
    citas_hirientes?: Array<{ persona?: string; cita?: string }>;
  };
  soluciones_fallidas?: {
    productos_fallidos?: Array<{ nombre?: string; razon_fallo?: string; soundbite?: string }>;
    aversiones?: Array<{ tarea?: string; soundbite?: string }>;
  };
  transformacion?: {
    resultados?: string[];
    impacto_estatus?: string;
    soundbites_post?: Array<{ persona?: string; cita?: string }>;
  };
  creencias?: {
    si_solo_tuviera?: string;
    comodidad_problema?: string;
    culpables?: string[];
    objeciones?: string[];
  };
  lenguaje?: {
    palabras_clave?: string[];
  };
  raw_response?: string;
  parse_error?: boolean;
}

interface ResearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  researchData: ResearchData | null;
  productName: string;
}

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  accentColor = 'brand-accent'
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          isOpen ? "bg-gray-800/50" : "hover:bg-gray-800/30"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", `bg-${accentColor}/20`)}>
            <Icon className={cn("h-5 w-5", `text-${accentColor}`)} />
          </div>
          <span className="font-semibold text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ persona, quote }: { persona: string; quote: string }) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border-l-4 border-brand-accent">
      <p className="text-gray-300 italic">"{quote}"</p>
      <p className="text-sm text-gray-500 mt-1">— {persona}</p>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'danger' | 'success' }) {
  const colors = {
    default: 'bg-gray-700 text-gray-300',
    danger: 'bg-red-500/20 text-red-400',
    success: 'bg-green-500/20 text-green-400'
  };

  return (
    <span className={cn("px-3 py-1 rounded-full text-sm font-medium", colors[variant])}>
      {children}
    </span>
  );
}

export function ResearchPanel({ isOpen, onClose, researchData, productName }: ResearchPanelProps) {
  if (!isOpen) return null;

  // Handle parse error or raw response
  if (researchData?.parse_error || researchData?.raw_response) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6">
          <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
          
          <h2 className="text-2xl font-bold text-white mb-4">Research de {productName}</h2>
          <p className="text-yellow-500 mb-4">El research se generó pero no se pudo estructurar automáticamente.</p>
          <div className="bg-gray-800/50 rounded-lg p-4 text-gray-300 whitespace-pre-wrap text-sm">
            {researchData?.raw_response || 'Sin datos'}
          </div>
          
          <Button onClick={onClose} className="mt-6 w-full">Cerrar</Button>
        </div>
      </div>
    );
  }

  if (!researchData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6 text-center">
          <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sin Research</h2>
          <p className="text-gray-400 mb-6">Este producto aún no tiene research generado.</p>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-800 bg-[#0a0a0a]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800 bg-[#0a0a0a] p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Deep Research</h2>
            <p className="text-gray-400">{productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Perfil Demográfico */}
          {researchData.perfil_demografico && (
            <CollapsibleSection title="Perfil Demográfico" icon={User} defaultOpen={true}>
              <div className="bg-gradient-to-r from-brand-accent/10 to-transparent rounded-lg p-4">
                <h4 className="text-lg font-bold text-brand-accent">
                  {researchData.perfil_demografico.nombre_arquetipo || 'Avatar'}
                </h4>
                <p className="text-gray-400 text-sm mt-1">
                  Edad: {researchData.perfil_demografico.edad || 'No especificado'}
                </p>
                <p className="text-gray-300 mt-3">
                  {researchData.perfil_demografico.descripcion}
                </p>
              </div>
            </CollapsibleSection>
          )}

          {/* Problema Central */}
          {researchData.problema_central && (
            <CollapsibleSection title="Problema Central" icon={AlertTriangle} accentColor="red-500">
              <div className="space-y-4">
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                  <h4 className="font-semibold text-red-400 mb-2">Dolor Principal</h4>
                  <p className="text-gray-300">{researchData.problema_central.dolor_principal}</p>
                </div>
                
                {researchData.problema_central.emociones && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Emociones Dominantes</h4>
                    <div className="flex flex-wrap gap-2">
                      {researchData.problema_central.emociones.map((emocion, i) => (
                        <Badge key={i} variant="danger">{emocion}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Miedos Oscuros */}
          {researchData.miedos_oscuros && (
            <CollapsibleSection title="Miedos Oscuros" icon={Skull} accentColor="purple-500">
              <div className="space-y-4">
                {researchData.miedos_oscuros.miedos && (
                  <div className="space-y-2">
                    {researchData.miedos_oscuros.miedos.map((m, i) => (
                      <div key={i} className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                        <h5 className="font-medium text-purple-400">{m.miedo}</h5>
                        {m.descripcion && <p className="text-gray-400 text-sm mt-1">{m.descripcion}</p>}
                      </div>
                    ))}
                  </div>
                )}
                
                {researchData.miedos_oscuros.citas_hirientes && researchData.miedos_oscuros.citas_hirientes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Cosas Hirientes Que Les Dicen</h4>
                    <div className="space-y-2">
                      {researchData.miedos_oscuros.citas_hirientes.map((cita, i) => (
                        <QuoteCard key={i} persona={cita.persona || 'Alguien'} quote={cita.cita || ''} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Soluciones Fallidas */}
          {researchData.soluciones_fallidas && (
            <CollapsibleSection title="Soluciones Fallidas" icon={XCircle} accentColor="orange-500">
              <div className="space-y-4">
                {researchData.soluciones_fallidas.productos_fallidos && (
                  <div className="space-y-2">
                    {researchData.soluciones_fallidas.productos_fallidos.map((p, i) => (
                      <div key={i} className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                        <h5 className="font-medium text-orange-400">{p.nombre}</h5>
                        <p className="text-gray-400 text-sm mt-1">Por qué falló: {p.razon_fallo}</p>
                        {p.soundbite && (
                          <p className="text-gray-500 text-sm italic mt-2">"{p.soundbite}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Transformación */}
          {researchData.transformacion && (
            <CollapsibleSection title="La Transformación Deseada" icon={Sparkles} accentColor="green-500">
              <div className="space-y-4">
                {researchData.transformacion.resultados && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Resultados del "Genio Mágico"</h4>
                    <div className="space-y-2">
                      {researchData.transformacion.resultados.map((r, i) => (
                        <div key={i} className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                          <p className="text-gray-300">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {researchData.transformacion.impacto_estatus && (
                  <div className="bg-gradient-to-r from-green-500/10 to-transparent rounded-lg p-4">
                    <h4 className="font-semibold text-green-400 mb-2">Impacto en Estatus</h4>
                    <p className="text-gray-300">{researchData.transformacion.impacto_estatus}</p>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Creencias */}
          {researchData.creencias && (
            <CollapsibleSection title="Creencias y Objeciones" icon={Brain} accentColor="blue-500">
              <div className="space-y-4">
                {researchData.creencias.si_solo_tuviera && (
                  <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-400 mb-2">"Si solo tuviera..."</h4>
                    <p className="text-gray-300">{researchData.creencias.si_solo_tuviera}</p>
                  </div>
                )}
                
                {researchData.creencias.objeciones && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Objeciones Principales</h4>
                    <div className="space-y-2">
                      {researchData.creencias.objeciones.map((obj, i) => (
                        <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-gray-300">{obj}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {researchData.creencias.culpables && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">A Quién Culpan</h4>
                    <div className="flex flex-wrap gap-2">
                      {researchData.creencias.culpables.map((c, i) => (
                        <Badge key={i}>{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Lenguaje */}
          {researchData.lenguaje?.palabras_clave && (
            <CollapsibleSection title="Lenguaje del Mercado" icon={MessageSquare} accentColor="cyan-500">
              <div className="flex flex-wrap gap-2">
                {researchData.lenguaje.palabras_clave.map((palabra, i) => (
                  <span key={i} className="bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                    "{palabra}"
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-800 bg-[#0a0a0a] p-4">
          <Button onClick={onClose} className="w-full bg-brand-accent hover:bg-brand-accent/90">
            Cerrar Research
          </Button>
        </div>
      </div>
    </div>
  );
}
