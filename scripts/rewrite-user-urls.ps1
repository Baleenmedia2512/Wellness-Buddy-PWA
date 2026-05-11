$ErrorActionPreference = 'Stop'
$mappings = [ordered]@{
  '/api/get-user-profile'    = '/api/user/profile'
  '/api/update-user-profile' = '/api/user/profile'
  '/api/get-user-context'    = '/api/user/context'
  '/api/lookup-user-id'      = '/api/user/lookup'
  '/api/save-google-user'    = '/api/user/google'
  '/api/snooze-profile-pic'  = '/api/user/snooze-pic'
  '/api/delete-user-account' = '/api/user/account'
}
$root = Split-Path -Parent $PSScriptRoot
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -Include *.js,*.jsx |
  Where-Object { $_.FullName -notmatch 'features\\user\\services' }
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
