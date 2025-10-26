# Riverz Admin Dashboard

Panel de administración para Riverz con acceso restringido por email.

## 🚀 Características

- **Resumen General**: Estadísticas en tiempo real
- **Gestión de Usuarios**: Vista completa de todos los usuarios
- **Monitoreo de Generaciones**: Seguimiento de todas las creaciones
- **Administrador de Plantillas**: CRUD completo de plantillas
- **Configuración de APIs**: URLs de N8N para cada modo
- **Visualizador de Logs**: Monitoreo en tiempo real de errores

## 📦 Instalación

```bash
cd admin-dashboard
npm install
```

## 🔐 Configuración

1. Copia `.env.local.example` a `.env.local`
2. Configura las variables de entorno:
   - Clerk keys
   - Supabase keys
   - **NEXT_PUBLIC_ADMIN_EMAILS**: Emails autorizados (separados por comas)

## 🏃 Ejecutar

```bash
npm run dev
```

El dashboard estará disponible en `http://localhost:3001`

## 🔒 Seguridad

- Solo usuarios con emails en `NEXT_PUBLIC_ADMIN_EMAILS` pueden acceder
- Autenticación via Clerk
- Redirección automática si no autorizado

## 📊 Datos en Tiempo Real

- Auto-refresh cada 30 segundos en stats
- Auto-refresh cada 10 segundos en generaciones
- Auto-refresh cada 5 segundos en logs
