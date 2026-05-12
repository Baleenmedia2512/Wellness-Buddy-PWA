$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# Order matters — replace longer/more-specific paths first.
$mappings = [ordered]@{
  '/api/get-activity-time-report'   = '/api/activity/time-report'
  '/api/get-watch-burned-calories'  = '/api/activity/watch-calories'
  '/api/get-daily-activity'         = '/api/activity'
  '/api/save-daily-activity'        = '/api/activity'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\activity\\services' }
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
