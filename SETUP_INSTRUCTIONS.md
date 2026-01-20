# 🚀 Instrucciones de Configuración

## ⚠️ IMPORTANTE: Ejecutar SQLs en Supabase

Para que el sistema funcione correctamente, **DEBES ejecutar los siguientes scripts SQL** en tu base de datos de Supabase:

---

## 📦 1. Storage Bucket `public-images`

**Archivo:** `lib/supabase/public-images-storage-setup.sql`

Este script crea el bucket necesario para subir y almacenar imágenes de plantillas y productos.

### Pasos:

1. Ve a tu **Supabase Dashboard** → Tu proyecto
2. Click en **SQL Editor** (en el menú lateral izquierdo)
3. Click en **New Query**
4. Copia y pega TODO el contenido del archivo `lib/supabase/public-images-storage-setup.sql`
5. Click en **Run** (o presiona `Ctrl + Enter`)
6. Verifica que aparezca el mensaje: ✅ "Success. No rows returned"

**¿Qué hace este SQL?**
- Crea el bucket `public-images` (público para lectura)
- Configura políticas de acceso:
  - Lectura pública para todos
  - Escritura/actualización/eliminación solo para usuarios autenticados

---

## 🤖 2. Tabla de Prompts IA

**Archivo:** `lib/supabase/ai-prompts-table.sql`

Este script crea la tabla para gestionar todos los prompts del sistema y pre-carga 5 prompts listos para usar.

### Pasos:

1. Ve a tu **Supabase Dashboard** → Tu proyecto
2. Click en **SQL Editor**
3. Click en **New Query**
4. Copia y pega TODO el contenido del archivo `lib/supabase/ai-prompts-table.sql`
5. Click en **Run**
6. Verifica que aparezca: ✅ "Success. 5 rows returned" (los 5 prompts insertados)

**¿Qué hace este SQL?**
- Crea la tabla `ai_prompts` con columnas:
  - `id`: UUID único
  - `key`: Identificador único del prompt (ej: 'static_ads_clone')
  - `name`: Nombre descriptivo
  - `category`: Categoría (image_generation, analysis, etc.)
  - `prompt_text`: El texto del prompt que se envía a la IA
  - `description`: Descripción de qué hace
  - `variables`: Array JSON de variables que usa
  - `is_active`: Si está activo o no
- Crea índices para búsquedas rápidas
- Configura Row Level Security (RLS)
- Inserta 5 prompts pre-configurados:
  1. **Static Ads Clone**: Clonación de templates con productos
  2. **Product Analysis**: Análisis de productos para generar prompts
  3. **UGC Generation**: Generación de contenido estilo usuario
  4. **Face Swap**: Instrucciones para intercambio de rostros
  5. **Quality Enhancement**: Mejora de calidad de imágenes

---

## ✅ Verificación

### Verificar Bucket de Storage:

1. En Supabase Dashboard → **Storage**
2. Deberías ver el bucket **`public-images`**
3. Intenta subir una imagen de prueba para verificar

### Verificar Tabla de Prompts:

1. En Supabase Dashboard → **Table Editor**
2. Busca la tabla **`ai_prompts`**
3. Deberías ver 5 registros (prompts) pre-cargados
4. Verifica que todos tienen `is_active = true`

---

## 🎨 Acceder al Panel de Prompts

Una vez ejecutados los SQLs:

1. Ve a la app: `https://riverz.vercel.app/admin/dashboard`
2. Inicia sesión con tu cuenta de admin
3. Verás un nuevo tab: **"Prompts IA"**
4. Ahí podrás:
   - ✏️ Editar los prompts existentes
   - ➕ Crear nuevos prompts
   - 🗑️ Eliminar prompts
   - 👁️ Activar/desactivar prompts
   - 📝 Documentar variables que usa cada prompt

---

## 📋 Prompts Pre-configurados

### 1. Static Ads Clone (`static_ads_clone`)
**Categoría:** Generación de Imágenes  
**Uso:** API `/api/static-ads/process-queue`  
**Variables:** `productName`, `productImage`, `templateName`, `templateThumbnail`

Genera prompts optimizados para clonar templates de Static Ads con productos específicos.

### 2. Product Analysis (`product_analysis`)
**Categoría:** Análisis  
**Uso:** API `/api/products/analyze`  
**Variables:** `productName`, `productDescription`, `productImage`, `productCategory`

Analiza información de productos para generar prompts profesionales.

### 3. UGC Generation (`ugc_generation`)
**Categoría:** Generación de Imágenes  
**Uso:** Futuro - para contenido UGC  
**Variables:** `productName`, `setting`, `demographic`, `mood`

Genera imágenes estilo User-Generated Content auténticas.

### 4. Face Swap (`face_swap_instruction`)
**Categoría:** Edición de Imágenes  
**Uso:** Futuro - para face swap  
**Variables:** `sourceImage`, `targetImage`, `preserveExpression`

Instrucciones para intercambios de rostros naturales.

### 5. Quality Enhancement (`quality_enhancement`)
**Categoría:** Edición de Imágenes  
**Uso:** Futuro - para mejora de calidad  
**Variables:** `targetQuality`, `preserveOriginal`, `outputFormat`

Mejora la calidad técnica de imágenes.

---

## 🔄 Sistema de Fallback

Si por alguna razón la base de datos no está disponible, el sistema usa **prompts hardcoded de fallback** automáticamente. Esto asegura que la aplicación siempre funcione.

Los fallbacks están definidos en: `lib/get-ai-prompt.ts`

---

## 🛠️ Editar Prompts

### Desde el Admin Dashboard:

1. Ve a **Admin Dashboard** → **Prompts IA**
2. Click en **Editar** en el prompt que quieras modificar
3. Modifica el texto del prompt
4. Agrega/quita variables si es necesario
5. Click en **Actualizar**
6. ✅ El cambio se aplica **inmediatamente** en todas las APIs

### Mejores Prácticas:

- 📝 Documenta bien la descripción de cada prompt
- 🏷️ Lista todas las variables que usa
- 🧪 Prueba los cambios antes en un prompt duplicado
- 💾 Si haces cambios importantes, guarda el texto anterior
- ✅ Mantén `is_active = true` para prompts en uso

---

## 🚨 Solución de Problemas

### Error: "Bucket not found"
❌ No ejecutaste el SQL de `public-images-storage-setup.sql`  
✅ Ejecuta el SQL del paso 1

### Error: "Table ai_prompts does not exist"
❌ No ejecutaste el SQL de `ai-prompts-table.sql`  
✅ Ejecuta el SQL del paso 2

### Las imágenes no se suben en Templates Manager
❌ El bucket no está creado o no tiene permisos correctos  
✅ Re-ejecuta el SQL de storage y verifica policies

### Los prompts no aparecen en el admin
❌ La tabla está vacía o no se insertaron los prompts  
✅ Re-ejecuta el SQL de ai_prompts, específicamente la sección INSERT

---

## 📞 Soporte

Si después de seguir estos pasos sigues teniendo problemas:

1. Verifica los logs en Vercel
2. Abre la consola del navegador (F12) y busca errores
3. Verifica que las políticas RLS de Supabase estén bien configuradas
4. Asegúrate de que tu usuario tiene permisos de admin

---

## ✨ ¡Listo!

Una vez ejecutados ambos SQLs, el sistema estará completamente funcional:

- ✅ Subida de templates funcionando
- ✅ Eliminación de templates con cleanup
- ✅ Gestión centralizada de prompts IA
- ✅ APIs usando prompts dinámicos
- ✅ Fallback automático si hay problemas

**¡Ahora puedes personalizar todos los prompts desde el admin sin tocar código!** 🎉
