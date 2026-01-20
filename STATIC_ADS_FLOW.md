# Flujo Completo de Static Ads Clonación

## 📋 Resumen del Flujo

El usuario selecciona plantillas de anuncios → elige un producto → genera clones usando IA (Gemini + Nano Banana Pro) → obtiene resultados guardados en su proyecto.

---

## 🔄 Flujo Paso a Paso

### **1. Usuario Selecciona Plantillas**
**Ubicación:** `/crear/static-ads` (page.tsx)

- Usuario navega a la sección "Static Ads"
- Ve plantillas organizadas por filtros (nivel de consciencia, nicho, tipo)
- **Selecciona múltiples plantillas** haciendo clic en ellas
  - Cada clic agrega/quita la plantilla de `selectedTemplateIds[]`
  - Aparece un checkmark visual en cada plantilla seleccionada

### **2. Aparece Barra Flotante Inferior**
**Componente:** Bottom floating bar (línea 447-487)

Cuando `selectedTemplateIds.length > 0`:
- Muestra contador de plantillas seleccionadas
- **Dropdown de productos** mejorado:
  - Lista todos los productos del usuario
  - Muestra "No hay productos creados" si está vacío
  - El usuario selecciona el producto que quiere usar para clonar
- Botón "Confirmar y Clonar"

### **3. Usuario Confirma y Abre Modal de Nombre**
**Trigger:** Click en "Confirmar y Clonar" → `initiateCloneProcess()`

- Valida que haya un producto seleccionado
- Abre modal pidiendo **nombre del proyecto**
- Usuario ingresa nombre (ej: "Campaña Black Friday 2026")

### **4. Usuario Confirma Clonación**
**Trigger:** Click en "Comenzar Clonación" → `confirmClone()`

**Frontend Actions:**
1. Cierra modal de nombre
2. Abre **popup de progreso** con loading spinner
3. Simula progreso (10% → 100% con intervals)
4. Hace POST a `/api/static-ads/clone`

---

## 🔌 Backend API: `/api/static-ads/clone`

**Archivo:** `app/api/static-ads/clone/route.ts`

### Input
```json
{
  "templateIds": ["template1", "template2", "template3"],
  "productId": "product-abc",
  "projectName": "Campaña Black Friday 2026"
}
```

### Proceso

1. **Autenticación**
   - Verifica userId con Clerk

2. **Fetch Data**
   - Obtiene datos completos del **producto**:
     - name, images, benefits, website, price
   - Obtiene datos de **templates**:
     - id, name, thumbnail_url, category, awareness_level

3. **Deducción de Créditos**
   - Costo: 50 créditos por imagen
   - Llama a `deductCreditsForGeneration()` con tipo `'static_ad_generation'`
   - Si falla → devuelve 402 (créditos insuficientes)

4. **Crear Proyecto**
   ```sql
   INSERT INTO projects (clerk_user_id, name, type, status)
   VALUES (userId, projectName, 'static_ads', 'processing')
   ```

5. **Crear Generations (uno por template)**
   ```sql
   INSERT INTO generations (
     clerk_user_id,
     type,
     status,
     cost,
     project_id,
     input_data
   ) VALUES (
     userId,
     'static_ad_generation',
     'pending_analysis', -- Estado inicial
     50,
     projectId,
     {
       templateId,
       productId,
       templateName,
       templateThumbnail, -- URL de la imagen de plantilla
       productName,
       productImage -- URL de la imagen del producto
     }
   )
   ```

### Output
```json
{
  "project": {
    "id": "project-123",
    "name": "Campaña Black Friday 2026",
    "status": "processing"
  },
  "generations": [/* array de generation records */]
}
```

**Frontend:** Redirecciona a `/crear/static-ads/historial/[projectId]`

---

## 📊 Página de Proyecto: `/crear/static-ads/historial/[id]`

**Archivo:** `app/(dashboard)/crear/static-ads/historial/[id]/page.tsx`

### Al Cargar

1. **Query de Proyecto**
   - Fetches `/api/projects/[id]` cada 3 segundos
   - Verifica si hay generations con status:
     - `'pending_analysis'`
     - `'analyzing'`
     - `'generating'`
     - `'processing'`

2. **Trigger Queue Processing** (useEffect)
   ```typescript
   useEffect(() => {
     if (hasPendingGenerations) {
       fetch('/api/static-ads/process-queue', {
         method: 'POST',
         body: JSON.stringify({ projectId })
       });
     }
   }, [project]);
   ```

---

## 🤖 Backend Queue: `/api/static-ads/process-queue`

**Archivo:** `app/api/static-ads/process-queue/route.ts`

Este endpoint procesa las generations en dos fases:

### **FASE 1: Análisis con Gemini 3 Pro**

**Status:** `'pending_analysis'` → `'generating'`

Para cada generation en `pending_analysis` (máximo 3 por request):

1. **Construye Mensaje Multi-Modal para Gemini**
   ```typescript
   messages = [
     {
       role: 'system',
       content: `Eres un experto AI Prompt Engineer para publicidad de e-commerce.
                 Tu objetivo es escribir un prompt perfecto para "Nano Banana Pro".
                 Tienes una Imagen de Producto y una Imagen de Plantilla (referencia de estilo).
                 Debes crear un prompt que coloque el Producto en el contexto/estilo de la Plantilla.
                 Reemplaza el producto genérico en la plantilla con el Producto específico del usuario.
                 Ten en cuenta el estilo de texto overlay de la plantilla (describe dónde debería haber espacio para texto).
                 Output SOLO el texto del prompt.`
     },
     {
       role: 'user',
       content: [
         { type: 'text', text: `Product: ${productName}` },
         { type: 'image_url', image_url: { url: productImage } },
         { type: 'text', text: `Template Style: ${templateName}` },
         { type: 'image_url', image_url: { url: templateThumbnail } }
       ]
     }
   ]
   ```

2. **Llama a Gemini 3 Pro**
   - `analyzeWithGemini3Pro(messages)` → returns optimized prompt
   - Ejemplo de prompt generado:
     ```
     "High-quality product photography of [Product Name] vitamins bottle placed on a 
     marble countertop with morning sunlight. Clean, minimalist composition with soft 
     shadows. Room for text overlay in upper third. Professional e-commerce style, 
     bright and inviting atmosphere. Focus on product detail and premium feel."
     ```

3. **Inicia Tarea de Generación en KIE.ai**
   - `createKieTask(generationModel, { prompt })`
   - Obtiene `taskId` de KIE.ai

4. **Actualiza Generation**
   ```sql
   UPDATE generations
   SET 
     status = 'generating',
     input_data = {
       ...previous_data,
       generatedPrompt: optimized_prompt,
       generationTaskId: kie_task_id
     }
   WHERE id = generation_id
   ```

### **FASE 2: Polling de Nano Banana Pro**

**Status:** `'generating'` → `'completed'`

Para cada generation en `generating`:

1. **Poll KIE.ai Task**
   ```typescript
   taskResult = await getKieTaskResult(taskId)
   ```

2. **Verifica Status**
   - Si `taskResult.status === 'SUCCESS'`:
     ```sql
     UPDATE generations
     SET 
       status = 'completed',
       result_url = taskResult.result.url
     WHERE id = generation_id
     ```
   
   - Si `taskResult.status === 'FAILED'`:
     ```sql
     UPDATE generations
     SET 
       status = 'failed',
       error_message = 'Generation failed'
     WHERE id = generation_id
     ```

   - Si `taskResult.status === 'PROCESSING'`:
     - No hace nada, espera al siguiente poll (3s después)

### Output
```json
{
  "success": true,
  "processedAnalysis": 3,
  "processedPolling": 2,
  "remainingPending": 5
}
```

---

## 🎨 Visualización de Resultados

**Ubicación:** `/crear/static-ads/historial/[id]`

### Grid de Imágenes

- Muestra todas las generations del proyecto
- Cada imagen tiene:
  - Preview de `result_url`
  - Checkbox para selección múltiple
  - Botón "Editar con IA" (hover overlay)

### Estados Visuales

- **pending_analysis / analyzing**: Placeholder con loading
- **generating**: Placeholder con loading
- **completed**: Imagen completa
- **failed**: Error indicator

### Acciones Disponibles

1. **Seleccionar y Descargar**
   - Multi-selección con checkmarks
   - Botón "Descargar (N)" abre cada imagen en nueva pestaña

2. **Editar con IA** (Drawer lateral)
   - Usuario escribe instrucciones de edición
   - Genera nueva versión usando otro endpoint
   - Puede guardar o deshacer

---

## 🔑 Configuración Requerida

### 1. Storage Bucket
Ya está configurado: usa `public-images` bucket en Supabase

### 2. Base de Datos
Tablas necesarias:
- `projects`
- `generations`
- `products`
- `templates`
- `pricing_config` (con entrada para `static_ad_generation`)

### 3. Variables de Entorno
```env
KIE_API_URL=https://kie.ai/api
KIE_API_KEY=your_key
GEMINI_API_KEY=your_key
```

### 4. Modelos IA
- **Gemini 3 Pro**: Análisis multi-modal y generación de prompts
- **Nano Banana Pro** (via KIE.ai): Generación de imágenes

---

## 📈 Resumen de Estados

```
pending_analysis → analyzing → generating → completed
                                         ↘ failed
```

**pending_analysis**: Esperando análisis de Gemini
**analyzing**: (opcional, skip directo a generating)
**generating**: Task creado en KIE.ai, esperando resultado
**completed**: Imagen generada exitosamente
**failed**: Error en cualquier paso

---

## ✅ Checklist de Funcionalidad

- [x] Upload de plantillas con imágenes desde PC (Admin)
- [x] Delete de plantillas con cleanup de storage (Admin)
- [x] Selección múltiple de plantillas (Frontend)
- [x] Dropdown de productos con estilos mejorados
- [x] Modal de nombre de proyecto
- [x] Popup de progreso durante clonación
- [x] Deducción de créditos (50 por imagen)
- [x] Creación de proyecto y generations
- [x] Análisis con Gemini 3 Pro (multi-modal)
- [x] Generación con Nano Banana Pro via KIE.ai
- [x] Polling automático de resultados
- [x] Visualización de resultados en grid
- [x] Selección y descarga múltiple
- [x] Editor IA adicional (drawer lateral)

---

## 🚀 Próximos Pasos

1. **Testing Completo**
   - Crear productos de prueba
   - Subir plantillas de prueba
   - Ejecutar clonación end-to-end
   - Verificar resultados en historial

2. **Optimizaciones**
   - Implementar descarga en ZIP para múltiples imágenes
   - Agregar vista previa hover en grid
   - Persistir ediciones en DB (actualmente solo visual)
   - Agregar filtros en historial

3. **Monitoreo**
   - Logs de errores de Gemini y KIE.ai
   - Métricas de tiempo de generación
   - Tracking de costos de créditos
