# 🚀 Guía de Configuración N8N - Workflow UGC Riverz

## 📋 Paso 1: Importar Workflow a N8N

1. **Accede a tu instancia de N8N**
2. **Click en "Workflows" → "+" → "Import from File"**
3. **Selecciona el archivo**: `UGC_RIVERZ.json`
4. **El workflow se importará con el nombre**: "Riverz - UGC Generator"

---

## 🔐 Paso 2: Configurar Credenciales en N8N

### **2.1 OpenAI API Key**
Ya configurada en el workflow original, verifica que esté activa:
- Nombre: `OpenAi account`
- ID: `P3d51Tc5hfG6ycaP`

### **2.2 fal.ai / kie.ai API Key**
Ya configurada en el workflow original:
- Nombre: `TestRBL1`
- ID: `7ty4CIAWTnmNwwpX`

### **2.3 Supabase Service Role Key** (NUEVA)
**Este es el único credential que necesitas agregar:**

1. En N8N, ve a **"Credentials" → "New Credential"**
2. Busca **"Header Auth"**
3. Configura:
   - **Name**: `Supabase Service Key`
   - **Header Name**: `apikey`
   - **Header Value**: Tu `SUPABASE_SERVICE_ROLE_KEY`

```bash
# Obtén tu Service Role Key desde Vercel o .env.local:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. **Guarda la credencial**

---

## ⚙️ Paso 3: Actualizar URLs en el Workflow

### **3.1 Actualizar URL de Supabase**

Busca los nodos `Update Generation Status` y `Error Handler` y actualiza la URL:

**Cambiar de:**
```
https://znrabzpwgoiepcjyljdk.supabase.co/rest/v1/generations
```

**A tu URL de Supabase:**
```
https://TU_SUPABASE_URL.supabase.co/rest/v1/generations
```

Puedes encontrar tu URL en Vercel:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
```

### **3.2 Verificar Credenciales en Nodos**

En ambos nodos (`Update Generation Status` y `Error Handler`):
1. Click en el nodo
2. Ve a la sección "Authentication"
3. Asegúrate que "Generic Credential Type" → "Header Auth" esté seleccionado
4. Selecciona la credencial `Supabase Service Key` que creaste

---

## ✅ Paso 4: Activar el Workflow

1. **Guarda el workflow** (Ctrl+S o botón "Save")
2. **Click en el toggle "Active"** en la esquina superior derecha
3. **Copia la URL del Webhook**:
   - Click en el nodo "Riverz Webhook"
   - Copia la **Production URL** que aparece

Ejemplo:
```
https://tu-n8n-instance.com/webhook/ugc/generate
```

---

## 🔗 Paso 5: Configurar Riverz para usar el Webhook

### **5.1 Agregar Variable de Entorno en Vercel**

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:

```bash
N8N_UGC_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/ugc/generate
```

4. **Redeploy** el proyecto para que tome efecto

### **5.2 Verificar la Integración en el Código**

El archivo `riverz-app/app/api/ugc/generate/route.ts` ya debería tener:

```typescript
const n8nWebhookUrl = process.env.N8N_UGC_WEBHOOK_URL!;

// Trigger N8N workflow
const n8nResponse = await fetch(n8nWebhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    generation_id: generation.id,
    avatar: {
      type: avatarType,
      url: avatarUrl,
    },
    script,
    voiceId,
    aspectRatio: '9:16',
    model: 'veo3_fast',
  }),
});
```

---

## 🧪 Paso 6: Probar la Integración

### **6.1 Test Manual en N8N**

1. En N8N, abre el workflow "Riverz - UGC Generator"
2. Click en el nodo "Riverz Webhook"
3. Click en "Listen for Test Event"
4. Desde otra terminal o Postman, envía:

```bash
curl -X POST https://tu-n8n-instance.com/webhook/ugc/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "generation_id": "test_gen_456",
    "avatar": {
      "type": "biblioteca",
      "url": "https://example.com/avatar.jpg"
    },
    "script": "Este es un guión de prueba para el video UGC",
    "voiceId": "test_voice_id",
    "aspectRatio": "9:16",
    "model": "veo3_fast"
  }'
```

5. **Verifica que el workflow se ejecute correctamente**

### **6.2 Test desde Riverz Frontend**

1. Accede a Riverz: `https://riverz.vercel.app/crear/ugc`
2. Selecciona un avatar
3. Escribe un guión
4. Selecciona una voz
5. Click en "Generar"
6. **Verifica en N8N** que el workflow se haya ejecutado
7. **Verifica en Supabase** que el status se actualice a "completed"

---

## 📊 Paso 7: Monitoreo y Debugging

### **7.1 Ver Ejecuciones en N8N**

1. En N8N, ve a **"Executions"**
2. Verás todas las ejecuciones del workflow
3. Click en cualquiera para ver detalles

### **7.2 Ver Status en Supabase**

```sql
-- Consulta para ver generaciones recientes
SELECT 
  id,
  generation_type,
  status,
  created_at,
  completed_at,
  result_url,
  error_message
FROM generations
WHERE generation_type = 'ugc'
ORDER BY created_at DESC
LIMIT 10;
```

### **7.3 Logs en Vercel**

En Vercel, ve a tu proyecto → "Logs" para ver:
- Requests a `/api/ugc/generate`
- Respuestas de N8N
- Errores de integración

---

## ❌ Troubleshooting

### **Problema 1: Webhook no responde**
**Solución:**
- Verifica que el workflow esté **Active** en N8N
- Verifica que la URL del webhook sea correcta
- Verifica que `N8N_UGC_WEBHOOK_URL` esté en Vercel

### **Problema 2: Error "Unauthorized" en Supabase**
**Solución:**
- Verifica que la credencial `Supabase Service Key` tenga el **Service Role Key** correcto
- Verifica que la URL de Supabase sea correcta en los nodos

### **Problema 3: Generation status no se actualiza**
**Solución:**
- Verifica que el nodo `Update Generation Status` se esté ejecutando
- Verifica que el `generation_id` sea correcto
- Verifica los logs en N8N para ver errores

### **Problema 4: Error en credenciales de OpenAI/fal.ai**
**Solución:**
- Verifica que las credenciales originales (`OpenAi account`, `TestRBL1`) estén activas
- Actualiza las API keys si es necesario

---

## 📋 Checklist Final

- [ ] Workflow importado en N8N
- [ ] Credencial `Supabase Service Key` creada
- [ ] URL de Supabase actualizada en nodos
- [ ] Workflow activado en N8N
- [ ] URL del webhook copiada
- [ ] `N8N_UGC_WEBHOOK_URL` agregada a Vercel
- [ ] Vercel redeployed
- [ ] Test manual exitoso
- [ ] Test desde frontend exitoso
- [ ] Generation status se actualiza en Supabase

---

## 🎉 ¡Listo!

El workflow UGC está completamente integrado con Riverz. Ahora cuando un usuario genere un video UGC desde el frontend:

1. Riverz enviará los datos a N8N
2. N8N procesará el video (imagen, video, upscale, merge)
3. N8N actualizará el status en Supabase con el resultado
4. Riverz mostrará el video final al usuario

---

## 🔄 Próximos Pasos

Una vez que este workflow esté funcionando, puedes adaptar los otros workflows:
- **Face Swap**
- **Clips**
- **Editar Foto**
- **Mejorar Calidad**

Todos seguirán el mismo patrón de integración.

