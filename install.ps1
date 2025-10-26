# Riverz Admin Dashboard - Install Script
Write-Host "==================================" -ForegroundColor Cyan
Write-Host " Riverz Admin Dashboard Installer" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js no está instalado." -ForegroundColor Red
    Write-Host "Por favor instala Node.js desde https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion encontrado" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al instalar dependencias" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencias instaladas correctamente" -ForegroundColor Green

# Create .env.local if it doesn't exist
Write-Host ""
if (-not (Test-Path ".env.local")) {
    Write-Host "Creando archivo .env.local..." -ForegroundColor Yellow
    
    $envContent = @"
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c3VyZS1jaGltcC01MC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_KXrss7wuJVvmX60sUNQQu8CTpTrI89968XC5xwBqD0

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://znrabzpwgoiepcjyljdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MjEwNTksImV4cCI6MjA3Njk5NzA1OX0.YhLraP1kaSTo0JdXjOLUBLCsvZXc-xFI-u4ITw0Tj5U

# Admin Emails (⚠️ ACTUALIZA CON TUS EMAILS)
NEXT_PUBLIC_ADMIN_EMAILS=admin@riverz.com,admin2@riverz.com
"@
    
    Set-Content -Path ".env.local" -Value $envContent
    Write-Host "✅ Archivo .env.local creado" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANTE: Actualiza NEXT_PUBLIC_ADMIN_EMAILS en .env.local con tus emails" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️  Archivo .env.local ya existe" -ForegroundColor Cyan
}

# Success message
Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host " ✅ Instalación Completada" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Actualiza los emails admin en .env.local" -ForegroundColor White
Write-Host "2. Ejecuta: npm run dev" -ForegroundColor White
Write-Host "3. Abre: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "Para deploy a producción:" -ForegroundColor Cyan
Write-Host "vercel --prod" -ForegroundColor White
Write-Host ""

