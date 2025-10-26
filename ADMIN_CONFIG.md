# 🔐 Configuración de Acceso Admin

## Variable de Entorno Requerida

Para acceder al admin dashboard, necesitas configurar la variable de entorno `NEXT_PUBLIC_ADMIN_EMAILS` con tu email.

---

## 📝 Configuración en Vercel

### **Paso 1: Ir a Variables de Entorno**

1. Ve a: https://vercel.com/excelenciaempires-projects/riverz/settings/environment-variables
2. Click en **"Add New"**

### **Paso 2: Agregar la Variable**

- **Name**: `NEXT_PUBLIC_ADMIN_EMAILS`
- **Value**: `juandiegoriosmesa@gmail.com`
- **Environments**: ✅ Production ✅ Preview ✅ Development

### **Paso 3: Redeploy**

1. Ve a: https://vercel.com/excelenciaempires-projects/riverz/deployments
2. Click en el último deployment
3. Click en **"..."** → **"Redeploy"**

---

## 💻 Configuración Local (Opcional)

Si estás desarrollando localmente, agrega esto a tu archivo `.env.local`:

```env
NEXT_PUBLIC_ADMIN_EMAILS=juandiegoriosmesa@gmail.com
```

---

## 👥 Múltiples Administradores

Para agregar múltiples emails de admin, sepáralos con comas:

```env
NEXT_PUBLIC_ADMIN_EMAILS=juandiegoriosmesa@gmail.com,otro@email.com,admin@riverz.com
```

---

## ✅ Verificar Acceso

Después de configurar y hacer redeploy:

1. Ve a: https://riverz.vercel.app/admin/dashboard
2. Deberías ver el dashboard completo sin errores

---

## 🔍 Troubleshooting

Si sigues viendo el error `MIDDLEWARE_INVOCATION_FAILED`:

1. Verifica que el email en Vercel sea exactamente: `juandiegoriosmesa@gmail.com`
2. Asegúrate de haber hecho redeploy después de agregar la variable
3. Limpia el caché del navegador (`Ctrl + Shift + R`)
4. Cierra sesión y vuelve a iniciar sesión

---

## 📧 Email Actual Autorizado

```
juandiegoriosmesa@gmail.com
```

Este es el email que debe estar en tu cuenta de Clerk para acceder al admin dashboard.

