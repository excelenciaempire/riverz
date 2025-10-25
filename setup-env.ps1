# Script para crear .env.local automáticamente

$envContent = @"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsubW9taXMtcHJvamVjdC5yZXBsaXQuYXBwJA
CLERK_SECRET_KEY=sk_live_bkjgelFfbYh0gXnJAtnkGE2Syt9QR5vIbhXnNDSgWx
CLERK_WEBHOOK_SECRET=

NEXT_PUBLIC_SUPABASE_URL=https://znrabzpwgoiepcjyljdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjEwNTksImV4cCI6MjA3Njk5NzA1OX0.YhLraP1kaSTo0JdXjOLUBLCsvZXc-xFI-u4ITw0Tj5U
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQyMTA1OSwiZXhwIjoyMDc2OTk3MDU5fQ.P1dmmv-n4CmNsUl1BEDtYgLUaSrgw3h6MDu4H7lRlzg

NEXT_PUBLIC_APP_URL=http://localhost:3000
"@

$envContent | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline

Write-Host "✅ Archivo .env.local creado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Necesitas agregar el CLERK_WEBHOOK_SECRET" -ForegroundColor Yellow
Write-Host "   1. Ve a https://dashboard.clerk.com" -ForegroundColor Cyan
Write-Host "   2. Configuración → Webhooks → Add Endpoint" -ForegroundColor Cyan
Write-Host "   3. URL: http://localhost:3000/api/webhooks/clerk" -ForegroundColor Cyan
Write-Host "   4. Copia el Signing Secret y agrégalo al .env.local" -ForegroundColor Cyan
Write-Host ""
Write-Host "Luego ejecuta: npm run dev" -ForegroundColor Green

