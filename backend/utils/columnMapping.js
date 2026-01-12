/**
 * PostgreSQL Column Name Mapping
 * 
 * MySQL used PascalCase column names, PostgreSQL uses lowercase with underscores.
 * This file documents the mapping for reference.
 * 
 * The dbPool.js wrapper handles automatic conversion, but for direct queries,
 * use this mapping:
 */

export const columnMapping = {
  // team_table
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
  
  // food_nutrition_data_table
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
  
  // weight_records_table
  'UserId': 'user_id',
  'Weight': 'weight',
  'Bmi': 'bmi',
  'BodyFat': 'body_fat',
  'MuscleMass': 'muscle_mass',
  'Bmr': 'bmr',
  'WeightImageBase64': 'weight_image_base64',
  
  // food_corrections_table
  'UserId': 'user_id',
  'AiDetected': 'ai_detected',
  'UserCorrected': 'user_corrected',
  'TimesCorrected': 'times_corrected',
  'LastCorrected': 'last_corrected',
  
  // education_logs_table
  'Platform': 'platform',
  'Topic': 'topic',
  'Confidence': 'confidence',
  
  // otp_tokens_table
  'Identifier': 'identifier',
  'IdentifierType': 'identifier_type',
  'Token': 'token',
  'ExpiresAt': 'expires_at',
  'IsVerified': 'is_verified',
  'PasswordReset': 'password_reset',
  
  // ai_token_usage_table
  'ModelName': 'model_name',
  'InputTokens': 'input_tokens',
  'OutputTokens': 'output_tokens',
  'TotalTokens': 'total_tokens',
  'InputCostUsd': 'input_cost_usd',
  'OutputCostUsd': 'output_cost_usd',
  'TotalCostUsd': 'total_cost_usd',
  'ApiEndpoint': 'api_endpoint',
  'RequestType': 'request_type',
  'FeatureCategory': 'feature_category',
  'ResponseTimeMs': 'response_time_ms',
  
  // data_table
  'Name': 'name',
  'Date': 'date',
  'Type': 'type',
  'Value': 'value',
  'Timestamp': 'timestamp',
  
  // discipline_table
  'EntryDate': 'entry_date',
  'Activity': 'activity',
  'ActivityStartTime': 'activity_start_time',
  'ActivityEndTime': 'activity_end_time',
  'ValidityStartDate': 'validity_start_date',
  'ValidityEndDate': 'validity_end_date',
  'TrackForDiscipline': 'track_for_discipline',
  'DisciplineGroupId': 'discipline_group_id',
  
  // activity_table
  'ActivityType': 'activity_type',
  'ActivityDate': 'activity_date',
  'ActivityTime': 'activity_time',
  'Duration': 'duration',
  'CaloriesBurned': 'calories_burned',
  'Notes': 'notes',
};

/**
 * Convert PascalCase to snake_case
 */
export function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert snake_case to PascalCase
 */
export function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
