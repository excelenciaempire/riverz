# Riverz - AI-Powered Content Creation Platform

A comprehensive platform for creating AI-generated images and videos for e-commerce and marketing.

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **AI Processing**: N8N webhooks (external automation)
- **Deployment**: Vercel

## 📋 Features Implemented

### User Authentication
- ✅ Sign in / Sign up with Clerk
- ✅ Google OAuth integration
- ✅ Password reset flow
- ✅ Session persistence
- ✅ User sync to Supabase via webhooks

### Dashboard & Navigation
- ✅ Responsive sidebar navigation
- ✅ Real-time credits display
- ✅ Active route highlighting
- ✅ Protected routes with middleware

### Content Creation Modes

#### 1. UGC Creator
- ✅ Avatar library selection
- ✅ Upload custom avatar
- ✅ Generate avatar with AI
- ✅ Script generation with AI
- ✅ Voice selection (ElevenLabs integration ready)
- ✅ Video generation with progress tracking

#### 2. Face Swap
- ✅ Video upload
- ✅ Character image upload
- ✅ Resolution & format selection
- ✅ Consent checkbox
- ✅ Processing with N8N

#### 3. Clips
- ✅ Optional image upload
- ✅ AI model selection (Sora 2, Sora 2 Pro)
- ✅ Format selection (9:16, 16:9, 1:1)
- ✅ Duration selection
- ✅ Video generation

#### 4. Editar Foto (4 Modes)
- ✅ **Crear**: Generate images from text
- ✅ **Editar**: Edit images with drawing tools (UI ready)
- ✅ **Combinar**: Combine multiple images
- ✅ **Clonar**: Clone product with reference image

#### 5. Static Ads
- ✅ Template library with filters
- ✅ Canva integration (external links)
- ✅ Free/paid user access control
- ✅ AI ideation based on products
- ✅ Awareness level organization

#### 6. Mejorar Calidad
- ✅ Video quality improvement
- ✅ Image quality improvement
- ✅ Upscale factor slider
- ✅ FPS target selection
- ✅ H264 codec option

### Marcas (Brands/Products)
- ✅ Product CRUD operations
- ✅ Multi-image upload
- ✅ PDF report generation (N8N integration)
- ✅ Free user limit (1 product)
- ✅ Supabase storage integration

### Historial (History)
- ✅ View all generated content
- ✅ Filter by type (all/videos/images)
- ✅ Pagination
- ✅ Download & delete actions
- ✅ Cost tracking per generation

### Configuración (Settings/Billing)
- ✅ Current plan display
- ✅ Subscription plans (Free, Basic $19, Pro $59, Premium $99)
- ✅ Credit purchase ($0.01/credit, min $5)
- ✅ Language switcher (Spanish/English)
- ✅ Stripe checkout integration

### API Routes
- ✅ Clerk webhook (user sync)
- ✅ User API (GET, PATCH)
- ✅ Credits deduction
- ✅ Stripe checkout session creation
- ✅ Stripe credit purchase
- ✅ Stripe webhooks (subscription management)
- ✅ UGC generation
- ✅ Face Swap generation
- ✅ Clips generation
- ✅ Marcas report generation

## 🔧 Setup Instructions

### 1. Prerequisites
```bash
Node.js 18+ and npm installed
Supabase account
Clerk account
Stripe account
N8N instance (for AI processing)
```

### 2. Install Dependencies
```bash
cd riverz-app
npm install
```

### 3. Environment Variables

Create a `.env.local` file with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_BASIC_PRICE_ID=your_basic_plan_price_id
STRIPE_PRO_PRICE_ID=your_pro_plan_price_id
STRIPE_PREMIUM_PRICE_ID=your_premium_plan_price_id

# N8N Webhooks
N8N_UGC_WEBHOOK_URL=your_n8n_ugc_webhook_url
N8N_FACE_SWAP_WEBHOOK_URL=your_n8n_face_swap_webhook_url
N8N_CLIPS_WEBHOOK_URL=your_n8n_clips_webhook_url
N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL=your_n8n_editar_foto_crear_webhook_url
N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL=your_n8n_editar_foto_editar_webhook_url
N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL=your_n8n_editar_foto_combinar_webhook_url
N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL=your_n8n_editar_foto_clonar_webhook_url
N8N_STATIC_ADS_IDEACION_WEBHOOK_URL=your_n8n_static_ads_ideacion_webhook_url
N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL=your_n8n_mejorar_calidad_video_webhook_url
N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL=your_n8n_mejorar_calidad_imagen_webhook_url
N8N_MARCAS_REPORT_WEBHOOK_URL=your_n8n_marcas_report_webhook_url

# Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id
NEXT_PUBLIC_FB_PIXEL_ID=your_facebook_pixel_id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Setup

1. Go to your Supabase project
2. Run the SQL schema from `lib/supabase/schema.sql`
3. Create storage buckets:
   - `products`
   - `avatars`
   - `generations`
4. Set up Row Level Security policies (included in schema.sql)

### 5. Stripe Setup

1. Create products in Stripe Dashboard:
   - Basic Plan: $19/month
   - Pro Plan: $59/month
   - Premium Plan: $99/month
2. Copy the Price IDs to your `.env.local`
3. Set up webhook endpoint: `your-domain.com/api/stripe/webhooks`
4. Copy webhook signing secret to `.env.local`

### 6. Clerk Setup

1. Create a Clerk application
2. Enable Google OAuth
3. Set up webhook endpoint: `your-domain.com/api/webhooks/clerk`
4. Subscribe to `user.created`, `user.updated`, `user.deleted` events
5. Copy webhook secret to `.env.local`

### 7. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🚧 Pending Implementation

### API Routes to Complete
- [ ] Additional Editar Foto endpoints (editar, combinar, clonar)
- [ ] Mejorar Calidad endpoints
- [ ] Static Ads ideation endpoint

### Features to Add
- [ ] Canvas drawing tools for Editar mode
- [ ] File upload to Supabase storage (currently using local files)
- [ ] Version control for image editing
- [ ] Real WebSocket support for real-time updates (currently polling)
- [ ] Admin dashboard (separate Next.js app)
- [ ] Email notifications
- [ ] Billing history page
- [ ] Usage analytics dashboard

### Admin Dashboard (Separate App)
- [ ] Initialize separate Next.js app
- [ ] Dashboard overview with stats
- [ ] Users management
- [ ] Videos/Images management
- [ ] Templates CRUD interface
- [ ] API endpoints configuration
- [ ] Logs viewer
- [ ] Manual credit adjustment

### Optimization
- [ ] Add proper error boundaries
- [ ] Implement retry logic for failed N8N requests
- [ ] Add request rate limiting
- [ ] Optimize images with Next.js Image component
- [ ] Add loading skeletons
- [ ] Implement data caching strategies
- [ ] Add E2E tests

## 📱 Missing Dependencies

Some dependencies may need to be installed:

```bash
npm install clsx svix date-fns
```

## 🔐 Security Considerations

- All API routes are protected with Clerk authentication
- Supabase Row Level Security is enabled
- File uploads should be validated (type, size)
- Rate limiting should be added to prevent abuse
- Webhook signatures are verified

## 🌐 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Post-Deployment

1. Update Clerk webhook URL to production URL
2. Update Stripe webhook URL to production URL
3. Update NEXT_PUBLIC_APP_URL to production URL
4. Test all flows end-to-end

## 📊 Database Schema

See `lib/supabase/schema.sql` for complete schema including:
- Users (synced from Clerk)
- Products
- Templates
- Generations
- API Logs
- Admin Config
- Avatars
- Voices

## 🎨 Brand Colors

- Primary Dark: `#161616`
- Secondary Dark: `#101010`
- Accent (Teal): `#07A498`
- White: `#FFFFFF`
- Blue: `#2563EB`

## 📖 API Documentation

### N8N Webhook Expected Format

All N8N webhooks should return:
```json
{
  "success": true,
  "job_id": "unique-job-id",
  "result_url": "https://url-to-result.com/file.mp4"
}
```

For polling endpoints (GET /job-id):
```json
{
  "status": "completed|processing|failed",
  "result_url": "https://url-to-result.com/file.mp4",
  "error": "error message if failed"
}
```

## 🤝 Contributing

This is a private project. Contact the owner for contribution guidelines.

## 📄 License

Proprietary - All rights reserved
