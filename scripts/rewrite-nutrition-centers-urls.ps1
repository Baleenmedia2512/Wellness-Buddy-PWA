$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# Order matters: longer/more-specific paths first.
$mappings = [ordered]@{
  '/api/unregister-nutrition-center' = '/api/nutrition-centers/unregister'
  '/api/register-nutrition-center'   = '/api/nutrition-centers'
  '/api/get-nutrition-centers'       = '/api/nutrition-centers'
  '/api/check-center-name'           = '/api/nutrition-centers/check-name'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\nutrition-centers\\services' }
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
