# Configuración de Supabase Storage

## Buckets Configurados

### 1. **avatars**
- **Propósito:** Imágenes de avatares para UGC Creator
- **Límite de tamaño:** Sin límite
- **Tipos permitidos:** JPEG, PNG, WebP
- **Acceso:**
  - 🔍 Lectura: Público
  - ➕ Crear: Usuarios autenticados
  - ✏️ Actualizar: Usuarios autenticados
  - 🗑️ Eliminar: Usuarios autenticados

### 2. **user-uploads**
- **Propósito:** Uploads temporales de usuarios (videos, imágenes para procesamiento)
- **Límite de tamaño:** 50 MB
- **Tipos permitidos:** JPEG, PNG, WebP, MP4, QuickTime
- **Acceso:**
  - 🔍 Lectura: Público
  - ➕ Crear: Usuarios autenticados
  - ✏️ Actualizar: Usuarios autenticados
  - 🗑️ Eliminar: Usuarios autenticados

### 3. **products**
- **Propósito:** Imágenes de productos subidas en la sección "Marcas"
- **Límite de tamaño:** 10 MB
- **Tipos permitidos:** JPEG, PNG, WebP
- **Acceso:**
  - 🔍 Lectura: Público
  - ➕ Crear: Usuarios autenticados
  - ✏️ Actualizar: Usuarios autenticados
  - 🗑️ Eliminar: Usuarios autenticados

### 4. **generations**
- **Propósito:** Resultados finales de generaciones (videos e imágenes generadas)
- **Límite de tamaño:** 100 MB
- **Tipos permitidos:** JPEG, PNG, WebP, MP4
- **Acceso:**
  - 🔍 Lectura: Público
  - ➕ Crear: Usuarios autenticados
  - ✏️ Actualizar: Usuarios autenticados
  - 🗑️ Eliminar: Usuarios autenticados

## Uso en el Código

### Importar configuración
```typescript
import { STORAGE_BUCKETS, uploadFile } from '@/lib/supabase/upload';
import { ALLOWED_MIME_TYPES } from '@/lib/supabase/storage';
```

### Subir un archivo
```typescript
const result = await uploadFile({
  bucket: 'USER_UPLOADS',
  file: myFile,
  allowedMimeTypes: ALLOWED_MIME_TYPES.IMAGES,
  onProgress: (progress) => console.log(`${progress}%`),
});

if (result.success) {
  console.log('URL:', result.url);
} else {
  console.error('Error:', result.error);
}
```

### Validar archivo antes de subir
```typescript
import { validateFileSize, validateMimeType, ALLOWED_MIME_TYPES } from '@/lib/supabase/storage';

if (!validateFileSize(file, 'PRODUCTS')) {
  toast.error('Archivo demasiado grande (máx 10MB)');
  return;
}

if (!validateMimeType(file, ALLOWED_MIME_TYPES.IMAGES)) {
  toast.error('Solo se permiten imágenes');
  return;
}
```

## Mapeo de Buckets por Modo de Uso

| Modo de Uso | Bucket para Uploads | Bucket para Resultados |
|-------------|-------------------|----------------------|
| UGC Creator | `user-uploads` (avatares subidos) | `generations` |
| Face Swap | `user-uploads` | `generations` |
| Clips | `user-uploads` | `generations` |
| Editar Foto | `user-uploads` | `generations` |
| Static Ads | N/A | N/A (solo plantillas) |
| Mejorar Calidad | `user-uploads` | `generations` |
| Marcas | `products` | N/A |

## Políticas de Seguridad (RLS)

Todas las políticas están configuradas para:
- ✅ Permitir a **todos los usuarios autenticados** subir, actualizar y eliminar archivos
- ✅ Permitir lectura pública de todos los archivos
- ✅ No hay restricción por "owner" - cualquier usuario autenticado puede gestionar cualquier archivo

Esto facilita el uso compartido y la gestión de archivos entre usuarios y el sistema.

## Admin Dashboard

Para el admin dashboard, se usa una ruta API especial (`/api/admin/upload-avatar`) que utiliza la `SUPABASE_SERVICE_ROLE_KEY` para bypasear RLS y tener permisos completos.

## Notas Importantes

1. **Limpieza de archivos temporales:** Los archivos en `user-uploads` deberían ser limpiados periódicamente (implementar cron job)
2. **Validación del lado del cliente:** Siempre validar tamaño y tipo antes de subir
3. **Nombres únicos:** Todos los archivos se suben con nombres únicos generados automáticamente
4. **URLs públicas:** Todos los buckets son públicos, las URLs son accesibles sin autenticación

