# 🎯 Resumen de Integración N8N - Workflow UGC

## ✅ Archivos Creados

1. **`UGC_RIVERZ.json`** - Workflow modificado listo para importar en N8N
2. **`riverz-app/N8N_INTEGRATION_UGC.md`** - Documentación técnica detallada
3. **`riverz-app/N8N_SETUP_GUIDE.md`** - Guía paso a paso de configuración

---

## 🔄 Cambios Realizados al Workflow

### **ELIMINADOS (8 nodos):**
- ❌ Telegram Trigger
- ❌ Bot ID
- ❌ chat id
- ❌ Get Photos (Google Sheets)
- ❌ Photo Approval (Telegram)
- ❌ Video Approval (Telegram)
- ❌ If 2 (Aprobación)
- ❌ Fail Safe 1 (Google Sheets)
- ❌ Send Video (Telegram)
- ❌ Save The Video (Google Sheets)

### **AGREGADOS (3 nodos):**
- ✅ **Riverz Webhook** - Recibe POST desde Riverz
- ✅ **Prepare Riverz Data** - Transforma datos al formato del workflow
- ✅ **Update Generation Status** - Actualiza Supabase con resultado
- ✅ **Error Handler** - Maneja errores y actualiza status a "failed"

### **MANTENIDOS (24 nodos):**
- ✅ Describe Img (OpenAI)
- ✅ UGCRobo - Image AI Agent
- ✅ UGCRobo - Video AI Agent
- ✅ Create Image (fal.ai)
- ✅ Create Video (kie.ai)
- ✅ Upscale Video (fal.ai)
- ✅ Combine Clips (fal.ai)
- ✅ Todos los nodos de Wait, Get Video, If (status checks)
- ✅ Todos los nodos de procesamiento de frames

---

## 📦 Payload de Entrada (desde Riverz)

```json
{
  "user_id": "clerk_user_id",
  "generation_id": "uuid",
  "avatar": {
    "type": "biblioteca|subir|generar",
    "url": "https://..."
  },
  "script": "Texto del guión",
  "voiceId": "eleven_labs_voice_id",
  "aspectRatio": "9:16",
  "model": "veo3_fast"
}
```

---

## 📤 Respuesta de Salida (a Supabase)

```json
{
  "status": "completed",
  "result_url": "https://video-final.url",
  "completed_at": "2025-01-15T10:30:00Z",
  "error_message": null
}
```

---

## 🔐 Credenciales Necesarias

### **Ya Configuradas:**
1. ✅ OpenAI API (`OpenAi account`)
2. ✅ fal.ai / kie.ai API (`TestRBL1`)

### **Nueva (por agregar):**
1. 🆕 **Supabase Service Key**
   - Tipo: Header Auth
   - Header Name: `apikey`
   - Header Value: Tu `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Pasos de Configuración (Resumen)

1. **Importar** `UGC_RIVERZ.json` a N8N
2. **Crear** credencial "Supabase Service Key"
3. **Actualizar** URL de Supabase en nodos (cambiar de `znrabzpwgoiepcjyljdk` a tu instancia)
4. **Activar** el workflow en N8N
5. **Copiar** URL del webhook
6. **Agregar** `N8N_UGC_WEBHOOK_URL` a Vercel
7. **Redeploy** Riverz en Vercel
8. **Probar** desde el frontend

---

## 🧪 Testing

### **Test Manual (cURL):**
```bash
curl -X POST https://tu-n8n-instance.com/webhook/ugc/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "generation_id": "test_gen_123",
    "avatar": {
      "type": "biblioteca",
      "url": "https://example.com/avatar.jpg"
    },
    "script": "Test script",
    "voiceId": "test_voice",
    "aspectRatio": "9:16",
    "model": "veo3_fast"
  }'
```

### **Verificar en Supabase:**
```sql
SELECT * FROM generations WHERE id = 'test_gen_123';
```

---

## 🎯 Flujo Completo

```
User → Frontend → API Route → N8N Webhook → Process → Update Supabase → Poll → Display
```

1. **User**: Click "Generar" en UGC page
2. **Frontend**: Llama a `/api/ugc/generate`
3. **API Route**: Crea registro en Supabase + POST a N8N
4. **N8N Webhook**: Recibe datos y comienza procesamiento
5. **Process**: Imagen → Video → Upscale → Combine
6. **Update Supabase**: PATCH con status "completed" + result_url
7. **Poll**: Frontend hace polling a `/api/ugc/status/[jobId]`
8. **Display**: Muestra video final al usuario

---

## 📊 Tiempos Estimados

- **Procesamiento total**: 5-8 minutos
  - Describe Img: 10 seg
  - Create Image: 60 seg
  - Create Video (x3): 200 seg cada uno = 10 min
  - Upscale Video: 60 seg
  - Combine Clips: 60 seg

---

## ⚡ Próximos Workflows

Una vez que UGC esté funcionando, puedes adaptar:
- **Face Swap** (mismo patrón)
- **Clips** (mismo patrón)
- **Editar Foto** (mismo patrón)
- **Mejorar Calidad** (mismo patrón)

Todos siguen la misma estructura:
```
Webhook → Prepare Data → [Processing Nodes] → Update Supabase
```

---

## 📖 Documentación

- **Técnica**: `riverz-app/N8N_INTEGRATION_UGC.md`
- **Setup**: `riverz-app/N8N_SETUP_GUIDE.md`
- **Workflow**: `UGC_RIVERZ.json`

---

## ✅ Checklist de Integración

- [ ] Workflow importado
- [ ] Credencial Supabase creada
- [ ] URLs actualizadas
- [ ] Workflow activado
- [ ] Webhook URL copiada
- [ ] Variable en Vercel agregada
- [ ] Vercel redeployed
- [ ] Test manual exitoso
- [ ] Test frontend exitoso

---

**¡Listo para implementar! 🎉**

