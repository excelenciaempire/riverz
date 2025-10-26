# Script para agregar SUPABASE_SERVICE_ROLE_KEY a Vercel
# Uso: Reemplaza YOUR_VERCEL_TOKEN con tu token de Vercel

$VERCEL_TOKEN = "vetSHymoSWK0hiD40AC5hPu3"
$PROJECT_ID = "riverz"
$TEAM_ID = "team_a5rbFK15sMoOMLjHiNdveESB"

$body = @{
    key = "SUPABASE_SERVICE_ROLE_KEY"
    value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucmFienB3Z29pZXBjanlsamRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQyMTA1OSwiZXhwIjoyMDc2OTk3MDU5fQ.P1dmmv-n4CmNsUl1BEDtYgLUaSrgw3h6MDu4H7lRlzg"
    type = "encrypted"
    target = @("production", "preview", "development")
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $VERCEL_TOKEN"
    "Content-Type" = "application/json"
}

$uri = "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$TEAM_ID"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    Write-Host "✅ Variable de entorno agregada exitosamente!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "❌ Error al agregar variable:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message
    }
}

