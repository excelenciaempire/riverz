-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  credits INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'premium')),
  language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  website TEXT NOT NULL,
  benefits TEXT NOT NULL,
  images TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table (for static ads)
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  canva_url TEXT NOT NULL,
  category TEXT,
  awareness_level TEXT,
  niche TEXT,
  view_count INTEGER DEFAULT 0,
  edit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generations table (track all generated content)
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'ugc',
    'face_swap',
    'clips',
    'editar_foto_crear',
    'editar_foto_editar',
    'editar_foto_combinar',
    'editar_foto_clonar',
    'mejorar_calidad_video',
    'mejorar_calidad_imagen'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_data JSONB NOT NULL,
  result_url TEXT,
  cost INTEGER DEFAULT 0,
  error_message TEXT,
  n8n_job_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Logs table
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Config table (store N8N webhook URLs and other config)
CREATE TABLE admin_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Avatars table (for UGC library)
CREATE TABLE avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voices table (for UGC voice selection)
CREATE TABLE voices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  eleven_labs_voice_id TEXT NOT NULL,
  preview_url TEXT,
  language TEXT DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_type ON generations(type);
CREATE INDEX idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_awareness_level ON templates(awareness_level);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (clerk_id = auth.jwt()->>'sub');

-- Products policies
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

-- Generations policies
CREATE POLICY "Users can view own generations" ON generations
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

CREATE POLICY "Users can insert own generations" ON generations
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = auth.jwt()->>'sub'));

-- Templates are public for viewing
CREATE POLICY "Templates are viewable by everyone" ON templates
  FOR SELECT USING (true);

-- Avatars and voices are public for viewing
CREATE POLICY "Avatars are viewable by everyone" ON avatars
  FOR SELECT USING (is_active = true);

CREATE POLICY "Voices are viewable by everyone" ON voices
  FOR SELECT USING (is_active = true);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_config_updated_at BEFORE UPDATE ON admin_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

