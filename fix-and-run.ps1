param([int]$PORT=5178)

$project = "$env:USERPROFILE\Desktop\turnos-supabase"
Write-Host "Project: $project"
if (!(Test-Path $project)) { Write-Error "Project folder not found."; exit 1 }
Set-Location $project

# 1) Kill old node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 2) Check Node/NPM
try { $nodev = node -v } catch { Write-Error "Node is not installed."; exit 1 }
try { $npmv = npm -v } catch { Write-Error "NPM is not installed."; exit 1 }
Write-Host ("Node {0}  npm {1}" -f $nodev, $npmv)

# 3) Install deps
if (Test-Path package-lock.json) { npm ci } else { npm i }

# 4) Check .env.local
$envfile = ".env.local"
if (!(Test-Path $envfile)) {
  Write-Warning "Missing .env.local"
} else {
  $envtext = Get-Content $envfile -Raw
  if ($envtext -notmatch "VITE_SUPABASE_URL\s*=") { Write-Warning "Missing VITE_SUPABASE_URL in .env.local" }
  if ($envtext -notmatch "VITE_SUPABASE_ANON_KEY\s*=") { Write-Warning "Missing VITE_SUPABASE_ANON_KEY in .env.local" }
}

# 5) Start Vite in a new PowerShell window
$cmd = "cd `"$project`"; npx vite --host --port $PORT"
Start-Process powershell -ArgumentList "-NoExit","-Command",$cmd | Out-Null

# 6) Wait until the port responds (max ~2 min)
$deadline = (Get-Date).AddMinutes(2)
$ok = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 600
  try {
    $resp = Invoke-WebRequest "http://localhost:$PORT" -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -in 200,304) { $ok = $true; break }
  } catch {}
}

if ($ok) {
  Write-Host "Vite is running at: http://localhost:$PORT"
  Start-Process "http://localhost:$PORT"
} else {
  Write-Error "Vite did NOT start at http://localhost:$PORT. Check the other window (Vite logs) for errors."
  exit 1
}

Write-Host ""
Write-Host "IMPORTANT: Add this URL in Supabase > Authentication > URL Configuration > Additional Redirect URLs:"
Write-Host "  http://localhost:$PORT"
