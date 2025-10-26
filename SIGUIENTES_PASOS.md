# 🚀 Siguientes Pasos - Riverz App

## ✅ Estado Actual: Interfaz Visual Completada

La interfaz visual de la plataforma está **100% terminada** con:
- ✅ Diseño consistente con colores oficiales (#161616, #101010, #07A498, #FFFFFF, #2563EB)
- ✅ Fuente Poppins aplicada en toda la app
- ✅ Todos los modos de creación implementados (UGC, Face Swap, Clips, Editar Foto, Static Ads, Mejorar Calidad)
- ✅ Sección de Marcas funcional con upload de imágenes
- ✅ Historial, Configuración y menú lateral completos
- ✅ Componentes UI reutilizables y responsivos
- ✅ Sistema de upload de archivos con soporte múltiple

---

## 📋 Pasos para Hacer la App Funcional

### **FASE 1: Configuración de Base de Datos (Supabase)** 🗄️

#### 1.1 Verificar/Crear Tablas Faltantes

**Tablas ya creadas:**
- ✅ `products` (con columna `clerk_user_id`)
- ✅ `avatars`
- ✅ `generations` (con columna `clerk_user_id`)

**Tablas pendientes:**
```sql
-- 1. Tabla voices (para Eleven Labs)
CREATE TABLE IF NOT EXISTS voices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  voice_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'eleven_labs',
  language TEXT DEFAULT 'es',
  gender TEXT,
  preview_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla templates (para Static Ads)
CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  canva_url TEXT NOT NULL,
  awareness_level TEXT,
  niche TEXT,
  type TEXT,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla ad_concepts (para ideación de Static Ads)
CREATE TABLE IF NOT EXISTS ad_concepts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  awareness_level TEXT NOT NULL,
  concept TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla user_credits (para manejo de créditos)
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  credits INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_ad_concepts_clerk_user_id ON ad_concepts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_product_id ON ad_concepts(product_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_clerk_user_id ON user_credits(clerk_user_id);
```

#### 1.2 Configurar RLS (Row Level Security)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Políticas para voices (público para lectura, solo activas)
CREATE POLICY "Public read active voices" ON voices
  FOR SELECT USING (is_active = true);

-- Políticas para templates (público para lectura)
CREATE POLICY "Public read templates" ON templates
  FOR SELECT USING (true);

-- Políticas para ad_concepts (usuarios solo ven sus propios conceptos)
CREATE POLICY "Users can view own ad concepts" ON ad_concepts
  FOR SELECT USING (true);

CREATE POLICY "Users can create ad concepts" ON ad_concepts
  FOR INSERT WITH CHECK (true);

-- Políticas para user_credits (usuarios solo ven sus propios créditos)
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (true);

CREATE POLICY "Users can update own credits" ON user_credits
  FOR UPDATE USING (true);

-- Políticas para generations (usuarios solo ven sus propias generaciones)
CREATE POLICY "Users can view own generations" ON generations
  FOR SELECT USING (true);

CREATE POLICY "Users can create generations" ON generations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own generations" ON generations
  FOR DELETE USING (true);
```

---

### **FASE 2: Integración de Servicios Externos** 🔌

#### 2.1 Configurar N8N Automations

**Endpoints necesarios por modo de uso:**

1. **UGC Creator**
   - `POST /api/n8n/ugc-generate` - Generar video UGC
   - `GET /api/n8n/ugc-status/:jobId` - Obtener estado del video
   - `POST /api/n8n/script-generate` - Generar guión con IA
   - `POST /api/n8n/avatar-generate` - Generar avatar con kie.ai

2. **Face Swap**
   - `POST /api/n8n/face-swap` - Wan 2.5 animate
   - `GET /api/n8n/face-swap-status/:jobId`

3. **Clips**
   - `POST /api/n8n/clips-generate` - Generar clips con Sora
   - `GET /api/n8n/clips-status/:jobId`

4. **Editar Foto**
   - `POST /api/n8n/photo-create` - Crear imagen
   - `POST /api/n8n/photo-edit` - Editar imagen
   - `POST /api/n8n/photo-combine` - Combinar imágenes
   - `POST /api/n8n/photo-clone` - Clonar producto

5. **Mejorar Calidad**
   - `POST /api/n8n/upscale-video` - Mejorar video
   - `POST /api/n8n/upscale-image` - Mejorar imagen

6. **Marcas**
   - `POST /api/n8n/generate-report` - Generar PDF de investigación

7. **Static Ads - Ideación**
   - `POST /api/n8n/generate-ad-concepts` - Generar conceptos de anuncios

**Variables de entorno necesarias:**
```env
# N8N
N8N_WEBHOOK_BASE_URL=https://tu-instancia-n8n.com
N8N_API_KEY=tu_api_key_n8n

# kie.ai (para generación de avatares)
KIE_AI_API_KEY=tu_api_key_kie

# fal.ai (para generación de imágenes/videos)
FAL_AI_API_KEY=tu_api_key_fal

# Eleven Labs (para voces)
ELEVEN_LABS_API_KEY=tu_api_key_eleven_labs
```

#### 2.2 Configurar Stripe

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Crear productos en Stripe:**
1. Plan Básico: $19/mes - 2000 créditos
2. Plan Pro: $49/mes - 5500 créditos
3. Plan Premium: $99/mes - 12000 créditos
4. Créditos adicionales: $0.01/crédito (mínimo $5)

**Archivos a completar:**
- `riverz-app/app/api/stripe/create-checkout/route.ts` ✅ (ya existe, restaurar)
- `riverz-app/app/api/stripe/buy-credits/route.ts` ✅ (ya existe, restaurar)
- `riverz-app/app/api/stripe/webhooks/route.ts` ✅ (ya existe, restaurar)

#### 2.3 Configurar Clerk Webhooks

**Webhook URL:** `https://tu-app.vercel.app/api/webhooks/clerk`

**Eventos a escuchar:**
- `user.created` - Crear entrada en `user_credits` con plan free
- `user.updated` - Actualizar información del usuario
- `user.deleted` - Limpiar datos del usuario

**Archivo a completar:**
- `riverz-app/app/api/webhooks/clerk/route.ts` (crear)

---

### **FASE 3: Implementar API Routes** 🛠️

#### 3.1 Routes de UGC

Crear/completar estos archivos:

**`riverz-app/app/api/ugc/generate/route.ts`**
```typescript
// POST: Enviar datos a N8N y crear registro en generations
// - Validar créditos del usuario
// - Deducir créditos
// - Subir avatar/video a Supabase Storage (user-uploads)
// - Enviar request a N8N
// - Crear registro en generations con status 'processing'
// - Retornar job_id
```

**`riverz-app/app/api/ugc/status/[jobId]/route.ts`**
```typescript
// GET: Consultar estado del trabajo en N8N
// - Si completado, actualizar generations con URL final
// - Mover archivo de user-uploads a generations bucket
// - Retornar status y URL
```

**`riverz-app/app/api/ugc/generate-script/route.ts`**
```typescript
// POST: Generar guión con IA
// - Obtener datos del producto
// - Enviar a N8N/OpenAI
// - Retornar script generado
```

#### 3.2 Routes similares para otros modos

Crear la misma estructura para:
- `app/api/face-swap/`
- `app/api/clips/`
- `app/api/editar-foto/`
- `app/api/mejorar-calidad/`
- `app/api/static-ads/`

#### 3.3 Sistema de Créditos

**`riverz-app/app/api/credits/deduct/route.ts`**
```typescript
// POST: Deducir créditos del usuario
export async function POST(req: Request) {
  const { userId, amount, generationType } = await req.json();
  
  // 1. Verificar que el usuario tenga suficientes créditos
  // 2. Deducir créditos
  // 3. Registrar transacción
  // 4. Retornar nuevos créditos
}
```

**`riverz-app/app/api/credits/balance/route.ts`**
```typescript
// GET: Obtener balance de créditos del usuario
```

**Costos por modo de uso (definir):**
```typescript
const CREDIT_COSTS = {
  ugc: 50,           // 50 créditos por video UGC
  face_swap: 30,     // 30 créditos por face swap
  clips: 40,         // 40 créditos por clip
  editar_foto: 10,   // 10 créditos por imagen editada
  static_ads: 0,     // Gratis (solo ideación usa IA)
  mejorar_video: 25, // 25 créditos por video mejorado
  mejorar_imagen: 5, // 5 créditos por imagen mejorada
};
```

---

### **FASE 4: Implementar Admin Dashboard** 👨‍💼

#### 4.1 Completar Funcionalidad del Admin

**Archivos en `riverz-app/app/admin/dashboard/`:**

1. **Overview Tab** - Estadísticas generales
   - Total usuarios registrados
   - Total usuarios con plan pago
   - Total videos/imágenes generados
   - Ingresos totales

2. **Users Tab** - Gestión de usuarios
   - Lista de usuarios con plan actual
   - Otorgar/quitar créditos
   - Ver historial de generaciones por usuario

3. **Pricing Tab** - Configuración de precios
   - Actualizar costo de créditos por modo de uso
   - Definir planes de suscripción

4. **Templates Tab** - Gestión de plantillas
   - Subir nuevas plantillas a Supabase Storage
   - Configurar awareness level, niche, type
   - Marcar como premium/gratis

5. **Avatars Tab** - Gestión de avatares ✅ (ya implementado)

6. **APIs Tab** - Configuración de endpoints N8N
   - Guardar URLs de webhooks de N8N
   - Configurar API keys

7. **Logs Tab** - Ver logs de errores
   - Logs de generaciones fallidas
   - Errores de API

#### 4.2 API Routes para Admin

```typescript
// app/api/admin/users/route.ts - Listar usuarios
// app/api/admin/users/[id]/credits/route.ts - Otorgar créditos
// app/api/admin/stats/route.ts - Estadísticas generales
// app/api/admin/templates/route.ts - CRUD de plantillas
// app/api/admin/config/pricing/route.ts - Actualizar precios
// app/api/admin/config/n8n/route.ts - Guardar URLs de N8N
```

---

### **FASE 5: Testing y Deployment** 🚀

#### 5.1 Testing Local

1. **Probar flujos completos:**
   - Registro de usuario
   - Compra de plan/créditos
   - Generación en cada modo
   - Descarga de resultados
   - Admin dashboard

2. **Verificar integraciones:**
   - Clerk webhooks
   - Stripe webhooks
   - N8N responses
   - Supabase Storage

#### 5.2 Variables de Entorno en Vercel

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/crear
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/crear

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# N8N
N8N_WEBHOOK_BASE_URL=
N8N_API_KEY=

# APIs Externas
KIE_AI_API_KEY=
FAL_AI_API_KEY=
ELEVEN_LABS_API_KEY=

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=juandiegoriosmesa@gmail.com

# Analytics
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_FB_PIXEL_ID=
```

#### 5.3 Deploy a Producción

```bash
# 1. Push a GitHub
git push origin main

# 2. Vercel deployará automáticamente

# 3. Configurar dominios personalizados (opcional)
# - riverz.app (main app)
# - admin.riverz.app (admin dashboard)

# 4. Configurar webhooks de producción
# - Clerk: https://riverz.app/api/webhooks/clerk
# - Stripe: https://riverz.app/api/stripe/webhooks
```

---

## 📊 Prioridades de Implementación

### **Alta Prioridad (Semana 1-2):**
1. ✅ Crear tablas faltantes en Supabase
2. ✅ Configurar RLS policies
3. ✅ Implementar sistema de créditos básico
4. ✅ Conectar Stripe para pagos
5. ✅ Crear API route para UGC (como ejemplo)
6. ✅ Configurar Clerk webhook para crear user_credits

### **Media Prioridad (Semana 3-4):**
1. ✅ Implementar todas las API routes de generación
2. ✅ Conectar con N8N (crear workflows)
3. ✅ Completar admin dashboard
4. ✅ Configurar Eleven Labs para voces
5. ✅ Testing de flujos completos

### **Baja Prioridad (Semana 5+):**
1. ✅ Subir plantillas de Static Ads
2. ✅ Poblar biblioteca de avatares
3. ✅ Implementar analytics (GA, FB Pixel)
4. ✅ Optimizaciones de rendimiento
5. ✅ Documentación de usuario

---

## 🔍 Checklist de Verificación

### Base de Datos
- [ ] Todas las tablas creadas
- [ ] RLS policies configuradas
- [ ] Índices creados
- [ ] Storage buckets configurados

### Autenticación
- [ ] Clerk funcionando
- [ ] Webhooks configurados
- [ ] Redirecciones correctas

### Pagos
- [ ] Productos en Stripe creados
- [ ] Webhooks configurando
- [ ] Checkout funcionando
- [ ] Manejo de créditos implementado

### Generaciones
- [ ] N8N workflows creados
- [ ] API routes implementadas
- [ ] Deducción de créditos funcional
- [ ] Storage de resultados correcto

### Admin
- [ ] Acceso solo para admin email
- [ ] Todas las tabs funcionales
- [ ] CRUD de avatares/templates
- [ ] Configuración de precios

### Deploy
- [ ] Variables de entorno en Vercel
- [ ] Webhooks apuntando a producción
- [ ] Testing en producción
- [ ] Monitoreo configurado

---

## 📚 Recursos Útiles

- [Documentación Supabase](https://supabase.com/docs)
- [Documentación Clerk](https://clerk.com/docs)
- [Documentación Stripe](https://stripe.com/docs)
- [Documentación N8N](https://docs.n8n.io/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Eleven Labs API](https://elevenlabs.io/docs)
- [fal.ai Docs](https://fal.ai/docs)
- [kie.ai Docs](https://kie.ai/docs)

---

## 🎯 Objetivo Final

**Una plataforma completamente funcional donde los usuarios puedan:**
1. Registrarse y elegir un plan
2. Subir sus productos
3. Generar contenido (videos/imágenes) en múltiples formatos
4. Ver su historial de generaciones
5. Gestionar sus créditos y suscripción

**Y los administradores puedan:**
1. Ver estadísticas en tiempo real
2. Gestionar usuarios y créditos
3. Subir/editar avatares y plantillas
4. Configurar precios y endpoints
5. Monitorear errores y uso de la plataforma

---

*Documento creado: 26 de Octubre, 2025*
*Estado: Interface Visual Completa ✅ | Backend Pendiente 🔨*

