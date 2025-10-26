# Variables de Entorno - Riverz

Este documento lista todas las variables de entorno necesarias para ejecutar Riverz.

## 📋 Configuración Completa

Copia estas variables a tu archivo `.env.local`:

```env
# ==============================================
# CLERK (Autenticación)
# ==============================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/crear
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/crear

# Webhook de Clerk (para sincronizar usuarios con Supabase)
CLERK_WEBHOOK_SECRET=whsec_...

# ==============================================
# SUPABASE (Base de Datos y Storage)
# ==============================================
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ==============================================
# STRIPE (Pagos y Suscripciones)
# ==============================================
# API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Price IDs - Suscripciones
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...

# ==============================================
# N8N (Automatizaciones)
# ==============================================
# URLs de Webhooks para cada modo de generación
# DEJAR VACÍO hasta que configures tus automatizaciones en N8N
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

# ==============================================
# ADMIN (Acceso al Dashboard de Administrador)
# ==============================================
# Emails autorizados para acceder al admin dashboard (separados por coma)
NEXT_PUBLIC_ADMIN_EMAILS=juandiegoriosmesa@gmail.com

# ==============================================
# APLICACIÓN
# ==============================================
# URL de tu aplicación (para redirects de Stripe)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ==============================================
# ANALYTICS (Opcional)
# ==============================================
# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...

# Facebook Pixel
NEXT_PUBLIC_FB_PIXEL_ID=...

# ==============================================
# MODO PREVIEW (Desarrollo)
# ==============================================
# Establecer en 'true' para permitir preview de UI sin APIs configuradas
NEXT_PUBLIC_PREVIEW_MODE=false
```

---

## 🔑 Cómo Obtener Cada Variable

### CLERK
1. Ve a [clerk.com](https://clerk.com) y crea un proyecto
2. En **API Keys**, copia:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
3. En **Webhooks**, crea un endpoint y copia:
   - `CLERK_WEBHOOK_SECRET`

### SUPABASE
1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En **Settings** → **API**, copia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### STRIPE
Sigue la guía completa en `STRIPE_SETUP.md`

### N8N
Las URLs de N8N se configurarán más adelante cuando tengas tus automatizaciones listas.

### ADMIN
Agrega tu email para tener acceso al dashboard de administrador.

---

## ✅ Variables Requeridas vs Opcionales

### ✅ REQUERIDAS (para funcionalidad básica)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ADMIN_EMAILS`
- `NEXT_PUBLIC_APP_URL`

### ⚠️ REQUERIDAS (para pagos)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_BASIC_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PREMIUM_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `CLERK_WEBHOOK_SECRET`

### 🔄 REQUERIDAS (para generaciones)
- Todas las variables `N8N_*_WEBHOOK_URL`

### 📊 OPCIONALES
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_FB_PIXEL_ID`
- `NEXT_PUBLIC_PREVIEW_MODE`

---

## 🚀 Configuración en Vercel

Para agregar variables de entorno en Vercel:

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Agrega cada variable con su valor
4. Selecciona los entornos: **Production**, **Preview**, **Development**
5. Click en **Save**
6. Redeploy tu aplicación

---

## 🔒 Seguridad

- **NUNCA** compartas las keys `SECRET` o `SERVICE_ROLE` públicamente
- **NUNCA** subas el archivo `.env.local` a Git
- Las variables `NEXT_PUBLIC_*` son visibles en el cliente, solo úsalas para datos públicos
- Rota tus keys periódicamente

