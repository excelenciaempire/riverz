# ⚡ Quick Preview - 2 Minutos

## Pasos para Ver la App AHORA:

### 1️⃣ Crear .env.local

En la carpeta `riverz-app/`, crea un archivo llamado `.env.local` y copia esto:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_preview
CLERK_SECRET_KEY=sk_test_preview
NEXT_PUBLIC_SUPABASE_URL=https://preview.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=preview_key
SUPABASE_SERVICE_ROLE_KEY=preview_key
STRIPE_SECRET_KEY=sk_test_preview
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_preview
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2️⃣ Desactivar Autenticación (Temporal)

**Opción A - Renombrar archivos:**
```bash
cd riverz-app
mv middleware.ts middleware.ts.backup
mv middleware.preview.ts middleware.ts
```

**Opción B - Editar middleware.ts:**
Abre `riverz-app/middleware.ts` y reemplaza TODO con:

```typescript
import { NextResponse } from 'next/server';

export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
```

### 3️⃣ Ejecutar

```bash
cd riverz-app
npm run dev
```

### 4️⃣ Visitar

Abre tu navegador en: **http://localhost:3000**

---

## 🎨 URLs para Explorar

```
http://localhost:3000/crear                    → Menú principal (6 modos)
http://localhost:3000/crear/ugc                → UGC Creator
http://localhost:3000/crear/face-swap          → Face Swap
http://localhost:3000/crear/clips              → Clips
http://localhost:3000/crear/editar-foto        → Editar Foto (4 tabs)
http://localhost:3000/crear/static-ads         → Static Ads
http://localhost:3000/crear/mejorar-calidad    → Mejorar Calidad
http://localhost:3000/marcas                   → Productos
http://localhost:3000/historial                → Historial
http://localhost:3000/configuracion            → Configuración (3 tabs)
```

---

## ✅ Lo Que Verás

- ✨ Diseño completo con tus colores
- 🎨 Sidebar con navegación
- 📱 Interfaz responsive
- 🎯 Todos los formularios
- 🖼️ File uploads funcionando
- 🎭 Hover effects
- 📋 Tabs y filtros
- 🎨 Modals y dropdowns

---

## ❌ Lo Que NO Funcionará

- Login/registro (sin Clerk real)
- Guardado de datos (sin Supabase)
- Generación de contenido (sin N8N)
- Pagos (sin Stripe)

**Pero podrás ver TODA la interfaz funcionando!** 🎉

---

## 🔙 Restaurar Después del Preview

1. Elimina `.env.local` (o déjalo vacío)
2. Restaura `middleware.ts` original
3. Agrega tus keys reales cuando estés listo

