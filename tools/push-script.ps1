# Dorong apps-script/Code.gs ke Apps Script dan perbarui deployment yang sama (URL /exec tetap).
# Prasyarat: clasp login (akun pemilik sheet) dan apps-script/.local.json (lihat .local.example.json; tidak ikut git).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent; $src = Join-Path $root 'apps-script'
$cfg = Get-Content (Join-Path $src '.local.json') -Raw | ConvertFrom-Json
$b = Join-Path $src '.build'
if (Test-Path $b) { Remove-Item -LiteralPath $b -Recurse -Force }
New-Item -ItemType Directory $b | Out-Null
(Get-Content (Join-Path $src 'Code.gs') -Raw).Replace("const APP_KEY = 'GANTI_DENGAN_KATA_SANDI'", "const APP_KEY = '$($cfg.key)'") | Set-Content (Join-Path $b 'Code.gs') -Encoding utf8
Copy-Item (Join-Path $src 'appsscript.json') $b
@{ scriptId = $cfg.scriptId; rootDir = '.' } | ConvertTo-Json | Set-Content (Join-Path $b '.clasp.json')
Push-Location $b
try {
  $d = clasp deployments 2>&1 | Out-String
  if ($d -notmatch [regex]::Escape($cfg.deploymentId)) { throw "Deployment $($cfg.deploymentId) tidak ada di skrip ini. Pastikan clasp login memakai akun pemilik sheet dan scriptId benar." }
  clasp push -f; if ($LASTEXITCODE) { throw 'clasp push gagal' }
  clasp deploy -i $cfg.deploymentId -d ("v " + (Get-Date -Format 'yyyy-MM-dd HH:mm')); if ($LASTEXITCODE) { throw 'clasp deploy gagal' }
  Write-Host 'Selesai: skrip diperbarui, URL /exec tetap.'
} finally { Pop-Location; Remove-Item -LiteralPath $b -Recurse -Force }
