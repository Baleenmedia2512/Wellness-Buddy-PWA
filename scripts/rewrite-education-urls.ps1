$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# IMPORTANT: order matters — replace longer paths first to avoid partial matches.
$mappings = [ordered]@{
  '/api/undo-deleted-education-log' = '/api/education/undo'
  '/api/get-education-log-image'    = '/api/education/log-image'
  '/api/get-education-summary'      = '/api/education/summary'
  '/api/save-education-log'         = '/api/education/logs'
  '/api/get-education-logs'         = '/api/education/logs'
  '/api/delete-education-log'       = '/api/education/logs'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\education\\services' }
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
