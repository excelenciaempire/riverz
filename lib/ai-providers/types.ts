export type ProviderName = 'kie' | 'gemini';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:4' | '4:3' | '2:3' | '3:2';

export interface ProductContext {
  name: string;
  benefits?: string;
  description?: string;
  category?: string;
  brandTone?: string;
  language?: 'es' | 'en';
  researchData?: any;
}

export interface GenerateStaticAdInput {
  templateImageUrls: string[];
  productImageUrls: string[];
  productContext: ProductContext;
  aspectRatio: AspectRatio;
  userInstructions?: string;
}

export interface GenerateStaticAdResult {
  imageBase64: string;
  mimeType: string;
  modelId: string;
  provider: ProviderName;
}

export interface EditImageInput {
  sourceImageUrl: string;
  editInstructions: string;
  aspectRatio: AspectRatio;
}

export interface AdsImageProvider {
  readonly name: ProviderName;
  generateStaticAd(input: GenerateStaticAdInput): Promise<GenerateStaticAdResult>;
  editImage(input: EditImageInput): Promise<GenerateStaticAdResult>;
}

export type ProviderErrorCode =
  | 'rate_limit'
  | 'safety'
  | 'auth'
  | 'network'
  | 'timeout'
  | 'no_image'
  | 'unknown';

export class ProviderError extends Error {
  code: ProviderErrorCode;
  retriable: boolean;
  provider: ProviderName;
  userMessage: string;
  status?: number;

  constructor(opts: {
    code: ProviderErrorCode;
    message: string;
    userMessage?: string;
    retriable?: boolean;
    provider: ProviderName;
    status?: number;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.retriable = opts.retriable ?? (opts.code === 'rate_limit' || opts.code === 'network' || opts.code === 'timeout');
    this.provider = opts.provider;
    this.status = opts.status;
    this.userMessage = opts.userMessage || defaultUserMessage(opts.code, opts.provider);
  }
}

function defaultUserMessage(code: ProviderErrorCode, provider: ProviderName): string {
  const p = provider === 'gemini' ? 'Gemini' : 'kie.ai';
  switch (code) {
    case 'rate_limit': return `${p} alcanzó el límite de uso. Espera unos segundos e intenta de nuevo, o sube de tier en tu cuenta de Google.`;
    case 'safety': return `${p} bloqueó la generación por filtros de contenido. Reformula el prompt o cambia de proveedor.`;
    case 'auth': return `La API key de ${p} es inválida o fue revocada. Verifícala en Configuración → Integraciones.`;
    case 'network': return `Problema de red contactando a ${p}. Reintenta en unos segundos.`;
    case 'timeout': return `${p} tardó demasiado en responder. Reintenta o cambia de proveedor.`;
    case 'no_image': return `${p} respondió sin imagen. Reformula el prompt o reintenta.`;
    default: return `Error inesperado en ${p}. Reintenta o contacta soporte.`;
  }
}
