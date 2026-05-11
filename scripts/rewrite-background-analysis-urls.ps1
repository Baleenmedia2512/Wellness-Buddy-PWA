$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# Order matters — replace longer/more-specific paths first.
$mappings = [ordered]@{
  '/api/save-background-analysis'   = '/api/background-analysis'
  '/api/get-background-analysis'    = '/api/background-analysis'
  '/api/delete-background-analysis' = '/api/background-analysis'
  '/api/undo-deleted-analysis'      = '/api/background-analysis/undo'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\background-analysis\\services' }
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
