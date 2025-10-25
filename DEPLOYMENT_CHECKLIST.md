# 🚀 Riverz - Checklist de Deployment

## ✅ Checklist Completo: Lo Que Debes Proveer

### 📦 1. SUPABASE (Base de Datos)

**Tiempo estimado: 10-15 minutos**

- [ ] Crear cuenta en https://supabase.com
- [ ] Crear nuevo proyecto
- [ ] Ejecutar el SQL Schema:
  - [ ] Ir a SQL Editor
  - [ ] Copiar y pegar todo el contenido de `lib/supabase/schema.sql`
  - [ ] Ejecutar el script
- [ ] Crear Storage Buckets:
  - [ ] Ir a Storage
  - [ ] Crear bucket: `products`
  - [ ] Crear bucket: `avatars`
  - [ ] Crear bucket: `generations`
  - [ ] Hacer todos los buckets públicos
- [ ] Obtener credenciales (Project Settings → API):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`

---

### 🔐 2. CLERK (Autenticación)

**Tiempo estimado: 10 minutos**

- [ ] Crear cuenta en https://clerk.com
- [ ] Crear nueva aplicación
- [ ] Configurar OAuth:
  - [ ] Ir a "Social Connections"
  - [ ] Activar Google
  - [ ] Configurar credenciales de Google OAuth
- [ ] Configurar Webhook:
  - [ ] Ir a "Webhooks"
  - [ ] Agregar endpoint: `https://tu-dominio.com/api/webhooks/clerk`
  - [ ] Seleccionar eventos:
    - [x] user.created
    - [x] user.updated
    - [x] user.deleted
  - [ ] Copiar Signing Secret
- [ ] Obtener credenciales (API Keys):
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `CLERK_WEBHOOK_SECRET`

---

### 💳 3. STRIPE (Pagos)

**Tiempo estimado: 15-20 minutos**

- [ ] Crear cuenta en https://stripe.com
- [ ] Activar modo Test
- [ ] Crear Productos:
  
  **Plan Basic - $19/mes**
  - [ ] Ir a Products → Add Product
  - [ ] Nombre: "Riverz Basic"
  - [ ] Precio: $19 USD
  - [ ] Recurrente: Mensual
  - [ ] Copiar Price ID → `STRIPE_BASIC_PRICE_ID`
  
  **Plan Pro - $59/mes**
  - [ ] Crear producto
  - [ ] Nombre: "Riverz Pro"
  - [ ] Precio: $59 USD
  - [ ] Recurrente: Mensual
  - [ ] Copiar Price ID → `STRIPE_PRO_PRICE_ID`
  
  **Plan Premium - $99/mes**
  - [ ] Crear producto
  - [ ] Nombre: "Riverz Premium"
  - [ ] Precio: $99 USD
  - [ ] Recurrente: Mensual
  - [ ] Copiar Price ID → `STRIPE_PREMIUM_PRICE_ID`

- [ ] Configurar Webhook:
  - [ ] Ir a Developers → Webhooks
  - [ ] Add endpoint: `https://tu-dominio.com/api/stripe/webhooks`
  - [ ] Seleccionar eventos:
    - [x] checkout.session.completed
    - [x] customer.subscription.updated
    - [x] customer.subscription.deleted
  - [ ] Copiar Signing Secret → `STRIPE_WEBHOOK_SECRET`

- [ ] Obtener API Keys (Developers → API keys):
  - [ ] `STRIPE_SECRET_KEY` (Secret key)
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Publishable key)

---

### 🤖 4. N8N WEBHOOKS (11 URLs)

**Tiempo estimado: Depende de tus automatizaciones**

Necesitas proveer las URLs de tus workflows de N8N:

**Formato esperado:** `https://tu-n8n.com/webhook/[nombre-workflow]`

- [ ] `N8N_UGC_WEBHOOK_URL` → Generación de videos UGC
- [ ] `N8N_FACE_SWAP_WEBHOOK_URL` → Face Swap en videos
- [ ] `N8N_CLIPS_WEBHOOK_URL` → Generación de clips
- [ ] `N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL` → Crear imágenes con IA
- [ ] `N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL` → Editar imágenes
- [ ] `N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL` → Combinar imágenes
- [ ] `N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL` → Clonar imágenes
- [ ] `N8N_STATIC_ADS_IDEACION_WEBHOOK_URL` → Conceptos de anuncios
- [ ] `N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL` → Mejorar calidad de video
- [ ] `N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL` → Mejorar calidad de imagen
- [ ] `N8N_MARCAS_REPORT_WEBHOOK_URL` → Generar PDF de reporte

**Nota:** Puedes dejar estas vacías inicialmente y configurarlas después desde el Admin Dashboard.

**Formato de respuesta esperado de N8N:**

```json
// POST Response (inmediato)
{
  "success": true,
  "job_id": "unique-job-id-123"
}

// GET Response (polling)
{
  "status": "completed|processing|failed",
  "result_url": "https://cdn.example.com/result.mp4",
  "error": "error message if failed"
}
```

---

### 📊 5. ANALYTICS (Opcional)

**Tiempo estimado: 5 minutos**

- [ ] Google Analytics (opcional):
  - [ ] Crear propiedad en https://analytics.google.com
  - [ ] Obtener Measurement ID → `NEXT_PUBLIC_GA_ID`

- [ ] Facebook Pixel (opcional):
  - [ ] Crear pixel en https://business.facebook.com
  - [ ] Obtener Pixel ID → `NEXT_PUBLIC_FB_PIXEL_ID`

---

### 🌐 6. DEPLOYMENT (Vercel)

**Tiempo estimado: 10 minutos**

**Main App (riverz-app)**
- [ ] Push código a GitHub
- [ ] Crear proyecto en https://vercel.com
- [ ] Conectar repositorio
- [ ] Configurar como Next.js App
- [ ] Agregar todas las variables de entorno
- [ ] Deploy
- [ ] Copiar URL de producción → `NEXT_PUBLIC_APP_URL`
- [ ] Actualizar webhooks de Clerk y Stripe con URL de producción

**Admin Dashboard (admin-dashboard)** - Opcional
- [ ] Crear proyecto separado en Vercel
- [ ] Conectar a la carpeta `admin-dashboard`
- [ ] Agregar variables de entorno:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deploy

---

## 📝 Archivo .env.local Completo

Copia este template y rellena con tus valores:

```env
# ========================================
# CLERK AUTHENTICATION
# ========================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# ========================================
# SUPABASE DATABASE
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx

# ========================================
# STRIPE PAYMENTS
# ========================================
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_BASIC_PRICE_ID=price_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_PREMIUM_PRICE_ID=price_xxxxx

# ========================================
# N8N WEBHOOKS
# ========================================
N8N_UGC_WEBHOOK_URL=https://tu-n8n.com/webhook/ugc
N8N_FACE_SWAP_WEBHOOK_URL=https://tu-n8n.com/webhook/face-swap
N8N_CLIPS_WEBHOOK_URL=https://tu-n8n.com/webhook/clips
N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL=https://tu-n8n.com/webhook/editar-crear
N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL=https://tu-n8n.com/webhook/editar-editar
N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL=https://tu-n8n.com/webhook/editar-combinar
N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL=https://tu-n8n.com/webhook/editar-clonar
N8N_STATIC_ADS_IDEACION_WEBHOOK_URL=https://tu-n8n.com/webhook/static-ads
N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL=https://tu-n8n.com/webhook/mejorar-video
N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL=https://tu-n8n.com/webhook/mejorar-imagen
N8N_MARCAS_REPORT_WEBHOOK_URL=https://tu-n8n.com/webhook/marcas-report

# ========================================
# ANALYTICS (Opcional)
# ========================================
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=123456789

# ========================================
# APP URL
# ========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Cambiar a tu dominio en producción: https://riverz.com
```

---

## 🔧 Instalación de Dependencias

Antes de iniciar, ejecuta:

```bash
# Main App
cd riverz-app
npm install clsx svix date-fns

# Admin Dashboard (si lo vas a usar)
cd ../admin-dashboard
npm install @supabase/supabase-js lucide-react
```

---

## ✅ Testing Checklist

Una vez configurado todo, verifica:

- [ ] Usuario puede registrarse con email/password
- [ ] Usuario puede registrarse con Google OAuth
- [ ] Usuario aparece en Supabase tabla `users`
- [ ] Puede navegar a todas las páginas
- [ ] Créditos se muestran en el sidebar
- [ ] Puede crear un producto en Marcas
- [ ] Puede acceder a Configuración
- [ ] Puede ver planes de suscripción
- [ ] Stripe checkout funciona (modo test)
  - Usar tarjeta de prueba: `4242 4242 4242 4242`
- [ ] Suscripción se actualiza en Supabase
- [ ] Puede cambiar idioma (ES/EN)

---

## 📞 URLs de Webhooks para Configurar

Después del deployment, actualiza estas URLs:

**Clerk:**
- Webhook URL: `https://tu-dominio.vercel.app/api/webhooks/clerk`

**Stripe:**
- Webhook URL: `https://tu-dominio.vercel.app/api/stripe/webhooks`

---

## 🎯 Orden Recomendado de Configuración

1. ✅ Instalar dependencias
2. ✅ Configurar Supabase (base de datos primero)
3. ✅ Configurar Clerk (autenticación)
4. ✅ Probar localmente con `npm run dev`
5. ✅ Configurar Stripe (pagos)
6. ✅ Deploy a Vercel
7. ✅ Actualizar webhooks con URLs de producción
8. ✅ Configurar N8N (puede ser gradual)
9. ✅ Testing completo

---

## 💡 Tips

- **Desarrollo local:** Usa ngrok para webhooks de Clerk/Stripe
- **N8N URLs:** Pueden agregarse una por una según las vayas construyendo
- **Stripe Test Mode:** Usa durante desarrollo, cambia a Live cuando estés listo
- **Admin Dashboard:** Es opcional, puedes gestionarlo todo desde Supabase directamente

---

## 🆘 Problemas Comunes

**Error de autenticación:**
- Verifica que las keys de Clerk estén correctas
- Revisa que el webhook esté configurado

**Error de Supabase:**
- Verifica que el schema SQL se ejecutó correctamente
- Revisa que las policies RLS permitan las operaciones

**Stripe no funciona:**
- Verifica que estés en modo test
- Usa la tarjeta de prueba: 4242 4242 4242 4242

**N8N no responde:**
- Verifica que las URLs sean accesibles
- Revisa el formato de respuesta JSON

---

## 📚 Documentación de Referencia

- [Next.js Docs](https://nextjs.org/docs)
- [Clerk Setup](https://clerk.com/docs/quickstarts/nextjs)
- [Supabase Setup](https://supabase.com/docs/guides/getting-started)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Vercel Deployment](https://vercel.com/docs)

---

**¡Listo!** Con este checklist tienes todo lo necesario para poner Riverz en producción 🚀

