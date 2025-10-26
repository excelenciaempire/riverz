# 📋 Ejecutar SQL en Supabase

## Instrucciones

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Click en "SQL Editor" en el menú lateral
3. Ejecuta los siguientes scripts en orden:

---

## Script 1: Schema Principal (si no está ejecutado)

**Archivo**: `riverz-app/lib/supabase/schema.sql`

Copiar y pegar todo el contenido del archivo en el SQL Editor y ejecutar.

---

## Script 2: Seguridad y Optimizaciones ⚠️ IMPORTANTE

**Archivo**: `riverz-app/supabase/security-optimizations.sql`

Copiar y pegar todo el contenido del archivo en el SQL Editor y ejecutar.

Este script incluye:
- ✅ 20+ índices para performance
- ✅ 30+ políticas RLS para seguridad
- ✅ Funciones de seguridad
- ✅ Triggers automáticos
- ✅ Políticas de Storage

---

## Verificación

Después de ejecutar los scripts, verifica que todo esté correcto:

### 1. Verificar RLS habilitado
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Resultado esperado**: Todas las tablas deben tener `rowsecurity = true`

### 2. Verificar índices creados
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Resultado esperado**: Deberías ver 20+ índices

### 3. Verificar políticas RLS
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Resultado esperado**: Deberías ver 30+ políticas

---

## Pasos Rápidos (Copy-Paste)

### Paso 1: Abrir SQL Editor
```
https://supabase.com/dashboard/project/[TU_PROJECT_ID]/sql/new
```

### Paso 2: Ejecutar Schema
1. Abrir `riverz-app/lib/supabase/schema.sql`
2. Copiar todo (Ctrl+A, Ctrl+C)
3. Pegar en SQL Editor
4. Click en "Run" o F5

### Paso 3: Ejecutar Seguridad
1. Abrir `riverz-app/supabase/security-optimizations.sql`
2. Copiar todo (Ctrl+A, Ctrl+C)
3. Pegar en SQL Editor
4. Click en "Run" o F5

### Paso 4: Verificar
Ejecutar las queries de verificación arriba.

---

## ✅ Checklist

- [ ] Schema ejecutado sin errores
- [ ] Security optimizations ejecutado sin errores
- [ ] RLS habilitado en todas las tablas
- [ ] 20+ índices creados
- [ ] 30+ políticas RLS creadas
- [ ] Storage policies configuradas

---

## 🆘 Troubleshooting

### Error: "relation does not exist"
**Solución**: Ejecutar primero el schema.sql

### Error: "policy already exists"
**Solución**: Normal, el script usa DROP POLICY IF EXISTS

### Error: "permission denied"
**Solución**: Asegúrate de estar usando el SQL Editor de Supabase con permisos de admin

---

**Tiempo estimado**: 2-3 minutos
**Dificultad**: Fácil (solo copy-paste)


