/**
 * Find and Replace PascalCase Column Names
 * 
 * This script scans API files and reports all PascalCase column references
 * that need to be converted to snake_case for PostgreSQL compatibility.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Column name mapping (MySQL PascalCase -> PostgreSQL snake_case)
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

// Files to scan
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

function findColumnReferences(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];

  for (const [mysqlCol, pgCol] of Object.entries(columnMapping)) {
    // Look for column references in SQL queries and result access
    const patterns = [
      new RegExp(`\\b${mysqlCol}\\b(?=\\s*=)`, 'g'), // Column in WHERE clause
      new RegExp(`\\b${mysqlCol}\\b(?=\\s*,)`, 'g'), // Column in SELECT or INSERT
      new RegExp(`\\.${mysqlCol}\\b`, 'g'),            // Result access like row.UserId
      new RegExp(`\\[['"]${mysqlCol}['"]\\]`, 'g'),   // Bracket notation like row['UserId']
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          mysqlColumn: mysqlCol,
          pgColumn: pgCol,
          count: matches.length
        });
      }
    });
  }

  return findings;
}

console.log('🔍 Scanning API files for MySQL column names...\n');

const files = getAllFiles(apiDir);
const report = [];

files.forEach(filePath => {
  const findings = findColumnReferences(filePath);
  if (findings.length > 0) {
    const relativePath = path.relative(process.cwd(), filePath);
    report.push({
      file: relativePath,
      findings
    });
  }
});

if (report.length === 0) {
  console.log('✅ No MySQL column names found. All files are PostgreSQL-ready!');
} else {
  console.log(`❌ Found MySQL column names in ${report.length} files:\n`);
  console.log('═'.repeat(80));
  
  report.forEach(({ file, findings }) => {
    console.log(`\n📄 ${file}`);
    console.log('─'.repeat(80));
    findings.forEach(({ mysqlColumn, pgColumn, count }) => {
      console.log(`   ${mysqlColumn.padEnd(30)} -> ${pgColumn.padEnd(30)} (${count} occurrences)`);
    });
  });
  
  console.log('\n' + '═'.repeat(80));
  console.log('\n💡 Recommendation:');
  console.log('   Update these column references to use snake_case for PostgreSQL compatibility.');
  console.log('   The dbPool.js wrapper handles some conversions, but direct result access');
  console.log('   (like row.UserId) needs manual updates.\n');
}
