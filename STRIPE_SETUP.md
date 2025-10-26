# Guía de Configuración de Stripe para Riverz

Esta guía te ayudará a configurar Stripe para manejar suscripciones y compras de créditos en Riverz.

## 📋 Requisitos Previos

1. Cuenta de Stripe (crea una en [stripe.com](https://stripe.com))
2. Acceso al Dashboard de Stripe
3. Acceso a las variables de entorno de tu proyecto

---

## 🔧 PASO 1: Obtener las API Keys de Stripe

### 1.1 Ir al Dashboard de Stripe
1. Inicia sesión en [dashboard.stripe.com](https://dashboard.stripe.com)
2. En la esquina superior derecha, asegúrate de estar en **modo Test** (toggle azul)

### 1.2 Obtener las Keys
1. Ve a **Developers** → **API keys**
2. Copia las siguientes keys:
   - **Publishable key** (comienza con `pk_test_...`)
   - **Secret key** (comienza con `sk_test_...`)

### 1.3 Agregar a Variables de Entorno
Agrega estas keys a tu archivo `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_tu_key_aqui
STRIPE_SECRET_KEY=sk_test_tu_key_aqui
```

---

## 💳 PASO 2: Crear Productos y Precios

### 2.1 Plan Básico ($19/mes - 2000 créditos)

1. Ve a **Products** → **Add product**
2. Configura:
   - **Name**: `Plan Básico Riverz`
   - **Description**: `Acceso completo + 2000 créditos mensuales`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$19.00 USD`
   - **Billing period**: `Monthly`
   - **Payment type**: `Recurring`
3. Click en **Save product**
4. **IMPORTANTE**: Copia el **Price ID** (comienza con `price_...`)

### 2.2 Plan Pro ($49/mes - 5500 créditos)

1. Ve a **Products** → **Add product**
2. Configura:
   - **Name**: `Plan Pro Riverz`
   - **Description**: `Acceso completo + 5500 créditos mensuales`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$49.00 USD`
   - **Billing period**: `Monthly`
   - **Payment type**: `Recurring`
3. Click en **Save product**
4. **IMPORTANTE**: Copia el **Price ID**

### 2.3 Plan Premium ($99/mes - 12000 créditos)

1. Ve a **Products** → **Add product**
2. Configura:
   - **Name**: `Plan Premium Riverz`
   - **Description**: `Acceso completo + 12000 créditos mensuales`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$99.00 USD`
   - **Billing period**: `Monthly`
   - **Payment type**: `Recurring`
3. Click en **Save product**
4. **IMPORTANTE**: Copia el **Price ID**

### 2.4 Agregar Price IDs a Variables de Entorno

Agrega los Price IDs a tu archivo `.env.local`:

```env
STRIPE_BASIC_PRICE_ID=price_tu_basic_price_id
STRIPE_PRO_PRICE_ID=price_tu_pro_price_id
STRIPE_PREMIUM_PRICE_ID=price_tu_premium_price_id
```

---

## 🔔 PASO 3: Configurar Webhooks

Los webhooks permiten que Stripe notifique a tu aplicación cuando ocurren eventos (pagos exitosos, cancelaciones, etc.)

### 3.1 Crear Webhook Endpoint

1. Ve a **Developers** → **Webhooks**
2. Click en **Add endpoint**
3. Configura:
   - **Endpoint URL**: `https://tu-dominio.vercel.app/api/stripe/webhooks`
     - Para desarrollo local: usa [Stripe CLI](https://stripe.com/docs/stripe-cli) o [ngrok](https://ngrok.com/)
   - **Description**: `Riverz Webhook`
   - **Events to send**: Selecciona los siguientes eventos:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

4. Click en **Add endpoint**

### 3.2 Obtener Webhook Secret

1. Después de crear el webhook, verás un **Signing secret** (comienza con `whsec_...`)
2. Click en **Reveal** y copia el secret

### 3.3 Agregar Webhook Secret a Variables de Entorno

Agrega el secret a tu archivo `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_aqui
```

---

## 🧪 PASO 4: Probar en Modo Test

### 4.1 Tarjetas de Prueba

Stripe proporciona tarjetas de prueba para simular pagos:

- **Pago exitoso**: `4242 4242 4242 4242`
- **Pago rechazado**: `4000 0000 0000 0002`
- **Requiere autenticación 3D Secure**: `4000 0025 0000 3155`

**Datos adicionales para pruebas**:
- **Fecha de expiración**: Cualquier fecha futura (ej: `12/34`)
- **CVC**: Cualquier 3 dígitos (ej: `123`)
- **ZIP**: Cualquier código postal (ej: `12345`)

### 4.2 Probar Flujo de Suscripción

1. Inicia sesión en tu aplicación Riverz
2. Ve a **Configuración** → **Planes**
3. Selecciona un plan y haz click en **Upgrade**
4. Usa una tarjeta de prueba para completar el pago
5. Verifica que:
   - Los créditos se agreguen correctamente
   - El plan se actualice en la base de datos
   - El webhook se reciba correctamente

### 4.3 Monitorear Webhooks

1. Ve a **Developers** → **Webhooks** en Stripe Dashboard
2. Click en tu webhook
3. Ve a la pestaña **Attempts** para ver los eventos recibidos
4. Verifica que los eventos tengan status `succeeded`

---

## 🚀 PASO 5: Pasar a Producción

### 5.1 Activar Modo Live

1. En Stripe Dashboard, cambia el toggle de **Test** a **Live**
2. Ve a **Developers** → **API keys**
3. Copia las **Live keys** (comienzan con `pk_live_...` y `sk_live_...`)

### 5.2 Crear Productos en Modo Live

Repite el **PASO 2** en modo Live para crear los productos y obtener los Price IDs de producción.

### 5.3 Crear Webhook en Modo Live

Repite el **PASO 3** en modo Live para crear el webhook de producción.

### 5.4 Actualizar Variables de Entorno en Vercel

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Actualiza las siguientes variables con los valores de **Live**:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_BASIC_PRICE_ID`
   - `STRIPE_PRO_PRICE_ID`
   - `STRIPE_PREMIUM_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`

4. Redeploy tu aplicación para que tome las nuevas variables

---

## 📊 PASO 6: Configurar Compra de Créditos Adicionales

Para la compra de créditos adicionales ($0.01 USD por crédito, mínimo $5 USD):

### 6.1 Crear Producto de Créditos

1. Ve a **Products** → **Add product**
2. Configura:
   - **Name**: `Créditos Riverz`
   - **Description**: `Créditos adicionales para generaciones`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$0.01 USD`
   - **Billing period**: `One time`
   - **Payment type**: `One-time`
3. Click en **Save product**
4. Copia el **Price ID**

### 6.2 Agregar a Variables de Entorno

```env
STRIPE_CREDITS_PRICE_ID=price_tu_credits_price_id
```

**Nota**: La cantidad de créditos se calculará dinámicamente en el checkout basándose en el monto que el usuario quiera comprar (mínimo $5 = 500 créditos).

---

## ✅ Resumen de Variables de Entorno

Aquí está el resumen completo de todas las variables de Stripe que necesitas:

```env
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_o_pk_live_...
STRIPE_SECRET_KEY=sk_test_o_sk_live_...

# Stripe Price IDs - Suscripciones
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...

# Stripe Price ID - Créditos
STRIPE_CREDITS_PRICE_ID=price_...

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🆘 Troubleshooting

### Problema: "No signature found"
- **Solución**: Verifica que `STRIPE_WEBHOOK_SECRET` esté correctamente configurado

### Problema: "Invalid API Key"
- **Solución**: Asegúrate de usar las keys correctas (test vs live)

### Problema: "Webhook no se recibe"
- **Solución**: 
  1. Verifica que la URL del webhook sea correcta
  2. Asegúrate de que tu aplicación esté deployada y accesible
  3. Revisa los logs en Stripe Dashboard → Webhooks → Attempts

### Problema: "Price ID not found"
- **Solución**: Verifica que estés usando Price IDs del mismo modo (test/live) que tus API keys

---

## 📚 Recursos Adicionales

- [Documentación de Stripe](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (para desarrollo local)

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu integración de Stripe estará lista. Los usuarios podrán:

1. ✅ Suscribirse a planes mensuales
2. ✅ Comprar créditos adicionales
3. ✅ Cancelar suscripciones
4. ✅ Ver su historial de transacciones

Si tienes algún problema, revisa los logs en:
- Stripe Dashboard → Developers → Logs
- Vercel Dashboard → Tu Proyecto → Logs

