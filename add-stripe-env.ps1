# Script para agregar variables de entorno de Stripe a Vercel
# Ejecutar: .\add-stripe-env.ps1

Write-Host "🚀 Agregando variables de entorno de Stripe a Vercel..." -ForegroundColor Cyan
Write-Host ""

# Verificar si vercel está instalado
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI no está instalado." -ForegroundColor Red
    Write-Host "Instalando Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "📝 Nota: Los Product IDs proporcionados son:" -ForegroundColor Yellow
Write-Host "  - Básico: prod_TJCSWGz8AA4jxw" -ForegroundColor Gray
Write-Host "  - Pro: prod_TJCTUARtnUhvu2" -ForegroundColor Gray
Write-Host "  - Premium: prod_TJCUkHK9pel4vO" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Necesitas los PRICE IDs (price_...), no los Product IDs" -ForegroundColor Red
Write-Host ""

# Solicitar Price IDs
Write-Host "Por favor, ve a https://dashboard.stripe.com/products" -ForegroundColor Cyan
Write-Host "y copia los PRICE IDs de cada producto:" -ForegroundColor Cyan
Write-Host ""

$basicPriceId = Read-Host "Price ID del plan Básico (price_...)"
$proPriceId = Read-Host "Price ID del plan Pro (price_...)"
$premiumPriceId = Read-Host "Price ID del plan Premium (price_...)"

Write-Host ""
Write-Host "Agregando variables a Vercel..." -ForegroundColor Green

# Agregar variables de entorno
vercel env add STRIPE_BASIC_PRICE_ID production --value $basicPriceId
vercel env add STRIPE_PRO_PRICE_ID production --value $proPriceId
vercel env add STRIPE_PREMIUM_PRICE_ID production --value $premiumPriceId
vercel env add STRIPE_WEBHOOK_SECRET production --value "whsec_IkgT6jgSq4TeRtex1Yd7b4e4RtI1PTZs"

Write-Host ""
Write-Host "✅ Variables agregadas exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Verifica que NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY esté configurada" -ForegroundColor Gray
Write-Host "2. Verifica que STRIPE_SECRET_KEY esté configurada" -ForegroundColor Gray
Write-Host "3. Haz un nuevo deploy en Vercel" -ForegroundColor Gray
Write-Host ""

