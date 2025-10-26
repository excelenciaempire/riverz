# Script para agregar variables de entorno de Stripe a Vercel
# Variables ya configuradas

Write-Host "🚀 Agregando variables de entorno de Stripe a Vercel..." -ForegroundColor Cyan
Write-Host ""

# Variables de Stripe
$basicPriceId = "price_1SMa3nL0pSUS73AdPYCERky4"
$proPriceId = "price_1SMa4XL0pSUS73Ad6UmNSAjm"
$premiumPriceId = "price_1SMa5EL0pSUS73Ad8SJHsCBB"
$webhookSecret = "whsec_IkgT6jgSq4TeRtex1Yd7b4e4RtI1PTZs"

Write-Host "📋 Variables a agregar:" -ForegroundColor Green
Write-Host "  STRIPE_BASIC_PRICE_ID=$basicPriceId" -ForegroundColor Gray
Write-Host "  STRIPE_PRO_PRICE_ID=$proPriceId" -ForegroundColor Gray
Write-Host "  STRIPE_PREMIUM_PRICE_ID=$premiumPriceId" -ForegroundColor Gray
Write-Host "  STRIPE_WEBHOOK_SECRET=$webhookSecret" -ForegroundColor Gray
Write-Host ""

# Verificar si vercel está instalado
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI no está instalado." -ForegroundColor Red
    Write-Host "Instalando Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host ""
}

Write-Host "⚙️  Agregando variables a Vercel..." -ForegroundColor Cyan
Write-Host ""

# Agregar variables de entorno a Production, Preview y Development
$environments = @("production", "preview", "development")

foreach ($env in $environments) {
    Write-Host "📦 Agregando a $env..." -ForegroundColor Yellow
    
    vercel env add STRIPE_BASIC_PRICE_ID $env --force --yes 2>$null <<< $basicPriceId
    vercel env add STRIPE_PRO_PRICE_ID $env --force --yes 2>$null <<< $proPriceId
    vercel env add STRIPE_PREMIUM_PRICE_ID $env --force --yes 2>$null <<< $premiumPriceId
    vercel env add STRIPE_WEBHOOK_SECRET $env --force --yes 2>$null <<< $webhookSecret
}

Write-Host ""
Write-Host "✅ Variables agregadas exitosamente a todos los entornos!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Verifica las variables en: https://vercel.com/settings/environment-variables" -ForegroundColor Gray
Write-Host "2. Haz un redeploy: vercel --prod" -ForegroundColor Gray
Write-Host ""

