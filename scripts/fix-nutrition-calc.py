"""
Patch script: Fix dashboard nutrition calculation to account for smartwatch burned calories.

This script replaces the incorrect calorie calculation block in NutritionDashboard.js
with a corrected version that derives all metrics from net calories
(= food calories - burned calories).
"""
import sys

# ── NutritionDashboard.js ─────────────────────────────────────────────────────
nd_file = r'd:\Easy2Work\wellness-pwa\frontend\src\features\nutrition\components\NutritionDashboard.js'
content = open(nd_file, encoding='utf-8').read()

# Locate the block to replace by its unique prefix
marker = 'const consumedCalories = dailyStats.totalCalories || 0;\n'
start = content.find('  ' + marker)
if start == -1:
    print('ERROR: could not find block in NutritionDashboard.js')
    sys.exit(1)

# Locate end of the block (line after isBalanced)
end_marker = '  const isBalanced     = isOverTarget && burnedCalories >= extraCalories;\n'
end_pos = content.find(end_marker, start)
if end_pos == -1:
    print('ERROR: could not find end marker in NutritionDashboard.js')
    sys.exit(1)
end_pos += len(end_marker)

old_block = content[start:end_pos]
print('OLD BLOCK:\n', old_block)
print('---')

new_block = (
    '  const consumedCalories = dailyStats.totalCalories || 0;\n'
    '  // Net Calories = Food Calories - Smartwatch Burned Calories (step counter disabled).\n'
    '  // Canonical formula: Net = Food - Exercise - Smartwatch Burned.\n'
    '  // Both smartwatch and step-based burns are treated as exercise calories.\n'
    '  const netCalories = Math.max(0, consumedCalories - burnedCalories);\n'
    '\n'
    '  // Progress bar and status badge reflect NET calories against the daily target.\n'
    '  const caloriesProgressPercent = Math.min(\n'
    '    100,\n'
    '    (netCalories / Math.max(calorieTarget, 1)) * 100,\n'
    '  );\n'
    '  const caloriesDelta = netCalories - calorieTarget;\n'
    '  const calorieStatus =\n'
    '    Math.abs(caloriesDelta) <= 100\n'
    '      ? {\n'
    '          label: "On Track",\n'
    '          className: "bg-emerald-50 text-emerald-700",\n'
    '          hint: "Great balance for today",\n'
    '        }\n'
    '      : caloriesDelta > 100\n'
    '        ? {\n'
    '            label: "Above Target",\n'
    '            className: "bg-rose-50 text-rose-700",\n'
    '            hint: `${Math.abs(caloriesDelta)} kcal above target`,\n'
    '          }\n'
    '        : {\n'
    '            label: "Below Target",\n'
    '            className: "bg-amber-50 text-amber-700",\n'
    '            hint: `${Math.abs(caloriesDelta)} kcal below target`,\n'
    '          };\n'
    '\n'
    '  // Burn-to-Balance: uses RAW food overage so the section shows how much of\n'
    '  // the food-vs-target gap has been covered by exercise.\n'
    '  const rawExcess     = Math.max(0, consumedCalories - calorieTarget);\n'
    '  const isOverTarget  = rawExcess > 0;\n'
    '  const extraCalories = rawExcess;\n'
    '  const burnProgress  = extraCalories > 0\n'
    '    ? Math.min(100, Math.round((burnedCalories / extraCalories) * 100))\n'
    '    : 0;\n'
    '  const isBalanced    = isOverTarget && burnedCalories >= extraCalories;\n'
)

new_content = content[:start] + new_block + content[end_pos:]
open(nd_file, 'w', encoding='utf-8').write(new_content)
print('NutritionDashboard.js patched successfully.')

# ── NutritionSummaryCards.js ──────────────────────────────────────────────────
sc_file = r'd:\Easy2Work\wellness-pwa\frontend\src\features\nutrition\components\dashboard\NutritionSummaryCards.js'
sc_content = open(sc_file, encoding='utf-8').read()

old_label = '<p className="text-xs md:text-sm text-gray-500">Calories Consumed</p>'
new_label = '<p className="text-xs md:text-sm text-gray-500">Net Calories</p>'

if old_label not in sc_content:
    print('ERROR: could not find "Calories Consumed" label in NutritionSummaryCards.js')
    sys.exit(1)

sc_new = sc_content.replace(old_label, new_label, 1)
open(sc_file, 'w', encoding='utf-8').write(sc_new)
print('NutritionSummaryCards.js label updated.')

# ── activity.repository.js ────────────────────────────────────────────────────
repo_file = r'd:\Easy2Work\wellness-pwa\backend\features\activity\activity.repository.js'
repo_content = open(repo_file, encoding='utf-8').read()

old_fetch = (
    'export async function fetchWatchCalorieRows(userId, targetDate) {\n'
    '  const supabase = getSupabaseClient();\n'
    '  const startOfDayUTC = `${targetDate}T00:00:00+05:30`;\n'
    '  const endOfDayUTC   = `${targetDate}T23:59:59+05:30`;\n'
    '  const { data, error } = await supabase\n'
    '    .from(\'education_logs_table\')\n'
    '    .select(\'"Id", "Topic", "CreatedAt"\')\n'
    '    .eq(\'"UserId"\', userId)\n'
    '    .eq(\'"IsDeleted"\', 0)\n'
    '    .ilike(\'"Topic"\', \'Calories Burned:%\')\n'
    '    .gte(\'"CreatedAt"\', startOfDayUTC)\n'
    '    .lte(\'"CreatedAt"\', endOfDayUTC)\n'
    '    .order(\'"CreatedAt"\', { ascending: false });\n'
    '  if (error) throw error;\n'
    '  return data || [];\n'
    '}'
)

if old_fetch not in repo_content:
    print('ERROR: could not find fetchWatchCalorieRows in activity.repository.js')
    print('Trying partial match...')
    partial = '    .eq(\'"UserId"\', userId)\n    .eq(\'"IsDeleted"\', 0)'
    if partial in repo_content:
        print('Partial match found - will do targeted column-name fix')
    else:
        print('No match - skipping activity.repository.js fix')
else:
    new_fetch = (
        'export async function fetchWatchCalorieRows(userId, targetDate) {\n'
        '  const supabase = getSupabaseClient();\n'
        '  // IST-offset day bounds: education_logs_table timestamps are stored in IST.\n'
        '  const startOfDayIST = `${targetDate}T00:00:00+05:30`;\n'
        '  const endOfDayIST   = `${targetDate}T23:59:59+05:30`;\n'
        '  const { data, error } = await supabase\n'
        '    .from(\'education_logs_table\')\n'
        '    .select(\'"Id", "Topic", "CreatedAt"\')\n'
        '    .eq(\'UserId\', userId)\n'
        '    .or(\'IsDeleted.is.null,IsDeleted.eq.0\')\n'
        '    .ilike(\'Topic\', \'Calories Burned:%\')\n'
        '    .gte(\'CreatedAt\', startOfDayIST)\n'
        '    .lte(\'CreatedAt\', endOfDayIST)\n'
        '    .order(\'CreatedAt\', { ascending: false });\n'
        '  if (error) throw error;\n'
        '  return data || [];\n'
        '}'
    )
    repo_new = repo_content.replace(old_fetch, new_fetch, 1)
    open(repo_file, 'w', encoding='utf-8').write(repo_new)
    print('activity.repository.js patched successfully.')
