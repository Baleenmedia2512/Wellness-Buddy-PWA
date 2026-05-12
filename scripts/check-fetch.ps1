$files = @(
  'frontend/src/features/activity/components/WatchActivityCard.js',
  'frontend/src/features/admin/components/AdminDashboard.js',
  'frontend/src/features/nutrition/components/NutritionDashboard.js',
  'frontend/src/features/user/components/Login.js',
  'frontend/src/features/weight/components/WeightDashboard.js',
  'frontend/src/features/user/components/DeleteAccountModal.js',
  'frontend/src/features/user/components/CompleteProfilePage.js',
  'frontend/src/features/education/components/EducationDashboard.js',
  'frontend/src/features/nutrition-centers/components/NutritionCenterRegistration.js'
)
foreach ($f in $files) {
  $pre = (git show "dd4c7af7:$f" 2>$null | Select-String -Pattern 'fetch\(' -AllMatches).Matches.Count
  $now = 0
  if (Test-Path $f) { $now = (Get-Content $f | Select-String -Pattern 'fetch\(' -AllMatches).Matches.Count }
  Write-Output ("pre={0,2} now={1,2}  {2}" -f $pre, $now, $f)
}
