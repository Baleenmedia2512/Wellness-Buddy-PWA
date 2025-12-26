# Database Schema Reference
**Database**: `baleeed5_wellness`  
**Last Updated**: December 26, 2025

---

## 📊 TABLES USED FOR DISCIPLINE REPORT

### 1. `team_table` - User Profiles

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| EntryDateTime | datetime | NO | | NULL | When user joined |
| EntryUser | varchar | NO | | NULL | |
| UserId | int | NO | PRI | NULL | Primary Key |
| UserName | varchar | NO | UNI | NULL | Unique username |
| Password | varchar | NO | | NULL | |
| TargetWeight(in_kg) | float | NO | | NULL | |
| CoachName | varchar | NO | | NULL | |
| CoCoachName | varchar | NO | | NULL | |
| Status | varchar | NO | | NULL | ⚠️ varchar, not enum |
| CoachApproved | tinyint | NO | | NULL | |
| Email | varchar | YES | | NULL | |
| Role | enum | NO | | 'user' | 'user', 'coach', 'admin' |
| DietType | enum | YES | MUL | NULL | |
| Height | decimal | YES | | NULL | |
| TeamId | varchar | YES | MUL | NULL | |
| UplineCoachId | int | YES | MUL | NULL | Coach relationship |

**⚠️ Important Notes:**
- ❌ NO `ProfileImage` column exists
- ⚠️ `Status` is varchar (not enum) - check for 'active' or 'Active'
- ✅ Has indexes on: UplineCoachId, TeamId, DietType

---

### 2. `weight_records_table` - Weight Logs

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| ID | int | NO | PRI | NULL | Primary Key |
| UserId | bigint | NO | MUL | NULL | ⚠️ bigint (not int) |
| Weight | decimal | NO | | NULL | |
| Bmi | decimal | YES | | NULL | |
| BodyFat | decimal | YES | | NULL | |
| MuscleMass | decimal | YES | | NULL | |
| Bmr | int | YES | | NULL | |
| WeightImageBase64 | longtext | YES | | NULL | |
| CreatedAt | timestamp | NO | MUL | current_timestamp() | |
| UpdatedAt | timestamp | NO | | current_timestamp() | |
| IsDeleted | tinyint | YES | MUL | 0 | |

**✅ Indexes:** UserId, CreatedAt, IsDeleted

---

### 3. `education_logs_table` - Education Sessions

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| Id | int | NO | PRI | NULL | Primary Key |
| UserId | int | NO | MUL | NULL | ✅ int type |
| Platform | varchar | NO | MUL | NULL | |
| Topic | varchar | NO | | NULL | |
| CreatedAt | datetime | YES | | current_timestamp() | |
| UpdatedAt | datetime | YES | | current_timestamp() | |
| Confidence | decimal | YES | | NULL | |
| DeviceInfo | text | YES | | NULL | |
| ImageBase64 | longtext | YES | | NULL | |
| IsDeleted | tinyint | YES | MUL | 0 | |

**✅ Indexes:** UserId, Platform, IsDeleted

---

### 4. `food_nutrition_data_table` - Meal Logs

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| ID | int | NO | PRI | NULL | Primary Key |
| UserID | varchar | NO | MUL | NULL | ⚠️ varchar (not int) |
| ImagePath | varchar | NO | | NULL | |
| AnalysisData | longtext | NO | | NULL | |
| ConfidenceScore | decimal | YES | | NULL | |
| TotalCalories | int | YES | | NULL | |
| TotalProtein | decimal | YES | | NULL | |
| TotalCarbs | decimal | YES | | NULL | |
| TotalFat | decimal | YES | | NULL | |
| TotalFiber | decimal | YES | | NULL | |
| ProcessedBy | enum | YES | MUL | 'background_service' | |
| DeviceInfo | varchar | YES | | NULL | |
| CreatedAt | timestamp | NO | MUL | current_timestamp() | |
| UpdatedAt | timestamp | NO | | current_timestamp() | |
| ImageBase64 | longtext | YES | | NULL | |
| IsDeleted | tinyint | NO | | 0 | |

**⚠️ Critical Issues:**
- ❌ NO `MealType` column - must infer from CreatedAt time
- ⚠️ `UserID` is varchar - must use `CAST(UserID AS UNSIGNED)` in queries
- ✅ Has indexes on: UserID, ProcessedBy, CreatedAt

**Meal Type Inference:**
```sql
CASE
  WHEN TIME(CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
  WHEN TIME(CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
  WHEN TIME(CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
  ELSE 'unknown'
END as MealType
```

---

### 5. `activity_time_windows_table` - Time Window Versioning

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| ID | int | NO | PRI | NULL | Primary Key |
| ActivityType | varchar | NO | MUL | NULL | 'weight', 'education', 'breakfast', 'lunch', 'dinner' |
| WindowStartTime | time | NO | | NULL | e.g., '03:00:00' |
| WindowEndTime | time | NO | | NULL | e.g., '06:30:00' |
| EffectiveFromDate | datetime | NO | | NULL | When this window became active |
| EffectiveToDate | datetime | YES | | NULL | NULL = currently active |
| ChangedBy | varchar | YES | | NULL | Admin who made change |
| ChangeReason | text | YES | | NULL | Reason for change |
| CreatedAt | timestamp | NO | | current_timestamp() | |

**✅ Index:** (ActivityType, EffectiveFromDate, EffectiveToDate)

**Default Time Windows:**
```sql
('weight', '03:00:00', '06:30:00', '2025-01-01 00:00:00', 'system')
('education', '07:15:00', '08:45:00', '2025-01-01 00:00:00', 'system')
('breakfast', '05:30:00', '08:30:00', '2025-01-01 00:00:00', 'system')
('lunch', '12:00:00', '16:00:00', '2025-01-01 00:00:00', 'system')
('dinner', '17:30:00', '20:30:00', '2025-01-01 00:00:00', 'system')
```

---

### 6. `coach_teams_table` - Coach-Team Relationships

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| Id | int | NO | PRI | NULL | Primary Key |
| TeamId | varchar | NO | UNI | NULL | Unique team ID |
| CoachId | int | YES | MUL | NULL | |
| CoCoachId | int | YES | MUL | NULL | |
| Status | enum | YES | | 'active' | 'active', 'inactive' |
| CreatedAt | datetime | YES | | current_timestamp() | |
| UpdatedAt | datetime | YES | | current_timestamp() | |

---

### 7. `approval_requests_table` - Coach Approval Requests

| Column | Type | Nullable | Key | Default | Notes |
|--------|------|----------|-----|---------|-------|
| Id | int | NO | PRI | NULL | Primary Key |
| RequesterId | int | NO | MUL | NULL | |
| UplineCoachId | int | NO | MUL | NULL | |
| Status | enum | YES | MUL | 'pending' | 'pending', 'approved', 'rejected' |
| OtpHash | varchar | YES | | NULL | |
| OtpExpiresAt | datetime | YES | | NULL | |
| OtpAttempts | int | YES | | 0 | |
| OtpSentAt | datetime | YES | | NULL | |
| RequestedAt | datetime | YES | MUL | current_timestamp() | |
| ProcessedAt | datetime | YES | | NULL | |

---

## 🚨 CRITICAL COMPATIBILITY NOTES

### For Discipline Report Queries:

1. **team_table**
   - ❌ NO `ProfileImage` column
   - ⚠️ `Status` is varchar (check: `Status = 'active'` or `LOWER(Status) = 'active'`)
   - ✅ Use: `UserId, UserName, Email, EntryDateTime, UplineCoachId, Status, Role`

2. **weight_records_table**
   - ⚠️ `UserId` is bigint (team_table.UserId is int)
   - ✅ Safe to compare: MySQL auto-converts

3. **education_logs_table**
   - ✅ `UserId` is int (matches team_table)

4. **food_nutrition_data_table**
   - ⚠️ `UserID` is varchar (must cast)
   - ❌ NO `MealType` column (infer from time)
   - ✅ Use: `CAST(UserID AS UNSIGNED) = ?`

---

## 📝 QUERY TEMPLATES

### Get Team Members for Coach
```sql
SELECT UserId, UserName, Email, EntryDateTime
FROM team_table
WHERE UplineCoachId = ?
  AND Status = 'active'
ORDER BY UserName;
```

### Weight Posts with Time Window
```sql
SELECT 
  w.UserId,
  COUNT(*) as totalPosts,
  COUNT(CASE 
    WHEN TIME(w.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
    THEN 1 
  END) as onTimePosts
FROM weight_records_table w
LEFT JOIN activity_time_windows_table tw ON (
  tw.ActivityType = 'weight'
  AND w.CreatedAt >= tw.EffectiveFromDate
  AND (w.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
)
WHERE w.UserId = ?
  AND DATE(w.CreatedAt) BETWEEN ? AND ?
  AND w.IsDeleted = 0;
```

### Meal Posts with Inferred Type
```sql
SELECT 
  CASE
    WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
    WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
    WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
  END as MealType,
  COUNT(*) as totalPosts,
  COUNT(CASE 
    WHEN TIME(f.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
    THEN 1 
  END) as onTimePosts
FROM food_nutrition_data_table f
LEFT JOIN activity_time_windows_table tw ON (
  tw.ActivityType = CASE
    WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
    WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
    WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
  END
  AND f.CreatedAt >= tw.EffectiveFromDate
  AND (f.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
)
WHERE CAST(f.UserID AS UNSIGNED) = ?
  AND DATE(f.CreatedAt) BETWEEN ? AND ?
  AND f.IsDeleted = 0
  AND TIME(f.CreatedAt) BETWEEN '05:30:00' AND '20:30:00'
GROUP BY MealType;
```

---

## 🔗 RELATIONSHIPS

```
team_table.UserId (int) ←→ weight_records_table.UserId (bigint)
team_table.UserId (int) ←→ education_logs_table.UserId (int)
team_table.UserId (int) ←→ CAST(food_nutrition_data_table.UserID AS UNSIGNED)

team_table.UplineCoachId (int) → team_table.UserId (coach's UserId)
team_table.TeamId (varchar) ←→ coach_teams_table.TeamId (varchar)
```

---

**Last Verified**: December 26, 2025  
**Total Tables**: 213 columns across all tables  
**Database**: MySQL/MariaDB (baleeed5_wellness)
