$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mappings = [ordered]@{
  '/api/save-token-usage'         = '/api/token/usage'
  '/api/get-token-usage'          = '/api/token/usage'
  '/api/save-token-correction'    = '/api/token/correction'
  '/api/get-token-correction'     = '/api/token/correction'
  '/api/get-token-pricing'        = '/api/token/pricing'
  '/api/get-latest-token-costs'   = '/api/token/latest-costs'
  '/api/reverse-lookup-correction'= '/api/token/reverse-lookup'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\token\\services' }
$changed = @()
foreach ($f in $files) {
  $orig = Get-Content -Raw -Path $f.FullName
  if ($null -eq $orig) { continue }
  $new = $orig
  foreach ($k in $mappings.Keys) { $new = $new.Replace($k, $mappings[$k]) }
  if ($new -ne $orig) { Set-Content -Path $f.FullName -Value $new -NoNewline; $changed += $f.FullName }
}
"Modified $($changed.Count)"
$changed | ForEach-Object { "  $_" }
