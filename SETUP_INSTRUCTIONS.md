# 🔐 Instrucciones de Configuración - Riverz Admin Dashboard

## 📋 Descripción General

Panel de administración completo para Riverz con acceso restringido y sincronización en tiempo real con Supabase.

## 🚀 Inicio Rápido

### 1. Instalación de Dependencias

```bash
cd admin-dashboard
npm install
```

### 2. Configuración de Variables de Entorno

Crea un archivo `.env.local` con:

```env
# Clerk (mismo que la app principal)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3VyZS1jaGltcC01MC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_KXrss7wuJVvmX60sUNQQu8CTpTrI89968XC5xwBqD0

# Supabase (mismo que la app principal)
NEXT_PUBLIC_SUPABASE_URL=https://znrabzpwgoiepcjyljdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjEwNTksImV4cCI6MjA3Njk5NzA1OX0.YhLraP1kaSTo0JdXjOLUBLCsvZXc-xFI-u4ITw0Tj5U

# Admin Emails (CRÍTICO - solo estos emails podrán acceder)
NEXT_PUBLIC_ADMIN_EMAILS=tu-email@gmail.com,admin2@riverz.com
```

### 3. Ejecutar en Desarrollo

```bash
npm run dev
```

Accede en: `http://localhost:3001`

### 4. Deploy a Vercel

```bash
vercel --prod
```

**IMPORTANTE:** Configura las variables de entorno en Vercel, especialmente `NEXT_PUBLIC_ADMIN_EMAILS`

## 🔒 Seguridad

### Control de Acceso

- **Autenticación requerida** via Clerk
- **Lista blanca de emails** en `NEXT_PUBLIC_ADMIN_EMAILS`
- Redirección automática si no autorizado
- Sin RLS bypass - usa las mismas credenciales anon

### Emails Autorizados

Solo los emails listados en `NEXT_PUBLIC_ADMIN_EMAILS` pueden acceder. Formato:

```
NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com,admin3@example.com
```

## 📊 Funcionalidades

### 1. Resumen General (Overview)
- **Total usuarios** registrados
- **Usuarios premium** (upgraded)
- **Suscripciones activas**
- **Videos e imágenes** generados
- **Productos registrados**
- **Créditos usados** total
- **Top 10 usuarios** por uso de créditos

**Auto-refresh:** 30 segundos

### 2. Usuarios
- **Lista completa** con filtros
- Búsqueda por email
- Filtro por plan (free, basic, pro, premium)
- Datos de cada usuario:
  - Email y Clerk ID
  - Plan actual
  - Créditos disponibles
  - Productos subidos
  - Total generaciones
  - Costo acumulado
  - Fecha de registro

**Auto-refresh:** 30 segundos

### 3. Generaciones
- **Todas las creaciones** de usuarios
- Filtros por:
  - Tipo (UGC, Face Swap, Clips, etc.)
  - Estado (pending, processing, completed, failed)
- Información:
  - Usuario
  - Tipo de generación
  - Estado actual
  - Costo en créditos
  - Link al resultado
  - Fecha y hora

**Auto-refresh:** 10 segundos

### 4. Plantillas (Static Ads)
- **CRUD completo** de plantillas
- Campos:
  - Nombre
  - URL de thumbnail
  - URL de Canva
  - Categoría
  - Nivel de consciencia (Unaware, Problem Aware, Solution Aware)
  - Nicho
- Vista en grid con preview
- Editar/Eliminar plantillas

### 5. Configuración de APIs N8N
- **URLs de POST** para cada modo:
  - UGC
  - Face Swap
  - Clips
  - Editar Foto (4 modos)
  - Mejorar Calidad (2 modos)
  - Generación de scripts
  - Generación de reportes
- **URLs de GET** para obtener resultados
- Guardar configuración por separado
- Descripción de cada endpoint

### 6. Logs del Sistema
- **Monitoreo en tiempo real** de todas las llamadas API
- Filtros:
  - Búsqueda por endpoint o email
  - Solo exitosos / solo errores
- Información:
  - Status code
  - Método HTTP
  - Endpoint
  - Usuario
  - Mensaje de error (si aplica)
  - Timestamp
- Resumen de logs mostrados

**Auto-refresh:** 5 segundos

## 🗄️ Datos en Supabase

El dashboard utiliza las siguientes tablas:

- `users` - Información de usuarios
- `products` - Productos de cada usuario
- `generations` - Todas las creaciones
- `templates` - Plantillas de Static Ads
- `admin_config` - Configuración de APIs N8N
- `api_logs` - Logs de todas las llamadas
- `avatars` - Avatares para UGC
- `voices` - Voces de Eleven Labs

## 🎨 Diseño

- **Colores consistentes** con la app principal
- **Poppins font** en toda la interfaz
- **Responsive** para desktop
- **Dark theme** profesional
- **Real-time updates** visuales

## 🔧 Tecnologías

- **Next.js 15** con App Router
- **TypeScript**
- **Tailwind CSS**
- **Clerk** (autenticación)
- **Supabase** (base de datos)
- **TanStack Query** (real-time data)
- **Sonner** (notificaciones)
- **Lucide React** (iconos)

## 📝 Notas Importantes

1. **Puerto diferente:** El admin dashboard corre en el puerto 3001 para no conflictuar con la app principal (3000)

2. **Sincronización:** Todos los datos se sincronizan automáticamente con la app principal

3. **Performance:** Los auto-refresh están optimizados para no sobrecargar el servidor

4. **Logs:** Los logs se limpian automáticamente después de 30 días (configurar en Supabase)

5. **Seguridad:** NUNCA expongas las Service Role Keys, usa solo Anon Keys

## 🚨 Troubleshooting

### No puedo acceder
- Verifica que tu email esté en `NEXT_PUBLIC_ADMIN_EMAILS`
- Asegúrate de estar autenticado en Clerk
- Revisa que las variables de entorno estén correctas

### Los datos no se actualizan
- Verifica la conexión a Supabase
- Revisa los logs de consola del navegador
- Confirma que las tablas existan en Supabase

### Error al guardar configuración de APIs
- Verifica que la tabla `admin_config` exista
- Confirma permisos de escritura en Supabase

## 📞 Soporte

Para problemas técnicos, revisa:
1. Logs en la consola del navegador
2. Logs en Supabase (Dashboard > Logs)
3. Variables de entorno configuradas correctamente

