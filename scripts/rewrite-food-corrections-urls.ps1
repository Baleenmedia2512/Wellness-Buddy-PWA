$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# Order matters — replace longer/more-specific paths first.
$mappings = [ordered]@{
  '/api/get-global-corrections'    = '/api/food-corrections/global'
  '/api/get-food-corrections'      = '/api/food-corrections'
  '/api/save-food-correction'      = '/api/food-corrections'
  '/api/search-food-history'       = '/api/food-corrections/search'
  '/api/update-nutrition-analysis' = '/api/food-corrections/nutrition'
  '/api/user-nutrition-stats'      = '/api/food-corrections/stats'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\food-corrections\\services' }
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
