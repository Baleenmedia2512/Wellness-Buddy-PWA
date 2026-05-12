$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mappings = [ordered]@{
  '/api/get-my-club-attendance' = '/api/misc/club-attendance'
  '/api/get-time-windows'       = '/api/misc/time-windows'
  '/api/detect-face'            = '/api/misc/detect-face'
  '/api/server-time'            = '/api/misc/server-time'
}
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\misc\\services' }
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
