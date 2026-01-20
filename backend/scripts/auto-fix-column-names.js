/**
 * Auto-fix Column Names for PostgreSQL
 * 
 * This script automatically converts PascalCase column names to snake_case
 * in all API files for PostgreSQL compatibility.
 * 
 * BACKUP RECOMMENDED BEFORE RUNNING!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Column name mapping
const columnMapping = {
  'UserId': 'user_id',
  'UserName': 'user_name',
  'Email': 'email',
  'Password': 'password',
  'TeamId': 'team_id',
  'CoachName': 'coach_name',
  'CoCoachName': 'co_coach_name',
  'Status': 'status',
  'CoachApproved': 'coach_approved',
  'Role': 'role',
  'DietType': 'diet_type',
  'Height': 'height',
  'TargetWeightKg': 'target_weight_kg',
  'UplineCoachId': 'upline_coach_id',
  'EntryDatetime': 'entry_datetime',
  'EntryUser': 'entry_user',
  'ID': 'id',
  'UserID': 'user_id',
  'ImagePath': 'image_path',
  'AnalysisData': 'analysis_data',
  'ConfidenceScore': 'confidence_score',
  'TotalCalories': 'total_calories',
  'TotalProtein': 'total_protein',
  'TotalCarbs': 'total_carbs',
  'TotalFat': 'total_fat',
  'TotalFiber': 'total_fiber',
  'ProcessedBy': 'processed_by',
  'DeviceInfo': 'device_info',
  'CreatedAt': 'created_at',
  'UpdatedAt': 'updated_at',
  'ImageBase64': 'image_base64',
  'IsDeleted': 'is_deleted',
  'Weight': 'weight',
  'Bmi': 'bmi',
  'BodyFat': 'body_fat',
  'MuscleMass': 'muscle_mass',
  'Bmr': 'bmr',
  'WeightImageBase64': 'weight_image_base64',
  'AiDetected': 'ai_detected',
  'UserCorrected': 'user_corrected',
  'TimesCorrected': 'times_corrected',
  'LastCorrected': 'last_corrected',
  'Platform': 'platform',
  'Topic': 'topic',
  'Confidence': 'confidence',
  'Identifier': 'identifier',
  'IdentifierType': 'identifier_type',
  'Token': 'token',
  'ExpiresAt': 'expires_at',
  'IsVerified': 'is_verified',
  'PasswordReset': 'password_reset',
  'ModelName': 'model_name',
  'InputTokens': 'input_tokens',
  'OutputTokens': 'output_tokens',
  'TotalTokens': 'total_tokens',
  'InputTokenCost': 'input_token_cost',
  'OutputTokenCost': 'output_token_cost',
  'TotalTokenCost': 'total_token_cost',
  'InputCostUsd': 'input_cost_usd',
  'OutputCostUsd': 'output_cost_usd',
  'TotalCostUsd': 'total_cost_usd',
  'ApiEndpoint': 'api_endpoint',
  'RequestType': 'request_type',
  'FeatureCategory': 'feature_category',
  'ResponseTimeMs': 'response_time_ms',
  'OperationType': 'operation_type',
  'Name': 'name',
  'Date': 'date',
  'Type': 'type',
  'Value': 'value',
  'Timestamp': 'timestamp',
  'Activity': 'activity',
  'ActivityType': 'activity_type',
  'ActivityDate': 'activity_date',
  'ActivityTime': 'activity_time',
  'ActivityStartTime': 'activity_start_time',
  'ActivityEndTime': 'activity_end_time',
  'Duration': 'duration',
  'CaloriesBurned': 'calories_burned',
  'Notes': 'notes',
  'ValidityStartDate': 'validity_start_date',
  'ValidityEndDate': 'validity_end_date',
  'TrackForDiscipline': 'track_for_discipline',
  'DisciplineGroupId': 'discipline_group_id',
};

const apiDir = path.join(__dirname, '..', 'pages', 'api');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function fixColumnNames(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let changes = [];

  for (const [mysqlCol, pgCol] of Object.entries(columnMapping)) {
    // Pattern 1: Column in SQL query (Column = ?)
    const sqlPattern = new RegExp(`\\b${mysqlCol}\\s*=`, 'g');
    if (sqlPattern.test(content)) {
      content = content.replace(sqlPattern, `${pgCol} =`);
      modified = true;
      changes.push(`SQL: ${mysqlCol} = → ${pgCol} =`);
    }

    // Pattern 2: Column in SQL query (SELECT Column, INSERT INTO (Column))
    const sqlPattern2 = new RegExp(`\\b${mysqlCol}\\b(?=[,\\s)]|$)`, 'g');
    const beforeReplace = content;
    content = content.replace(sqlPattern2, (match, offset) => {
      // Check if it's in a SQL context (between quotes, after SELECT, INSERT, etc.)
      const before = content.substring(Math.max(0, offset - 100), offset);
      const isInSQL = /(?:SELECT|INSERT INTO|UPDATE|SET|WHERE|FROM|VALUES)\s+[^;]*$/i.test(before);
      
      if (isInSQL) {
        return pgCol;
      }
      return match;
    });
    if (beforeReplace !== content) {
      modified = true;
      changes.push(`SQL: ${mysqlCol} → ${pgCol}`);
    }

    // Pattern 3: Result access (row.Column or result.Column)
    const accessPattern = new RegExp(`\\.(${mysqlCol})\\b`, 'g');
    if (accessPattern.test(content)) {
      content = content.replace(accessPattern, `.${pgCol}`);
      modified = true;
      changes.push(`Access: .${mysqlCol} → .${pgCol}`);
    }

    // Pattern 4: Bracket notation (row['Column'] or row["Column"])
    const bracketPattern = new RegExp(`\\[(['"])${mysqlCol}\\1\\]`, 'g');
    if (bracketPattern.test(content)) {
      content = content.replace(bracketPattern, `[$1${pgCol}$1]`);
      modified = true;
      changes.push(`Bracket: ['${mysqlCol}'] → ['${pgCol}']`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified, changes };
}

console.log('🔧 Auto-fixing column names for PostgreSQL...\n');
console.log('═'.repeat(80));

const files = getAllFiles(apiDir);
let fixedCount = 0;
let totalChanges = 0;

files.forEach(filePath => {
  const result = fixColumnNames(filePath);
  if (result.modified) {
    fixedCount++;
    totalChanges += result.changes.length;
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`\n✅ Fixed: ${relativePath}`);
    console.log(`   Changes: ${result.changes.length}`);
  }
});

console.log('\n' + '═'.repeat(80));
console.log(`\n✅ Complete! Fixed ${fixedCount} files with ${totalChanges} total changes.\n`);

if (fixedCount > 0) {
  console.log('⚠️  IMPORTANT: Test your API endpoints to verify the changes!\n');
}
