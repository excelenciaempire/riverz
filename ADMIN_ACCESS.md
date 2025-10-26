# Admin Dashboard

Panel de administración completo creado en: `../admin-dashboard/`

Ver `ADMIN_DASHBOARD_COMPLETE.md` en la raíz del proyecto para instrucciones completas.

## Acceso Rápido

```bash
cd ../admin-dashboard
.\install.ps1
npm run dev
# http://localhost:3001
```

## Características

- ✅ Resumen general con todas las métricas
- ✅ Gestión de usuarios completa
- ✅ Monitor de generaciones en tiempo real
- ✅ CRUD de plantillas
- ✅ Configuración de APIs N8N
- ✅ Visualizador de logs
- ✅ Seguridad con lista blanca de emails
- ✅ Auto-refresh en tiempo real

## URL del Dashboard

- Desarrollo: http://localhost:3001
- Producción: Configurar en Vercel

## Configuración Requerida

Actualizar `NEXT_PUBLIC_ADMIN_EMAILS` en `.env.local` del admin dashboard con los emails autorizados.

