# 🔴 ERROR CRÍTICO: Stripe Secret Key No Configurada

## ❌ **Problema Detectado**

El error muestra:
```
Error creating checkout: Error: Neither apiKey nor config.authenticator provided
```

Esto significa que `STRIPE_SECRET_KEY` **NO está configurada en Vercel**.

---

## ✅ **Solución Inmediata**

### **Paso 1: Verificar Variables en Vercel**

1. Ve a: https://vercel.com/riverzs-projects/riverz-app/settings/environment-variables

2. **Busca estas variables y verifica que existan**:
   - `STRIPE_SECRET_KEY` (empieza con `sk_test_` o `sk_live_`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (empieza con `pk_test_` o `pk_live_`)

### **Paso 2: Si NO Existen, Agrégalas**

#### **Obtener las Keys de Stripe**

1. Ve a: https://dashboard.stripe.com/apikeys
2. Verás dos keys:
   - **Publishable key**: Empieza con `pk_test_...` o `pk_live_...`
   - **Secret key**: Empieza con `sk_test_...` o `sk_live_...`

#### **Agregar en Vercel**

**Variable 1:**
- **Name**: `STRIPE_SECRET_KEY`
- **Value**: `sk_test_...` (tu Secret key de Stripe)
- **Environments**: ✅ Production ✅ Preview ✅ Development

**Variable 2:**
- **Name**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Value**: `pk_test_...` (tu Publishable key de Stripe)
- **Environments**: ✅ Production ✅ Preview ✅ Development

### **Paso 3: Redeploy**

Después de agregar las variables:
1. Ve a: https://vercel.com/riverzs-projects/riverz-app
2. Click en "Deployments"
3. Click en el último deployment
4. Click en "..." → "Redeploy"

---

## 📋 **Checklist de Variables de Stripe**

Verifica que TODAS estas variables estén en Vercel:

- [ ] `STRIPE_SECRET_KEY` (sk_test_... o sk_live_...)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_... o pk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` (whsec_IkgT6jgSq4TeRtex1Yd7b4e4RtI1PTZs) ✅
- [ ] `NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID` (price_1SMa3nL0pSUS73AdPYCERky4) ✅
- [ ] `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` (price_1SMa4XL0pSUS73Ad6UmNSAjm) ✅
- [ ] `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` (price_1SMa5EL0pSUS73Ad8SJHsCBB) ✅

---

## 🔍 **Cómo Verificar**

### **Opción 1: En Vercel Dashboard**
1. Ve a: https://vercel.com/riverzs-projects/riverz-app/settings/environment-variables
2. Busca `STRIPE_SECRET_KEY`
3. Si no existe, agrégala

### **Opción 2: En la Consola del Navegador**
Después del próximo deploy, ejecuta:
```javascript
// Esto debería mostrar "pk_test_..." o "pk_live_..."
console.log('Publishable Key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

---

## ⚠️ **IMPORTANTE**

**Las variables que empiezan con `NEXT_PUBLIC_` son las únicas visibles en el cliente.**

**Las variables sin `NEXT_PUBLIC_` (como `STRIPE_SECRET_KEY`) solo están disponibles en el servidor.**

Por eso:
- ✅ `NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID` - Visible en cliente (hardcodeado)
- ✅ `STRIPE_SECRET_KEY` - Solo servidor (DEBE estar en Vercel)
- ✅ `STRIPE_WEBHOOK_SECRET` - Solo servidor (DEBE estar en Vercel)

---

## 🎯 **Próximos Pasos**

1. **Ir a Stripe Dashboard** → Copiar las keys
2. **Ir a Vercel** → Agregar `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. **Redeploy** en Vercel
4. **Probar** el checkout nuevamente

---

**Tiempo estimado**: 5 minutos

