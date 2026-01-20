# Riverz - AI Content Generation Platform

Plataforma de generación de contenido con IA que permite crear videos UGC, face swaps, clips, editar fotos y más, con sistema de créditos y suscripciones.

## 🎯 Estado del Proyecto

### ✅ **Backend Funcional - 95% Completado**

El backend está completamente implementado y listo para usar. Solo falta configurar las integraciones externas (Stripe y N8N).

---

## 📋 Características Implementadas

### ✅ Sistema de Autenticación
- Clerk para autenticación de usuarios
- Webhook de sincronización con Supabase
- Protección de rutas con middleware
- Admin dashboard con autorización por email

### ✅ Sistema de Créditos y Pagos
- Gestión completa de créditos por usuario
- 4 planes de suscripción (Free, Básico, Pro, Premium)
- Compra de créditos adicionales
- Transacciones atómicas y registro de historial
- Integración con Stripe (listo para configurar)

### ✅ Modos de Generación
Todos los modos tienen sus API routes completas con:
- Validación de créditos
- Deducción automática
- Integración con N8N (listo para configurar)
- Polling de resultados
- Manejo de errores

**Modos disponibles:**
1. **UGC Creator** - Videos con avatares AI
2. **Face Swap** - Intercambio de rostros en videos
3. **Clips** - Generación de clips con Sora 2/Kling
4. **Editar Foto** (4 sub-modos):
   - Crear desde prompt
   - Editar con máscara
   - Combinar múltiples imágenes
   - Clonar estilo
5. **Mejorar Calidad** - Upscale de videos e imágenes
6. **Static Ads** - Plantillas y generación de conceptos

### ✅ Admin Dashboard
- **Stats**: Métricas completas de usuarios, generaciones, créditos
- **Users**: Gestión de usuarios, otorgar/quitar créditos
- **Generations**: Monitor de todas las generaciones
- **Templates**: CRUD completo de plantillas
- **Pricing**: Configuración de precios por modo
- **N8N Config**: Gestión de URLs de webhooks
- **Logs**: Visualización de errores
- **Avatars**: Gestión de avatares (ya funcional)

### ✅ Base de Datos (Supabase)
Todas las tablas creadas con RLS configurado:
- `user_credits` - Créditos y planes de usuarios
- `credit_transactions` - Historial de transacciones
- `generations` - Registro de generaciones
- `products` - Productos de usuarios (Marcas)
- `templates` - Plantillas de Static Ads
- `avatars` - Avatares para UGC
- `voices` - Catálogo de voces
- `ad_concepts` - Conceptos generados por IA
- `pricing_config` - Precios por modo
- `admin_config` - Configuración de N8N

---

## 🚀 Configuración Inicial

### 1. Clonar e Instalar

```bash
cd riverz-app
npm install
```

### 2. Variables de Entorno

Crea un archivo `.env.local` con las siguientes variables:

```env
# Clerk (Autenticación)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/crear
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/crear
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe (Pagos) - CONFIGURAR DESPUÉS
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=juandiegoriosmesa@gmail.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# N8N (Webhooks) - CONFIGURAR DESPUÉS
N8N_UGC_WEBHOOK_URL=
N8N_FACE_SWAP_WEBHOOK_URL=
N8N_CLIPS_WEBHOOK_URL=
N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL=
N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL=
N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL=
N8N_STATIC_ADS_IDEACION_WEBHOOK_URL=
N8N_MARCAS_REPORT_WEBHOOK_URL=
```

Ver `ENV_VARIABLES.md` para más detalles sobre cada variable.

### 3. Ejecutar en Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## 📝 Próximos Pasos (Configuración Externa)

### 1. Configurar Stripe

Sigue la guía completa en `STRIPE_SETUP.md`:

1. Crear cuenta en Stripe
2. Crear los 3 productos (Básico $19, Pro $49, Premium $99)
3. Obtener los Price IDs
4. Configurar webhook apuntando a `/api/stripe/webhooks`
5. Agregar las variables de entorno

**Tiempo estimado**: 30 minutos

### 2. Configurar Webhook de Clerk

1. Ve a Clerk Dashboard → Webhooks
2. Crea un nuevo endpoint: `https://tu-dominio.vercel.app/api/webhooks/clerk`
3. Selecciona eventos: `user.created`, `user.updated`, `user.deleted`
4. Copia el Signing Secret
5. Agrégalo a `CLERK_WEBHOOK_SECRET`

**Tiempo estimado**: 10 minutos

### 3. Configurar N8N (Opcional - Al Final)

Las URLs de N8N se pueden configurar más adelante desde el Admin Dashboard.

---

## 🧪 Testing

### Flujo Completo de Testing

1. **Registro de Usuario**
   ```
   - Registrarse con email
   - Verificar que se cree entrada en user_credits (0 créditos, plan free)
   ```

2. **Comprar Suscripción** (requiere Stripe configurado)
   ```
   - Ir a Configuración
   - Seleccionar plan Básico ($19/mes)
   - Completar pago con tarjeta de prueba: 4242 4242 4242 4242
   - Verificar que se agreguen 2000 créditos
   ```

3. **Generar Contenido**
   ```
   - Ir a Crear → UGC
   - Seleccionar avatar
   - Escribir guión
   - Seleccionar voz
   - Click en Generar
   - Verificar deducción de créditos (100 créditos)
   - Ver resultado (requiere N8N configurado)
   ```

4. **Admin Dashboard**
   ```
   - Ir a /admin con email autorizado
   - Ver estadísticas
   - Gestionar usuarios
   - Configurar precios
   ```

---

## 📁 Estructura del Proyecto

```
riverz-app/
├── app/
│   ├── (dashboard)/          # Páginas principales
│   │   ├── crear/            # Modos de generación
│   │   ├── marcas/           # Gestión de productos
│   │   ├── historial/        # Historial de generaciones
│   │   └── configuracion/    # Billing y configuración
│   ├── admin/                # Admin dashboard
│   │   ├── dashboard/        # Panel principal
│   │   └── unauthorized/     # Acceso denegado
│   └── api/                  # API Routes
│       ├── credits/          # Sistema de créditos
│       ├── stripe/           # Integración Stripe
│       ├── webhooks/         # Webhooks externos
│       ├── ugc/              # UGC generation
│       ├── face-swap/        # Face swap
│       ├── clips/            # Clips
│       ├── editar-foto/      # Editar foto (4 modos)
│       ├── mejorar-calidad/  # Mejorar calidad
│       └── admin/            # Admin APIs
├── components/
│   ├── admin/                # Componentes del admin
│   ├── layout/               # Layout components
│   └── ui/                   # UI components
├── lib/
│   ├── supabase/             # Supabase helpers
│   ├── n8n.ts                # N8N integration
│   └── stripe.ts             # Stripe helpers
└── middleware.ts             # Auth + Admin protection
```

---

## 🔐 Seguridad

- ✅ RLS (Row Level Security) en todas las tablas de Supabase
- ✅ Middleware de autenticación con Clerk
- ✅ Protección de rutas admin por email
- ✅ Validación de créditos antes de generaciones
- ✅ Transacciones atómicas para créditos
- ✅ Service role key solo en server-side
- ✅ Webhooks verificados con signatures

---

## 📊 Costos por Modo (Configurables)

| Modo | Créditos | Configurable |
|------|----------|--------------|
| UGC | 100 | ✅ Admin Dashboard |
| Face Swap | 150 | ✅ Admin Dashboard |
| Clips | 120 | ✅ Admin Dashboard |
| Editar Foto - Crear | 80 | ✅ Admin Dashboard |
| Editar Foto - Editar | 90 | ✅ Admin Dashboard |
| Editar Foto - Combinar | 100 | ✅ Admin Dashboard |
| Editar Foto - Clonar | 110 | ✅ Admin Dashboard |
| Mejorar Calidad - Video | 200 | ✅ Admin Dashboard |
| Mejorar Calidad - Imagen | 70 | ✅ Admin Dashboard |
| Static Ads - Ideación | 50 | ✅ Admin Dashboard |

---

## 🛠️ Tecnologías

- **Frontend**: Next.js 15.5.6, React 18, TypeScript, Tailwind CSS
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL + Realtime + Storage)
- **Payments**: Stripe
- **Automation**: N8N
- **Deployment**: Vercel

---

## 📚 Documentación Adicional

- `STRIPE_SETUP.md` - Guía completa de configuración de Stripe
- `ENV_VARIABLES.md` - Todas las variables de entorno
- `STORAGE_CONFIG.md` - Configuración de Supabase Storage
- `IMPLEMENTATION_PROGRESS.md` - Estado detallado de implementación

---

## 🐛 Troubleshooting

### Error: "Unauthorized" en APIs
- Verifica que estés autenticado con Clerk
- Revisa que las cookies estén habilitadas

### Error: "Insufficient credits"
- Verifica tu balance en la esquina superior derecha
- Compra créditos o suscríbete a un plan

### Error: "N8N endpoint not configured"
- Normal si aún no has configurado N8N
- Las generaciones quedarán en estado "processing"
- Configura las URLs en Admin Dashboard → API Config

### Admin Dashboard: "Forbidden"
- Verifica que tu email esté en `NEXT_PUBLIC_ADMIN_EMAILS`
- El email debe coincidir exactamente (case-insensitive)

---

## 🚀 Deploy a Producción

### Vercel

1. Conecta tu repositorio a Vercel
2. Configura todas las variables de entorno
3. Deploy automático en cada push a main

### Variables de Entorno en Vercel

Agrega todas las variables de `.env.local` en:
**Settings** → **Environment Variables**

Asegúrate de seleccionar: Production, Preview, Development

---

## 📞 Soporte

Para preguntas o issues, contacta al equipo de desarrollo.

---

## 📄 Licencia

Todos los derechos reservados © 2025 Riverz
