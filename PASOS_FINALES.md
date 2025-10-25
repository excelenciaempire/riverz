# 🚀 Pasos Finales para Activar Riverz

## ✅ Lo Que Ya Está Hecho:

1. ✅ **Base de datos Supabase** - 8 tablas creadas
2. ✅ **Datos de ejemplo** - 5 avatares, 4 voces, 3 templates
3. ✅ **Credenciales de Clerk** - Agregadas
4. ✅ **Credenciales de Supabase** - Agregadas
5. ✅ **Errores corregidos** - App lista para funcionar

---

## 📝 PASO 1: Crear el archivo .env.local

**En la carpeta `riverz-app/`, crea un archivo llamado `.env.local`** y pega este contenido:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsubW9taXMtcHJvamVjdC5yZXBsaXQuYXBwJA
CLERK_SECRET_KEY=sk_live_bkjgelFfbYh0gXnJAtnkGE2Syt9QR5vIbhXnNDSgWx
CLERK_WEBHOOK_SECRET=whsec_XXXXXX

NEXT_PUBLIC_SUPABASE_URL=https://znrabzpwgoiepcjyljdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjEwNTksImV4cCI6MjA3Njk5NzA1OX0.YhLraP1kaSTo0JdXjOLUBLCsvZXc-xFI-u4ITw0Tj5U
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQyMTA1OSwiZXhwIjoyMDc2OTk3MDU5fQ.P1dmmv-n4CmNsUl1BEDtYgLUaSrgw3h6MDu4H7lRlzg

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📝 PASO 2: Configurar Webhook de Clerk

1. Ve a https://dashboard.clerk.com/apps
2. Selecciona tu aplicación
3. En el menú lateral, ve a **"Webhooks"**
4. Haz clic en **"Add Endpoint"**
5. Agrega esta URL: `http://localhost:3000/api/webhooks/clerk`
   - (Usa ngrok si estás en local, o tu dominio de Vercel si ya deployaste)
6. Selecciona estos 3 eventos:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
7. Guarda y copia el **"Signing Secret"**
8. Pega el secret en tu `.env.local` en la línea `CLERK_WEBHOOK_SECRET`

---

## 📝 PASO 3: Configurar Google OAuth en Clerk

1. En Clerk Dashboard, ve a **"Social Connections"**
2. Activa **"Google"**
3. Sigue las instrucciones para configurar OAuth de Google
4. Guarda los cambios

---

## 📝 PASO 4: Reiniciar el Servidor

```bash
# Detén el servidor actual (Ctrl+C en la terminal)
# Luego ejecuta:
cd "C:\Users\Nicolas\Desktop\Riverz App\riverz-app"
npm run dev
```

---

## 🎉 ¡Ahora Puedes Probar!

Visita: **http://localhost:3000**

### Lo Que Funcionará:

✅ **Registro de usuario** - Sign up con email/password o Google
✅ **Inicio de sesión** - Sign in funcional
✅ **Usuario se sincroniza** - Automáticamente se crea en Supabase
✅ **Navegación** - Todo el sidebar funcional
✅ **Créditos** - Se mostrarán en tiempo real (iniciarás con 0)
✅ **Crear productos** - En la sección Marcas
✅ **Ver avatares** - En UGC Creator
✅ **Ver voces** - En UGC Creator
✅ **Ver templates** - En Static Ads

### Lo Que AÚN NO Funcionará:

❌ **Generar contenido** - Necesitas las URLs de N8N
❌ **Pagos** - Necesitas configurar Stripe
❌ **PDF Reports** - Necesita N8N

---

## 🔧 Si Usas ngrok para Webhooks Locales:

```bash
# En otra terminal:
ngrok http 3000

# Copia la URL que te da (ej: https://abc123.ngrok.io)
# Úsala en Clerk webhook: https://abc123.ngrok.io/api/webhooks/clerk
```

---

## 📊 Próximos Pasos Opcionales:

1. **Configurar Stripe** - Para habilitar suscripciones y compra de créditos
2. **Agregar N8N URLs** - Para habilitar generación de contenido
3. **Deploy a Vercel** - Para tener la app en producción

---

## 🎯 Testing Rápido:

1. ✅ Abre http://localhost:3000
2. ✅ Haz clic en "Sign Up"
3. ✅ Regístrate con tu email
4. ✅ Deberías ver el dashboard con el sidebar
5. ✅ Ve a "Marcas" y crea un producto
6. ✅ Ve a "Crear" → "UGC" y verás los 5 avatares
7. ✅ Navega por todas las páginas

---

**¿Todo claro? ¿Quieres que te ayude con algo más?** 🚀

