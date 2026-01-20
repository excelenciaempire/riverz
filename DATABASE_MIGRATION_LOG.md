# Database Migration Log - Draw to Edit

## Migración Ejecutada

**Fecha**: 2026-01-17 23:08:07 UTC  
**Database**: Supabase (znrabzpwgoiepcjyljdk)  
**Estado**: ✅ COMPLETADA EXITOSAMENTE

## Cambios Realizados

### 1. Pricing Config - Draw to Edit

```sql
INSERT INTO pricing_config (mode, credits_cost, is_active, description)
VALUES ('editar_foto_draw_edit', 100, true, 'Draw to Edit - Editor de imágenes con máscaras y IA')
ON CONFLICT (mode) DO UPDATE
SET credits_cost = 100, is_active = true, description = EXCLUDED.description, updated_at = NOW();
```

**Resultado**:
- ✅ Registro creado exitosamente
- ID: `9d389230-4256-41d5-a677-25a683784610`
- Mode: `editar_foto_draw_edit`
- Credits Cost: `100`
- Status: `active`
- Description: `Draw to Edit - Editor de imágenes con máscaras y IA`

## Configuración Actual de Pricing

| Modo | Créditos | Estado | Descripción |
|------|----------|--------|-------------|
| clips | 120 | ✅ | Generación de clips con Sora 2 o Kling |
| editar_foto_clonar | 110 | ✅ | Clonar estilo de imagen de referencia |
| editar_foto_combinar | 100 | ✅ | Combinar múltiples imágenes |
| **editar_foto_draw_edit** | **100** | ✅ | **Draw to Edit - Editor de imágenes con máscaras y IA** |
| editar_foto_editar | 90 | ✅ | Editar imagen existente con IA |
| editar_foto_crear | 80 | ✅ | Crear imagen desde prompt |
| face_swap | 150 | ✅ | Face swap con Wan 2.5 animate |
| mejorar_calidad_imagen | 70 | ✅ | Upscale de imagen a mayor resolución |
| mejorar_calidad_video | 200 | ✅ | Upscale de video a mayor resolución |
| static_ads_ideacion | 50 | ✅ | Generación de conceptos de ads con IA |
| ugc | 100 | ✅ | Generación de video UGC con avatar AI |

## Verificación

### Comando de Verificación
```sql
SELECT * FROM pricing_config WHERE mode = 'editar_foto_draw_edit';
```

### Resultado
```json
{
  "id": "9d389230-4256-41d5-a677-25a683784610",
  "mode": "editar_foto_draw_edit",
  "credits_cost": 100,
  "description": "Draw to Edit - Editor de imágenes con máscaras y IA",
  "is_active": true,
  "updated_at": "2026-01-17 23:08:07.472808+00"
}
```

## Estructura de la Tabla `pricing_config`

```sql
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR NOT NULL UNIQUE,
  credits_cost INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Notas Importantes

1. **Costo Consistente**: El costo de 100 créditos está alineado con otros modos de edición similares:
   - `editar_foto_combinar`: 100 créditos
   - `ugc`: 100 créditos

2. **Sin Rollback Necesario**: La migración es idempotente gracias a `ON CONFLICT (mode) DO UPDATE`, por lo que se puede ejecutar múltiples veces sin problemas.

3. **Generaciones Table**: No se requieren cambios en la tabla `generations` ya que el campo `type` es VARCHAR/TEXT y puede acomodar el nuevo valor `editar_foto_draw_edit`.

## API Endpoints Afectados

### Endpoint Principal
```
POST /api/editar-foto/draw-edit
```
- ✅ Consulta `pricing_config` para obtener costo
- ✅ Deduce 100 créditos antes de procesar
- ✅ Crea registro en `generations` con type `editar_foto_draw_edit`

### Endpoint de Status (Reutilizado)
```
GET /api/editar-foto/status/[jobId]
```
- ✅ Compatible con el nuevo tipo de generación
- ✅ No requiere cambios

## Rollback (Si Necesario)

En caso de necesitar revertir la migración:

```sql
-- Desactivar la configuración
UPDATE pricing_config 
SET is_active = false 
WHERE mode = 'editar_foto_draw_edit';

-- O eliminar completamente
DELETE FROM pricing_config 
WHERE mode = 'editar_foto_draw_edit';
```

## Próximos Pasos

1. ✅ Migración ejecutada
2. ✅ Configuración verificada
3. ⏳ Testing en producción
4. ⏳ Monitoreo de uso de créditos
5. ⏳ Análisis de performance

## Log de Cambios

| Fecha | Acción | Usuario | Estado |
|-------|--------|---------|--------|
| 2026-01-17 23:08:07 UTC | Inserción inicial | AI Assistant | ✅ Completado |

---

**Próxima Revisión**: Después de 1 semana de uso en producción  
**Responsable**: Equipo Riverz
