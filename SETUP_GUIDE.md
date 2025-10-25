# Riverz App - Quick Setup Guide

## ✅ What's Been Built

### Complete Features
1. **Authentication System** - Full Clerk integration with Google OAuth
2. **All 6 Creation Modes** - UGC, Face Swap, Clips, Editar Foto, Static Ads, Mejorar Calidad
3. **Marcas (Products)** - CRUD with PDF report generation
4. **Historial** - View all generated content with filters
5. **Configuración** - Billing, subscriptions, language settings
6. **Stripe Integration** - Subscriptions and credit purchases
7. **Supabase Integration** - Database schema and client setup
8. **N8N Integration** - Webhook utilities ready for your automations

### UI Components
- Modern, responsive design with Tailwind CSS
- Brand colors applied throughout
- Loading states and progress bars
- File upload with drag & drop
- Modals, dropdowns, buttons, inputs
- Toast notifications

## 🚀 Next Steps to Get Running

### 1. Install Missing Dependencies (2 minutes)
```bash
cd riverz-app
npm install clsx svix date-fns
```

### 2. Set Up Supabase (10 minutes)
1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the contents of `lib/supabase/schema.sql`
3. Go to Storage and create these buckets:
   - `products`
   - `avatars`
   - `generations`
4. Get your API keys from Project Settings → API
5. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### 3. Set Up Clerk (5 minutes)
1. Create account at https://clerk.com
2. Create a new application
3. Enable Google OAuth in "Social Connections"
4. Add webhook:
   - URL: `http://localhost:3000/api/webhooks/clerk` (update for production)
   - Events: `user.created`, `user.updated`, `user.deleted`
5. Get your keys from API Keys
6. Add to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
   CLERK_SECRET_KEY=your_secret
   CLERK_WEBHOOK_SECRET=your_webhook_secret
   ```

### 4. Set Up Stripe (10 minutes)
1. Create account at https://stripe.com
2. Create 3 products with recurring prices:
   - Basic: $19/month
   - Pro: $59/month
   - Premium: $99/month
3. Copy the Price IDs
4. Set up webhook:
   - URL: `http://localhost:3000/api/stripe/webhooks`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=your_secret
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   STRIPE_BASIC_PRICE_ID=price_xxx
   STRIPE_PRO_PRICE_ID=price_xxx
   STRIPE_PREMIUM_PRICE_ID=price_xxx
   ```

### 5. Configure N8N Webhooks (You'll do this later)
Add your N8N webhook URLs to `.env.local`:
```
N8N_UGC_WEBHOOK_URL=your_url
N8N_FACE_SWAP_WEBHOOK_URL=your_url
N8N_CLIPS_WEBHOOK_URL=your_url
# ... etc for all features
```

### 6. Optional: Analytics (5 minutes)
Add your tracking IDs:
```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=your_pixel_id
```

### 7. Run the App
```bash
npm run dev
```

Visit http://localhost:3000

## 📝 What You Need to Build

### N8N Automations
You mentioned you have N8N automations. Each should:

**Input (POST)**: Receive data from the app
```json
{
  "generationId": "uuid",
  "userId": "clerk_user_id",
  // ... specific data for the feature
}
```

**Output**: Return job ID immediately
```json
{
  "success": true,
  "job_id": "unique-job-id"
}
```

**Polling Endpoint (GET /job-id)**: Return status
```json
{
  "status": "completed|processing|failed",
  "result_url": "https://cdn.example.com/result.mp4",
  "error": "error message if failed"
}
```

### Features Ready for N8N Integration:
1. **UGC** - Receives avatar, script, voice → Returns video
2. **Face Swap** - Receives video, image → Returns video
3. **Clips** - Receives prompt, settings → Returns video
4. **Editar Foto** (4 modes) - Various inputs → Returns image(s)
5. **Mejorar Calidad** (2 modes) - Receives file → Returns improved file
6. **Marcas Report** - Receives product data → Returns PDF
7. **Static Ads Ideation** - Receives product → Returns ad concepts

### Additional API Routes to Create
These are stub/template implementations. You may want to:

1. Add more detailed error handling
2. Add file validation
3. Implement proper file upload to Supabase Storage
4. Add cost calculation based on actual usage
5. Add logging to `api_logs` table

### Admin Dashboard
This is a completely separate Next.js app. Create when ready:
```bash
npx create-next-app@latest admin-dashboard
```

Then build:
- Dashboard with stats
- User management
- Content management
- Template CRUD
- Logs viewer

## 🎯 Testing Checklist

- [ ] User can sign up/sign in
- [ ] User appears in Supabase
- [ ] Can create a product
- [ ] Product images upload to Supabase
- [ ] Can navigate all pages
- [ ] Credits display correctly
- [ ] Can access all creation modes
- [ ] Stripe checkout works (test mode)
- [ ] Subscription updates in Supabase
- [ ] Can purchase credits
- [ ] Language toggle works
- [ ] Historial shows generated content
- [ ] Can filter historial by type

## 🔧 Common Issues

### Clerk webhook not working
- Make sure you're using a public URL (ngrok for local dev)
- Verify webhook secret is correct
- Check Clerk dashboard for webhook logs

### Stripe checkout fails
- Ensure you're in test mode
- Use test card: 4242 4242 4242 4242
- Verify webhook secret
- Check Stripe dashboard for events

### Supabase connection fails
- Verify URL and keys are correct
- Check if RLS policies allow the operation
- Ensure storage buckets exist

### N8N webhooks timeout
- Increase timeout in n8n.ts (currently 30s)
- Implement proper retry logic
- Check N8N workflow logs

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🎨 Customization

All colors are in `app/globals.css`:
```css
--brand-dark-primary: #161616;
--brand-dark-secondary: #101010;
--brand-accent: #07A498;
--brand-white: #FFFFFF;
--brand-blue: #2563EB;
```

Translations are in `lib/translations.ts` (expand as needed)

## 💡 Tips

1. Start by getting authentication working
2. Then set up one feature end-to-end (e.g., Marcas)
3. Test Stripe in test mode thoroughly
4. Add N8N integrations one at a time
5. Monitor Supabase logs for errors
6. Use the browser console for debugging

Good luck! 🚀

