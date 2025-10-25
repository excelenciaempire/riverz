# 👀 Guía de Preview - Riverz App

## Opción 1: Preview Rápido (Sin Configuración)

### Paso 1: Instalar Dependencias

```bash
cd riverz-app
npm install
npm install clsx svix date-fns
```

### Paso 2: Crear .env.local Vacío

Crea el archivo `.env.local` en la raíz de `riverz-app/` con valores temporales:

```env
# Clerk (temporales para preview)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_preview
CLERK_SECRET_KEY=sk_test_preview
CLERK_WEBHOOK_SECRET=whsec_preview

# Supabase (temporales para preview)
NEXT_PUBLIC_SUPABASE_URL=https://preview.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=preview_key
SUPABASE_SERVICE_ROLE_KEY=preview_key

# Stripe (temporales para preview)
STRIPE_SECRET_KEY=sk_test_preview
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_preview
STRIPE_WEBHOOK_SECRET=whsec_preview

# N8N (vacíos, no se usan en preview)
N8N_UGC_WEBHOOK_URL=
N8N_FACE_SWAP_WEBHOOK_URL=
N8N_CLIPS_WEBHOOK_URL=
N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL=
N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL=
N8N_STATIC_ADS_IDEACION_WEBHOOK_URL=
N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL=
N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL=
N8N_MARCAS_REPORT_WEBHOOK_URL=

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_FB_PIXEL_ID=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Paso 3: Ejecutar el Servidor

```bash
npm run dev
```

### Paso 4: Abrir en el Navegador

Abre: **http://localhost:3000**

---

## ✅ Lo Que PUEDES Ver (Sin APIs):

### Páginas de Autenticación
- `/sign-in` - Página de inicio de sesión (diseño completo)
- `/sign-up` - Página de registro (diseño completo)

**Nota:** No podrás iniciar sesión realmente, pero verás el diseño completo con los colores de marca.

### Para Ver las Páginas Internas

Sin autenticación real, tendrás que **comentar temporalmente el middleware**:

**Edita `riverz-app/middleware.ts`:**

```typescript
// Comenta todo el contenido y agrega esto temporalmente:
export default function middleware() {
  // Preview mode - sin autenticación
}

export const config = {
  matcher: [],
};
```

Luego reinicia el servidor (`Ctrl+C` y `npm run dev`)

### Ahora PUEDES Ver:

#### 🎨 Menú Principal
- **http://localhost:3000/crear** - Menú con las 6 opciones de creación

#### 📹 Modos de Creación
- **http://localhost:3000/crear/ugc** - UGC Creator (completo)
- **http://localhost:3000/crear/face-swap** - Face Swap
- **http://localhost:3000/crear/clips** - Clips
- **http://localhost:3000/crear/editar-foto** - Editar Foto (4 modos)
- **http://localhost:3000/crear/static-ads** - Static Ads
- **http://localhost:3000/crear/mejorar-calidad** - Mejorar Calidad

#### 📦 Otras Páginas
- **http://localhost:3000/marcas** - Gestión de productos
- **http://localhost:3000/historial** - Historial de generaciones
- **http://localhost:3000/configuracion** - Configuración (3 tabs)
- **http://localhost:3000/editor** - Editor (placeholder)
- **http://localhost:3000/inspiracion** - Galería de inspiración

---

## 📱 Lo Que Verás:

✅ **Diseño completo** con tus colores de marca
✅ **Sidebar** con navegación
✅ **Todos los formularios** y controles
✅ **Tabs y filtros** funcionando
✅ **File uploads** con preview
✅ **Botones y modales** interactivos
✅ **Responsive design** (prueba en móvil)

❌ **No funcionará:**
- Autenticación real
- Guardado de datos
- Generación de contenido
- Pagos con Stripe
- Webhooks de N8N

---

## 🎨 Preview de Componentes Individuales

Puedes navegar directamente a cada página para ver los diseños:

### Crear (Menú Principal)
```
http://localhost:3000/crear
```
Verás las 6 tarjetas con hover effects.

### UGC Creator
```
http://localhost:3000/crear/ugc
```
Verás:
- 3 tabs (Biblioteca, Subir Imagen, Generar)
- Campos de script y voz
- Vista previa del resultado
- Botón de generar

### Face Swap
```
http://localhost:3000/crear/face-swap
```
Verás:
- Upload de video fuente
- Upload de imagen de personaje
- Selectores de resolución y formato
- Checkbox de consentimiento

### Configuración
```
http://localhost:3000/configuracion
```
Verás:
- 3 tabs: Billing, Cuenta, Notificaciones
- Planes de suscripción
- Configuración de idioma
- Preferencias

---

## 🔧 Opción 2: Preview Completo (Con Clerk Básico)

Si quieres ver la autenticación funcionando:

### 1. Crear Cuenta Clerk (Gratis)

1. Ve a https://clerk.com
2. Crea cuenta
3. Crea nueva aplicación
4. Copia las keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

### 2. Actualizar .env.local

Reemplaza solo las keys de Clerk con las reales.

### 3. Restaurar Middleware

Descomenta el `middleware.ts` original.

### 4. Reiniciar

```bash
npm run dev
```

Ahora podrás:
- ✅ Registrarte con email/password
- ✅ Iniciar sesión
- ✅ Ver el sidebar con tu info
- ✅ Navegar todas las páginas autenticado

---

## 📸 Screenshots Recomendados

Navega y toma screenshots de:

1. `/sign-in` - Login page
2. `/crear` - Menú principal
3. `/crear/ugc` - UGC Creator
4. `/crear/editar-foto` - Editar Foto (tabs)
5. `/marcas` - Productos (empty state)
6. `/configuracion` - Settings (tabs)
7. `/historial` - History page

---

## 🐛 Errores Esperados (Normal)

Verás estos errores en consola, es normal sin las APIs reales:

- ❌ "Failed to fetch user" - Normal sin Supabase
- ❌ "Invalid Clerk key" - Si usas keys temporales
- ❌ Webpack warnings - Puedes ignorarlos

---

## 💡 Tips para el Preview

1. **Usa Chrome DevTools** - Inspecciona responsive design
2. **Prueba Mobile View** - Toggle device toolbar (F12)
3. **Haz Screenshots** - Para documentación
4. **Prueba Hover Effects** - Pasa el mouse sobre botones/cards
5. **Abre Tabs** - En configuración, editar foto, static ads

---

## 🎯 Checklist de Preview

- [ ] Instalé todas las dependencias
- [ ] Creé .env.local (temporal o real)
- [ ] Ejecuté `npm run dev`
- [ ] Visité `/sign-in` - veo el diseño
- [ ] Visité `/crear` - veo las 6 opciones
- [ ] Probé cada modo de creación
- [ ] Vi la página de configuración
- [ ] Probé el responsive design
- [ ] Todo se ve con los colores correctos (#07A498, #161616, etc.)

---

## ⚡ Quick Start

```bash
# 1. Ir a la carpeta
cd riverz-app

# 2. Instalar (si no lo hiciste)
npm install

# 3. Crear .env.local vacío
touch .env.local
# (Luego pega el contenido del template arriba)

# 4. Correr
npm run dev

# 5. Abrir
# http://localhost:3000
```

---

**¡Listo!** Ahora puedes ver todo el trabajo realizado 🎨

¿Algún problema? Avísame y te ayudo a resolverlo.

