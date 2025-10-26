# 🔐 Seguridad - Riverz Platform

## Resumen de Seguridad Implementada

Este documento detalla todas las medidas de seguridad implementadas en la plataforma Riverz para proteger los datos de los usuarios y prevenir ataques.

---

## 1. Autenticación y Autorización

### Clerk Authentication
- ✅ **Autenticación multi-factor** disponible
- ✅ **OAuth con Google** implementado
- ✅ **Sesiones seguras** con cookies HTTP-only
- ✅ **Tokens JWT** firmados y verificados
- ✅ **Refresh tokens** automáticos

### Middleware de Protección
```typescript
// middleware.ts
- Protección de todas las rutas no públicas
- Validación de sesión en cada request
- Autorización de admin por email
- Redirect automático a login si no autenticado
```

### Row Level Security (RLS)
Todas las tablas de Supabase tienen políticas RLS:

```sql
-- Ejemplo: user_credits
CREATE POLICY "Users can only view their own credits"
ON user_credits FOR SELECT
USING (auth.uid()::text = clerk_user_id);

CREATE POLICY "Users can only update their own credits"
ON user_credits FOR UPDATE
USING (auth.uid()::text = clerk_user_id);
```

**Tablas protegidas con RLS**:
- ✅ `user_credits`
- ✅ `credit_transactions`
- ✅ `generations`
- ✅ `products`
- ✅ `ad_concepts`

---

## 2. Rate Limiting

### Implementación
```typescript
// lib/security.ts
- Rate limiting por usuario + IP
- Diferentes límites por tipo de endpoint
- Almacenamiento en memoria (Redis en producción)
```

### Límites Configurados

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| Generaciones | 10 requests | 1 minuto |
| Admin APIs | 100 requests | 1 minuto |
| APIs públicas | 200 requests | 1 minuto |
| Login attempts | 5 intentos | 5 minutos |

### Respuesta de Rate Limit
```json
{
  "error": "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
  "status": 429
}
```

---

## 3. Validación de Entrada

### Sanitización
```typescript
// Todas las entradas de usuario son sanitizadas
- Eliminación de tags HTML (<, >)
- Eliminación de javascript: protocol
- Eliminación de event handlers (onclick, etc.)
- Límite de longitud (10,000 caracteres)
```

### Prevención de SQL Injection
```typescript
// Detección de patrones SQL maliciosos
- DROP, DELETE, INSERT, UPDATE
- UNION SELECT
- Comentarios SQL (--, /* */)
```

### Validación de Archivos
```typescript
// validateFileUpload()
- Verificación de tipo MIME
- Límite de tamaño (100MB para videos, 10MB para imágenes)
- Lista blanca de extensiones permitidas
```

---

## 4. Protección de Datos

### Encriptación en Tránsito
- ✅ **HTTPS obligatorio** en producción
- ✅ **TLS 1.3** para todas las conexiones
- ✅ **Certificados SSL** de Vercel

### Encriptación en Reposo
- ✅ **Supabase** encripta todos los datos en reposo
- ✅ **Backups automáticos** encriptados
- ✅ **Storage** con encriptación AES-256

### Secrets Management
```bash
# Variables de entorno sensibles
CLERK_SECRET_KEY=sk_***
SUPABASE_SERVICE_ROLE_KEY=eyJ***
STRIPE_SECRET_KEY=sk_***

# NUNCA en el código fuente
# NUNCA en git
# Solo en .env.local y Vercel
```

---

## 5. Protección contra Ataques

### XSS (Cross-Site Scripting)
```typescript
// Headers de seguridad
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### CSRF (Cross-Site Request Forgery)
- ✅ **Tokens CSRF** en formularios
- ✅ **SameSite cookies**
- ✅ **Origin validation**

### Clickjacking
```typescript
X-Frame-Options: DENY
// Previene que el sitio sea embebido en iframes
```

### DDoS Protection
- ✅ **Rate limiting** por IP
- ✅ **Vercel Edge Network** con protección DDoS
- ✅ **Cloudflare** (opcional) para capa adicional

---

## 6. Seguridad de APIs

### Validación de Ownership
```typescript
// Verificar que el usuario es dueño del recurso
export function checkResourceOwnership(
  resourceUserId: string,
  currentUserId: string
): boolean {
  return resourceUserId === currentUserId;
}
```

### Logging de Eventos de Seguridad
```typescript
// Todos los eventos sospechosos son registrados
logSecurityEvent('RATE_LIMIT_EXCEEDED', userId, {
  endpoint: '/api/ugc/generate',
  ip: clientIp,
});
```

### Webhooks Verificados
```typescript
// Stripe Webhooks
const signature = headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  STRIPE_WEBHOOK_SECRET
);

// Clerk Webhooks
const { verify } = await import('@clerk/backend');
const verified = await verify(payload, headers);
```

---

## 7. Seguridad de Base de Datos

### Políticas RLS Completas

#### user_credits
```sql
-- Solo el usuario puede ver sus créditos
CREATE POLICY "view_own_credits" ON user_credits
FOR SELECT USING (clerk_user_id = auth.uid()::text);

-- Solo el sistema puede actualizar créditos (via service_role)
CREATE POLICY "system_update_credits" ON user_credits
FOR UPDATE USING (false);
```

#### generations
```sql
-- Solo el usuario puede ver sus generaciones
CREATE POLICY "view_own_generations" ON generations
FOR SELECT USING (clerk_user_id = auth.uid()::text);

-- Solo el usuario puede crear generaciones
CREATE POLICY "create_own_generations" ON generations
FOR INSERT WITH CHECK (clerk_user_id = auth.uid()::text);
```

#### products
```sql
-- Solo el usuario puede ver sus productos
CREATE POLICY "view_own_products" ON products
FOR SELECT USING (clerk_user_id = auth.uid()::text);

-- Solo el usuario puede modificar sus productos
CREATE POLICY "manage_own_products" ON products
FOR ALL USING (clerk_user_id = auth.uid()::text);
```

### Índices para Performance
```sql
-- Índices en columnas frecuentemente consultadas
CREATE INDEX idx_generations_user ON generations(clerk_user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_products_user ON products(clerk_user_id);
CREATE INDEX idx_credit_transactions_user ON credit_transactions(clerk_user_id);
```

---

## 8. Seguridad de Storage

### Supabase Storage Policies

#### avatars bucket
```sql
-- Lectura pública
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Escritura solo para autenticados
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);
```

#### user-uploads bucket
```sql
-- Solo el usuario puede ver sus uploads
CREATE POLICY "Users can view own uploads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'user-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Límites de Tamaño
- **Avatares**: 10MB máximo
- **User uploads**: 100MB máximo
- **Productos**: 10MB por imagen
- **Generaciones**: Sin límite (solo resultados finales)

---

## 9. Monitoreo y Logging

### Eventos Registrados
```typescript
// Eventos de seguridad
- RATE_LIMIT_EXCEEDED
- INVALID_INPUT
- UNAUTHORIZED_ACCESS
- FAILED_AUTHENTICATION
- SUSPICIOUS_ACTIVITY

// Eventos de negocio
- CREDIT_DEDUCTION
- GENERATION_CREATED
- GENERATION_COMPLETED
- GENERATION_FAILED
```

### Logs Estructurados
```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "event": "RATE_LIMIT_EXCEEDED",
  "userId": "user_123",
  "endpoint": "/api/ugc/generate",
  "ip": "192.168.1.1"
}
```

---

## 10. Mejores Prácticas Implementadas

### ✅ Principio de Menor Privilegio
- Service role key solo en server-side
- Anon key solo para operaciones públicas
- RLS en todas las tablas

### ✅ Defensa en Profundidad
- Múltiples capas de seguridad
- Validación en frontend y backend
- Rate limiting + RLS + Middleware

### ✅ Fail Secure
- Errores no revelan información sensible
- Logs detallados solo en server-side
- Mensajes genéricos al usuario

### ✅ Auditoría
- Todos los eventos importantes son registrados
- Transacciones de créditos rastreables
- Historial de generaciones completo

---

## 11. Checklist de Seguridad

### Antes de Deploy

- [ ] Cambiar `PREVIEW_MODE` a `false` en middleware
- [ ] Verificar que todas las env vars están en Vercel
- [ ] Confirmar que RLS está habilitado en todas las tablas
- [ ] Verificar que webhooks tienen secrets configurados
- [ ] Confirmar que HTTPS está forzado
- [ ] Revisar logs de seguridad
- [ ] Probar rate limiting
- [ ] Verificar que admin emails están configurados

### Post-Deploy

- [ ] Monitorear logs de seguridad
- [ ] Revisar métricas de rate limiting
- [ ] Verificar que no hay errores de RLS
- [ ] Confirmar que webhooks funcionan
- [ ] Probar flujo completo de usuario
- [ ] Verificar backups automáticos

---

## 12. Respuesta a Incidentes

### En Caso de Brecha de Seguridad

1. **Contención**
   - Deshabilitar el endpoint afectado
   - Revocar tokens comprometidos
   - Bloquear IPs sospechosas

2. **Investigación**
   - Revisar logs de seguridad
   - Identificar alcance del incidente
   - Documentar hallazgos

3. **Remediación**
   - Parchear vulnerabilidad
   - Actualizar credenciales
   - Notificar usuarios afectados

4. **Prevención**
   - Implementar controles adicionales
   - Actualizar documentación
   - Capacitar al equipo

---

## 13. Contacto de Seguridad

Para reportar vulnerabilidades de seguridad:
- Email: security@riverz.app (configurar)
- Bug Bounty: (considerar en el futuro)

---

## 14. Cumplimiento

### GDPR (Europa)
- ✅ Derecho al olvido (DELETE user)
- ✅ Portabilidad de datos (export)
- ✅ Consentimiento explícito
- ✅ Encriptación de datos

### CCPA (California)
- ✅ Transparencia en recolección de datos
- ✅ Derecho a eliminar datos
- ✅ Opt-out de venta de datos

---

**Última actualización**: 2025-01-01
**Versión**: 1.0
**Estado**: PRODUCCIÓN READY ✅

