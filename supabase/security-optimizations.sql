-- ============================================
-- RIVERZ PLATFORM - SECURITY & PERFORMANCE
-- Índices, Políticas RLS y Optimizaciones
-- ============================================

-- ============================================
-- 1. ÍNDICES PARA PERFORMANCE
-- ============================================

-- user_credits
CREATE INDEX IF NOT EXISTS idx_user_credits_clerk_id ON user_credits(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_plan ON user_credits(plan_type);
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription ON user_credits(subscription_status);

-- credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_generation ON credit_transactions(generation_id);

-- generations
CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);
CREATE INDEX IF NOT EXISTS idx_generations_date ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_job_id ON generations(n8n_job_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_user ON products(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_products_date ON products(created_at DESC);

-- templates
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_awareness ON templates(awareness_level);
CREATE INDEX IF NOT EXISTS idx_templates_niche ON templates(niche);

-- ad_concepts
CREATE INDEX IF NOT EXISTS idx_ad_concepts_product ON ad_concepts(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_concepts_awareness ON ad_concepts(awareness_level);

-- avatars
CREATE INDEX IF NOT EXISTS idx_avatars_active ON avatars(is_active);

-- voices
CREATE INDEX IF NOT EXISTS idx_voices_active ON voices(is_active);
CREATE INDEX IF NOT EXISTS idx_voices_provider ON voices(provider);

-- ============================================
-- 2. POLÍTICAS RLS COMPLETAS
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- user_credits: Solo el usuario puede ver sus créditos
-- ============================================

DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits"
ON user_credits FOR SELECT
USING (clerk_user_id = auth.uid()::text);

-- Solo service_role puede actualizar (via API routes)
DROP POLICY IF EXISTS "Service role can update credits" ON user_credits;
CREATE POLICY "Service role can update credits"
ON user_credits FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- Solo service_role puede insertar
DROP POLICY IF EXISTS "Service role can insert credits" ON user_credits;
CREATE POLICY "Service role can insert credits"
ON user_credits FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- credit_transactions: Solo el usuario puede ver sus transacciones
-- ============================================

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions"
ON credit_transactions FOR SELECT
USING (clerk_user_id = auth.uid()::text);

-- Solo service_role puede insertar transacciones
DROP POLICY IF EXISTS "Service role can insert transactions" ON credit_transactions;
CREATE POLICY "Service role can insert transactions"
ON credit_transactions FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- generations: Solo el usuario puede ver sus generaciones
-- ============================================

DROP POLICY IF EXISTS "Users can view own generations" ON generations;
CREATE POLICY "Users can view own generations"
ON generations FOR SELECT
USING (clerk_user_id = auth.uid()::text);

-- Solo el usuario puede crear sus generaciones
DROP POLICY IF EXISTS "Users can create own generations" ON generations;
CREATE POLICY "Users can create own generations"
ON generations FOR INSERT
WITH CHECK (clerk_user_id = auth.uid()::text);

-- Solo service_role puede actualizar generaciones
DROP POLICY IF EXISTS "Service role can update generations" ON generations;
CREATE POLICY "Service role can update generations"
ON generations FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- products: Solo el usuario puede gestionar sus productos
-- ============================================

DROP POLICY IF EXISTS "Users can view own products" ON products;
CREATE POLICY "Users can view own products"
ON products FOR SELECT
USING (clerk_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own products" ON products;
CREATE POLICY "Users can insert own products"
ON products FOR INSERT
WITH CHECK (clerk_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own products" ON products;
CREATE POLICY "Users can update own products"
ON products FOR UPDATE
USING (clerk_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own products" ON products;
CREATE POLICY "Users can delete own products"
ON products FOR DELETE
USING (clerk_user_id = auth.uid()::text);

-- ============================================
-- ad_concepts: Solo el usuario puede ver conceptos de sus productos
-- ============================================

DROP POLICY IF EXISTS "Users can view own ad concepts" ON ad_concepts;
CREATE POLICY "Users can view own ad concepts"
ON ad_concepts FOR SELECT
USING (
  product_id IN (
    SELECT id FROM products WHERE clerk_user_id = auth.uid()::text
  )
);

-- Solo service_role puede insertar conceptos
DROP POLICY IF EXISTS "Service role can insert ad concepts" ON ad_concepts;
CREATE POLICY "Service role can insert ad concepts"
ON ad_concepts FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- avatars: Lectura pública, escritura solo autenticados
-- ============================================

DROP POLICY IF EXISTS "Public can view active avatars" ON avatars;
CREATE POLICY "Public can view active avatars"
ON avatars FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can insert avatars" ON avatars;
CREATE POLICY "Authenticated users can insert avatars"
ON avatars FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update avatars" ON avatars;
CREATE POLICY "Authenticated users can update avatars"
ON avatars FOR UPDATE
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON avatars;
CREATE POLICY "Authenticated users can delete avatars"
ON avatars FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================
-- voices: Lectura pública para usuarios autenticados
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view active voices" ON voices;
CREATE POLICY "Authenticated users can view active voices"
ON voices FOR SELECT
USING (is_active = true AND auth.role() = 'authenticated');

-- ============================================
-- templates: Lectura pública, escritura solo autenticados
-- ============================================

DROP POLICY IF EXISTS "Public can view active templates" ON templates;
CREATE POLICY "Public can view active templates"
ON templates FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can manage templates" ON templates;
CREATE POLICY "Authenticated users can manage templates"
ON templates FOR ALL
USING (auth.role() = 'authenticated');

-- ============================================
-- pricing_config: Lectura pública, escritura solo service_role
-- ============================================

DROP POLICY IF EXISTS "Public can view active pricing" ON pricing_config;
CREATE POLICY "Public can view active pricing"
ON pricing_config FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage pricing" ON pricing_config;
CREATE POLICY "Service role can manage pricing"
ON pricing_config FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- admin_config: Solo service_role
-- ============================================

DROP POLICY IF EXISTS "Service role can manage admin config" ON admin_config;
CREATE POLICY "Service role can manage admin config"
ON admin_config FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- 3. FUNCIONES DE SEGURIDAD
-- ============================================

-- Función para validar ownership de recursos
CREATE OR REPLACE FUNCTION check_resource_ownership(
  resource_user_id TEXT,
  current_user_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN resource_user_id = current_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar datos antiguos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Eliminar generaciones fallidas de más de 30 días
  DELETE FROM generations
  WHERE status = 'failed'
  AND created_at < NOW() - INTERVAL '30 days';

  -- Eliminar transacciones de más de 1 año
  DELETE FROM credit_transactions
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. TRIGGERS PARA AUDITORÍA
-- ============================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas relevantes
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON user_credits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generations_updated_at ON generations;
CREATE TRIGGER update_generations_updated_at
BEFORE UPDATE ON generations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. STORAGE POLICIES
-- ============================================

-- avatars bucket: Público para lectura, autenticado para escritura
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- user-uploads bucket: Solo el usuario puede ver sus uploads
DROP POLICY IF EXISTS "Users can view own uploads" ON storage.objects;
CREATE POLICY "Users can view own uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- products bucket: Solo el usuario puede ver sus productos
DROP POLICY IF EXISTS "Users can view own product images" ON storage.objects;
CREATE POLICY "Users can view own product images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'products' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- generations bucket: Público para lectura
DROP POLICY IF EXISTS "Public can view generations" ON storage.objects;
CREATE POLICY "Public can view generations"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');

-- ============================================
-- 6. VACUUM Y ANALYZE
-- ============================================

-- Optimizar tablas para mejor performance
VACUUM ANALYZE user_credits;
VACUUM ANALYZE credit_transactions;
VACUUM ANALYZE generations;
VACUUM ANALYZE products;
VACUUM ANALYZE templates;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar índices creados
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


