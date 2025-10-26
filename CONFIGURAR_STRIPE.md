# 🔧 Configurar Stripe - Guía Paso a Paso

## ⚠️ IMPORTANTE: Product IDs vs Price IDs

**Tienes los Product IDs, pero necesitas los PRICE IDs**

- ❌ Product ID: `prod_TJCSWGz8AA4jxw` (NO usar)
- ✅ Price ID: `price_...` (SÍ usar)

---

## 📋 Paso 1: Obtener Price IDs de Stripe

1. Ve a https://dashboard.stripe.com/products
2. Verás tus 3 productos:
   - Básico ($19/mes)
   - Pro ($49/mes)
   - Premium ($99/mes)

3. **Para cada producto**:
   - Click en el nombre del producto
   - En la sección "Pricing", verás el **Price ID**
   - Empieza con `price_...`
   - Cópialo

**Ejemplo**:
```
Producto: Básico
Product ID: prod_TJCSWGz8AA4jxw
Price ID: price_1QR3aBCDef123456 ← ESTE ES EL QUE NECESITAS
```

---

## 📋 Paso 2: Agregar Variables en Vercel Dashboard

### Opción A: Manual (Recomendado)

1. Ve a https://vercel.com/riverzs-projects/riverz-app/settings/environment-variables

2. Agrega estas variables (una por una):

```bash
# Price IDs (reemplaza con los que obtuviste)
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...

# Webhook Secret (ya lo tienes)
STRIPE_WEBHOOK_SECRET=whsec_IkgT6jgSq4TeRtex1Yd7b4e4RtI1PTZs
```

3. Para cada variable:
   - Click "Add New"
   - Name: (nombre de la variable)
   - Value: (valor)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

### Opción B: Usando Script PowerShell

```powershell
cd riverz-app
.\add-stripe-env.ps1
```

---

## 📋 Paso 3: Verificar Otras Variables de Stripe

Asegúrate de que estas variables YA ESTÉN en Vercel:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... o pk_test_...
STRIPE_SECRET_KEY=sk_live_... o sk_test_...
```

Si no están, agrégalas desde:
https://dashboard.stripe.com/apikeys

---

## 📋 Paso 4: Verificar Webhook en Stripe

1. Ve a https://dashboard.stripe.com/webhooks
2. Verifica que exista un webhook con:
   - **URL**: `https://riverz.vercel.app/api/stripe/webhooks`
   - **Eventos**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - **Signing Secret**: `whsec_IkgT6jgSq4TeRtex1Yd7b4e4RtI1PTZs`

Si no existe, créalo.

---

## 📋 Paso 5: Redeploy en Vercel

1. Ve a https://vercel.com/riverzs-projects/riverz-app
2. Click en "Deployments"
3. Click en el último deployment
4. Click en "⋯" (tres puntos)
5. Click en "Redeploy"
6. Espera a que termine

---

## ✅ Checklist Final

- [ ] Obtuve los 3 Price IDs de Stripe
- [ ] Agregué `STRIPE_BASIC_PRICE_ID` en Vercel
- [ ] Agregué `STRIPE_PRO_PRICE_ID` en Vercel
- [ ] Agregué `STRIPE_PREMIUM_PRICE_ID` en Vercel
- [ ] Agregué `STRIPE_WEBHOOK_SECRET` en Vercel
- [ ] Verifiqué que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` existe
- [ ] Verifiqué que `STRIPE_SECRET_KEY` existe
- [ ] Verifiqué el webhook en Stripe
- [ ] Hice redeploy en Vercel

---

## 🧪 Testing

Después de configurar todo:

1. Ve a https://riverz.vercel.app/configuracion
2. Intenta comprar un plan
3. Usa tarjeta de prueba: `4242 4242 4242 4242`
4. Verifica que los créditos se agreguen

---

## 🆘 Troubleshooting

### Error: "Invalid price ID"
- Verifica que usaste `price_...` y no `prod_...`

### Error: "Webhook signature verification failed"
- Verifica que el `STRIPE_WEBHOOK_SECRET` sea correcto

### Los créditos no se agregan
- Verifica los logs en Vercel
- Verifica que el webhook esté recibiendo eventos en Stripe

---

**Tiempo estimado**: 10-15 minutos

