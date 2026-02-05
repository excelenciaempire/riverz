-- ================================================================
-- RIVERZ PLATFORM - STATIC ADS MIGRATION
-- Creates missing tables and columns for static-ads feature
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- 0. ENSURE uuid_generate_v4 AND update_updated_at_column EXIST
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ================================================================
-- 1. CREATE user_credits TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  credits INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'premium')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_credits
CREATE INDEX IF NOT EXISTS idx_user_credits_clerk_id ON user_credits(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_plan ON user_credits(plan_type);

-- ================================================================
-- 2. CREATE credit_transactions TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deduction', 'addition', 'refund', 'subscription')),
  description TEXT,
  balance_after INTEGER,
  generation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(created_at DESC);

-- ================================================================
-- 3. CREATE projects TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('static_ads', 'ugc', 'clips', 'face_swap', 'other')),
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_clerk_id ON projects(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_date ON projects(created_at DESC);

-- ================================================================
-- 4. CREATE pricing_config TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode TEXT UNIQUE NOT NULL,
  credits_cost INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pricing for static ads
INSERT INTO pricing_config (mode, credits_cost, is_active, description) VALUES
('static_ad_generation', 14, true, 'Static Ad Generation - Clonar template con producto'),
('static_ad_edit', 14, true, 'Static Ad Edit - Editar imagen generada con IA'),
('ugc', 100, true, 'UGC Video Generation'),
('face_swap', 150, true, 'Face Swap Generation'),
('clips', 120, true, 'Clips Generation'),
('editar_foto_crear', 80, true, 'Editar Foto - Crear'),
('editar_foto_editar', 90, true, 'Editar Foto - Editar'),
('editar_foto_combinar', 100, true, 'Editar Foto - Combinar'),
('editar_foto_clonar', 110, true, 'Editar Foto - Clonar'),
('editar_foto_draw_edit', 50, true, 'Editar Foto - Draw Edit'),
('mejorar_calidad_video', 200, true, 'Mejorar Calidad - Video'),
('mejorar_calidad_imagen', 70, true, 'Mejorar Calidad - Imagen')
ON CONFLICT (mode) DO NOTHING;

-- ================================================================
-- 5. ALTER generations TABLE - Add Missing Columns
-- ================================================================

-- Add clerk_user_id column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN clerk_user_id TEXT;
  END IF;
END $$;

-- Add project_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add version column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'version'
  ) THEN
    ALTER TABLE generations ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- Add parent_id column (for edit versioning)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE generations ADD COLUMN parent_id UUID REFERENCES generations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update type CHECK constraint to include static_ad_generation
ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_type_check;
ALTER TABLE generations ADD CONSTRAINT generations_type_check
CHECK (type IN (
  'ugc',
  'face_swap',
  'clips',
  'editar_foto_crear',
  'editar_foto_editar',
  'editar_foto_combinar',
  'editar_foto_clonar',
  'editar_foto_draw_edit',
  'mejorar_calidad_video',
  'mejorar_calidad_imagen',
  'static_ad_generation'
));

-- Update status CHECK constraint to include extended statuses
ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_status_check;
ALTER TABLE generations ADD CONSTRAINT generations_status_check
CHECK (status IN (
  'pending',
  'pending_analysis',
  'analyzing',
  'adapting',
  'generating_prompt',
  'pending_generation',
  'generating',
  'processing',
  'completed',
  'failed'
));

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_clerk_user ON generations(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);

-- ================================================================
-- 6. ALTER products TABLE - Add Missing Columns
-- ================================================================

-- Add clerk_user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE products ADD COLUMN clerk_user_id TEXT;
  END IF;
END $$;

-- Add research_data column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'research_data'
  ) THEN
    ALTER TABLE products ADD COLUMN research_data JSONB;
  END IF;
END $$;

-- Add research_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'research_status'
  ) THEN
    ALTER TABLE products ADD COLUMN research_status TEXT CHECK (research_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

-- Add research_completed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'research_completed_at'
  ) THEN
    ALTER TABLE products ADD COLUMN research_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add ai_prompt column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'ai_prompt'
  ) THEN
    ALTER TABLE products ADD COLUMN ai_prompt TEXT;
  END IF;
END $$;

-- Add description column (used by deep-research)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE products ADD COLUMN category TEXT;
  END IF;
END $$;

-- Index for products clerk_user_id
CREATE INDEX IF NOT EXISTS idx_products_clerk_user ON products(clerk_user_id);

-- ================================================================
-- 7. ALTER templates TABLE - Add is_active Column
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'templates' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE templates ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ================================================================
-- 8. TRIGGERS for updated_at
-- ================================================================

-- Trigger for user_credits
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON user_credits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pricing_config
DROP TRIGGER IF EXISTS update_pricing_config_updated_at ON pricing_config;
CREATE TRIGGER update_pricing_config_updated_at
BEFORE UPDATE ON pricing_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- user_credits policies
-- Allow all authenticated access (API layer handles authorization via clerk_user_id)
DROP POLICY IF EXISTS "Allow all access to user_credits" ON user_credits;
CREATE POLICY "Allow all access to user_credits"
ON user_credits FOR ALL
USING (true)
WITH CHECK (true);

-- credit_transactions policies
DROP POLICY IF EXISTS "Allow all access to transactions" ON credit_transactions;
CREATE POLICY "Allow all access to transactions"
ON credit_transactions FOR ALL
USING (true)
WITH CHECK (true);

-- projects policies
-- Allow read/write for all (API layer filters by clerk_user_id)
DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
CREATE POLICY "Allow all access to projects"
ON projects FOR ALL
USING (true)
WITH CHECK (true);

-- pricing_config policies - public can view active pricing
DROP POLICY IF EXISTS "Public can view active pricing" ON pricing_config;
CREATE POLICY "Public can view active pricing"
ON pricing_config FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Allow all access to pricing" ON pricing_config;
CREATE POLICY "Allow all access to pricing"
ON pricing_config FOR ALL
USING (true)
WITH CHECK (true);

-- generations policies (ensure they allow access)
DROP POLICY IF EXISTS "Allow all access to generations" ON generations;
CREATE POLICY "Allow all access to generations"
ON generations FOR ALL
USING (true)
WITH CHECK (true);

-- ================================================================
-- 10. DATA MIGRATION - Sync existing users to user_credits
-- ================================================================

-- Copy existing users to user_credits (if they have credits in users table)
INSERT INTO user_credits (clerk_user_id, credits, plan_type, stripe_customer_id, stripe_subscription_id, created_at)
SELECT
  clerk_id,
  COALESCE(credits, 0),
  COALESCE(plan_type, 'free'),
  stripe_customer_id,
  stripe_subscription_id,
  created_at
FROM users
WHERE clerk_id IS NOT NULL
ON CONFLICT (clerk_user_id) DO UPDATE SET
  credits = EXCLUDED.credits,
  plan_type = EXCLUDED.plan_type,
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id;

-- Sync clerk_user_id to products from users
UPDATE products p
SET clerk_user_id = u.clerk_id
FROM users u
WHERE p.user_id = u.id AND p.clerk_user_id IS NULL;

-- Sync clerk_user_id to generations from users
UPDATE generations g
SET clerk_user_id = u.clerk_id
FROM users u
WHERE g.user_id = u.id AND g.clerk_user_id IS NULL;

-- ================================================================
-- 11. CREATE STORAGE BUCKET FOR GENERATIONS (if not exists)
-- ================================================================

-- Note: Run this in Supabase Dashboard > Storage > Create new bucket
-- Bucket name: generations
-- Public bucket: Yes (for easy access to generated images)

-- ================================================================
-- VERIFICATION QUERIES - Run these to confirm migration success
-- ================================================================

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_credits', 'credit_transactions', 'projects', 'pricing_config')
ORDER BY table_name;
-- Should return 4 rows

-- Verify generations columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'generations'
AND column_name IN ('clerk_user_id', 'project_id', 'version', 'parent_id')
ORDER BY column_name;
-- Should return 4 rows

-- Verify products columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('clerk_user_id', 'research_data', 'research_status', 'description', 'category')
ORDER BY column_name;
-- Should return 5 rows

-- Verify pricing_config has static ads pricing
SELECT mode, credits_cost FROM pricing_config WHERE mode LIKE 'static%';
-- Should return 2 rows with static_ad_generation and static_ad_edit

-- Verify user_credits were synced
SELECT COUNT(*) FROM user_credits;
-- Should match count of users with clerk_id
