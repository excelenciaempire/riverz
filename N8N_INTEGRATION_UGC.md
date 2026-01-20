# 🔗 Integración N8N - Workflow UGC con Riverz

## 📊 Flujo de Integración

```
┌─────────────────┐
│  Riverz Frontend│
│   (UGC Page)    │
└────────┬────────┘
         │ 1. User clicks "Generar"
         ▼
┌─────────────────┐
│ API Route       │
│ /api/ugc/       │
│ generate        │
└────────┬────────┘
         │ 2. POST to N8N Webhook
         ▼
┌─────────────────────────────────────────────┐
│           N8N Workflow                      │
│                                             │
│  ┌────────────┐    ┌──────────────┐       │
│  │  Webhook   │───→│ Prepare Data │       │
│  └────────────┘    └──────┬───────┘       │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Describe Img │        │
│                    └──────┬───────┘        │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Create Image │        │
│                    └──────┬───────┘        │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Create Video │        │
│                    └──────┬───────┘        │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Upscale Video│        │
│                    └──────┬───────┘        │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Combine Clips│        │
│                    └──────┬───────┘        │
│                            ▼               │
│                    ┌──────────────┐        │
│                    │ Update Status│        │
│                    └──────┬───────┘        │
└───────────────────────────┼────────────────┘
                            │ 3. PATCH to Supabase
                            ▼
                    ┌──────────────┐
                    │   Supabase   │
                    │  generations │
                    └──────┬───────┘
                            │ 4. Frontend polls status
                            ▼
                    ┌──────────────┐
                    │ Display Video│
                    │  to User     │
                    └──────────────┘
```

---

## 📊 Análisis del Workflow Actual

### **Estado Actual:**
- **Inicio**: Telegram Trigger (recibe mensajes de Telegram)
- **Procesamiento**: 
  - Get Photos (Google Sheets)
  - Describe Img (OpenAI)
  - UGC AI Agents (Image & Video)
  - Create Video (kie.ai)
  - Upscale Video (fal.ai)
- **Final**: Send Video (Telegram) + Save The Video (Google Sheets)

---

## 🔄 Cambios Necesarios para Integración con Riverz

### **1. INICIO: Reemplazar Telegram Trigger con Webhook**

**❌ Nodo Actual:**
```json
{
  "name": "Telegram Trigger",
  "type": "n8n-nodes-base.telegramTrigger",
  "webhookId": "348da233-c7e2-4f4e-9125-e61512772939"
}
```

**✅ Nuevo Nodo (Webhook):**
```json
{
  "name": "Riverz Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "ugc/generate",
    "httpMethod": "POST",
    "responseMode": "onReceived",
    "responseData": "allEntries",
    "options": {}
  }
}
```

**Datos que recibirá desde Riverz:**
```json
{
  "user_id": "clerk_user_id",
  "generation_id": "uuid",
  "avatar": {
    "type": "biblioteca|subir|generar",
    "url": "https://...",
    "data": {...}
  },
  "script": "Texto del guión",
  "voiceId": "eleven_labs_voice_id",
  "aspectRatio": "9:16",
  "model": "veo3_fast"
}
```

---

### **2. PROCESAMIENTO: Eliminar Nodos Innecesarios**

**❌ Nodos a Eliminar:**
1. `Bot ID` - No necesario
2. `chat id` - No necesario
3. `Get Photos` (Google Sheets) - Datos vienen de Riverz
4. `Combine Photos` - Imágenes vienen directamente
5. `Photo Approval` (Telegram) - No necesario
6. `Video Approval` (Telegram) - No necesario
7. `If 2` (Aprobación) - No necesario
8. `Fail Safe 1` (Google Sheets) - No necesario

**✅ Nodos a Mantener:**
1. `Describe Img` (OpenAI) - Para analizar avatar
2. `UGCRobo - Image AI Agent` - Para generar imagen inicial
3. `UGCRobo - Video AI Agent` - Para generar prompts de video
4. `Create Image` (fal.ai) - Genera imagen inicial
5. `Create Video` (kie.ai) - Genera videos
6. `Upscale Video` (fal.ai) - Mejora calidad
7. `Combine Clips 2` (fal.ai) - Combina videos
8. Todos los nodos `Wait`, `Get Video`, `Get Image`, `If` (checks de status)

---

### **3. INICIO: Nuevo Nodo de Preparación de Datos**

**✅ Agregar después del Webhook:**
```json
{
  "name": "Prepare Riverz Data",
  "type": "n8n-nodes-base.set",
  "parameters": {
    "assignments": {
      "assignments": [
        {
          "name": "user_id",
          "value": "={{ $json.user_id }}",
          "type": "string"
        },
        {
          "name": "generation_id",
          "value": "={{ $json.generation_id }}",
          "type": "string"
        },
        {
          "name": "avatar_url",
          "value": "={{ $json.avatar.url }}",
          "type": "string"
        },
        {
          "name": "script",
          "value": "={{ $json.script }}",
          "type": "string"
        },
        {
          "name": "voiceId",
          "value": "={{ $json.voiceId }}",
          "type": "string"
        },
        {
          "name": "aspectRatio",
          "value": "={{ $json.aspectRatio }}",
          "type": "string"
        },
        {
          "name": "prompt",
          "value": "={{ $json.script }}",
          "type": "string"
        },
        {
          "name": "image_urls",
          "value": "={{ $json.avatar.url }}",
          "type": "string"
        }
      ]
    }
  }
}
```

---

### **4. FINAL: Reemplazar Send Video con HTTP Request a Riverz**

**❌ Nodo Actual:**
```json
{
  "name": "Send Video",
  "type": "n8n-nodes-base.telegram",
  "operation": "sendVideo"
}
```

**✅ Nuevo Nodo (Return to Riverz):**
```json
{
  "name": "Return to Riverz",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://riverz.vercel.app/api/ugc/callback",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"generation_id\": \"{{ $node['Prepare Riverz Data'].json.generation_id }}\",\n  \"status\": \"completed\",\n  \"result_url\": \"{{ $('Get Video 8').item.json.video.url }}\",\n  \"user_id\": \"{{ $node['Prepare Riverz Data'].json.user_id }}\"\n}",
    "options": {}
  },
  "credentials": {
    "httpHeaderAuth": {
      "id": "riverz-api-key",
      "name": "Riverz API Key"
    }
  }
}
```

**O Alternativamente: Update Supabase Directamente**
```json
{
  "name": "Update Generation Status",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "https://znrabzpwgoiepcjyljdk.supabase.co/rest/v1/generations",
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "id",
          "value": "=eq.{{ $node['Prepare Riverz Data'].json.generation_id }}"
        }
      ]
    },
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $credentials.supabaseServiceKey }}"
        },
        {
          "name": "Authorization",
          "value": "=Bearer {{ $credentials.supabaseServiceKey }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"status\": \"completed\",\n  \"result_url\": \"{{ $('Get Video 8').item.json.video.url }}\",\n  \"completed_at\": \"{{ $now().toISO() }}\",\n  \"error_message\": null\n}"
  }
}
```

---

### **5. MANEJO DE ERRORES**

**✅ Agregar Nodo de Error Handler:**
```json
{
  "name": "Error Handler",
  "type": "n8n-nodes-base.httpRequest",
  "continueOnFail": false,
  "onError": "continueErrorOutput",
  "parameters": {
    "method": "PATCH",
    "url": "https://znrabzpwgoiepcjyljdk.supabase.co/rest/v1/generations",
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "id",
          "value": "=eq.{{ $node['Prepare Riverz Data'].json.generation_id }}"
        }
      ]
    },
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $credentials.supabaseServiceKey }}"
        },
        {
          "name": "Authorization",
          "value": "=Bearer {{ $credentials.supabaseServiceKey }}"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"status\": \"failed\",\n  \"error_message\": \"{{ $json.error.message }}\",\n  \"completed_at\": \"{{ $now().toISO() }}\"\n}"
  }
}
```

---

## 📋 Resumen de Cambios

### **INICIO (3 nodos nuevos):**
1. ✅ **Webhook** - Recibe POST desde Riverz (`/ugc/generate`)
2. ✅ **Prepare Riverz Data** - Transforma datos al formato del workflow
3. ❌ **Eliminar**: Telegram Trigger, Bot ID, chat id, Get Photos

### **PROCESAMIENTO (mantener core):**
- ✅ Mantener todo el flujo de AI y generación de video
- ❌ **Eliminar**: Photo Approval, Video Approval, If 2, Fail Safe 1

### **FINAL (2 nodos nuevos):**
1. ✅ **Update Generation Status** - Actualiza Supabase con resultado
2. ✅ **Error Handler** - Maneja errores y actualiza status a "failed"
3. ❌ **Eliminar**: Send Video (Telegram), Save The Video (Google Sheets)

---

## 🔐 Credenciales Necesarias en N8N

```bash
# Supabase Service Role Key
Name: supabase-service-key
Type: Header Auth
Key: apikey
Value: eyJ... (tu SUPABASE_SERVICE_ROLE_KEY)

# Riverz API Key (opcional si usas callback)
Name: riverz-api-key
Type: Header Auth
Key: X-API-Key
Value: (generar un secret key)
```

---

## 🚀 URLs del Workflow

**Webhook URL (después de activar):**
```
https://tu-n8n-instance.com/webhook/ugc/generate
```

**Esta URL debe configurarse en:**
```
riverz-app/app/api/ugc/generate/route.ts
```

Actualizar la línea:
```typescript
const n8nWebhookUrl = process.env.N8N_UGC_WEBHOOK_URL!;
```

**Variable de entorno en Vercel:**
```
N8N_UGC_WEBHOOK_URL=https://tu-n8n-instance.com/webhook/ugc/generate
```

---

## 🧪 Testing

### **1. Probar Webhook desde Riverz:**
```typescript
// En riverz-app/app/api/ugc/generate/route.ts
const testPayload = {
  user_id: "test_user",
  generation_id: "test_gen_123",
  avatar: {
    type: "biblioteca",
    url: "https://example.com/avatar.jpg"
  },
  script: "Test script",
  voiceId: "test_voice",
  aspectRatio: "9:16",
  model: "veo3_fast"
};

const response = await fetch(n8nWebhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPayload)
});
```

### **2. Verificar en Supabase:**
```sql
SELECT * FROM generations WHERE id = 'test_gen_123';
-- Debería mostrar status: 'completed' y result_url
```

---

## 📝 Próximos Pasos

1. ✅ Importar el workflow modificado a N8N
2. ✅ Configurar credenciales (Supabase Service Key)
3. ✅ Activar el workflow
4. ✅ Copiar la URL del webhook
5. ✅ Agregar `N8N_UGC_WEBHOOK_URL` a Vercel
6. ✅ Actualizar `riverz-app/app/api/ugc/generate/route.ts`
7. ✅ Probar desde Riverz frontend

---

**¿Necesitas que modifique el JSON del workflow con estos cambios?** 🛠️

