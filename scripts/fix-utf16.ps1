$base = git merge-base HEAD origin/MAD_DEV_VSA_2026
$bad = @()
git diff --name-only $base HEAD | ForEach-Object {
  if (Test-Path $_) {
    $b = [System.IO.File]::ReadAllBytes($_)
    if ($b.Length -ge 2 -and (($b[0] -eq 0xFF -and $b[1] -eq 0xFE) -or ($b[0] -eq 0xFE -and $b[1] -eq 0xFF))) {
      $bad += $_
      Write-Output "UTF-16: $_"
    }
  }
}
Write-Output "---"
Write-Output "Total: $($bad.Count)"
# Convert each
foreach ($f in $bad) {
  $text = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::Unicode)
  # Strip BOM if present
  if ($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF) { $text = $text.Substring(1) }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($f, $text, $utf8NoBom)
  Write-Output "Converted: $f"
}
