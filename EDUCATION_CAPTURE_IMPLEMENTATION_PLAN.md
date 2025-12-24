# Education Capture Feature - Implementation Plan

**Feature:** Auto-detect and log virtual meeting attendance from screenshots  
**Date:** December 24, 2025  
**Estimated Time:** 5-6 hours  
**Status:** Ready for Implementation

---

## 📋 **Overview**

Users upload virtual meeting screenshots (Zoom, Google Meet, Teams, etc.) and the system:
1. Detects it's a meeting (not food/weight)
2. Identifies the platform
3. Extracts meeting title (or uses default: "Education Meeting")
4. Auto-logs to database
5. Shows in education history

---

## 🎯 **Implementation Order**

### **Phase 1: Backend Foundation (Steps 1-2)**
Set up database and API endpoints first

### **Phase 2: AI Detection Service (Step 3)**
Create education detection logic

### **Phase 3: Frontend Integration (Steps 4-6)**
Connect to existing image upload flow

### **Phase 4: UI Display (Steps 7-8)**
Show results and history

---

## 📝 **Step-by-Step Implementation**

---

## **STEP 1: Database Schema** ⚙️

**File:** `sql/create_education_logs_table.sql`

**Action:** Create new file

**Purpose:** Store education meeting attendance logs

**Schema:**
```sql
-- =====================================================
-- Education Logs Table - Database Schema
-- Wellness Valley PWA - Education Capture Feature
-- Date: December 24, 2025
-- =====================================================

-- Database: baleed5_wellness

CREATE TABLE IF NOT EXISTS education_logs_table (
  Id INT(11) PRIMARY KEY AUTO_INCREMENT,
  UserId INT(11) NOT NULL,
  Platform VARCHAR(50) NOT NULL,
  Topic VARCHAR(255) NOT NULL,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  Confidence DECIMAL(3,2),
  DeviceInfo TEXT,
  ImageBase64 LONGTEXT,
  IsDeleted TINYINT(1) DEFAULT 0,
  
  INDEX idx_user_date (UserId, CreatedAt),
  INDEX idx_platform (Platform),
  INDEX idx_deleted (IsDeleted)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- Add foreign key separately if needed (after verifying team_table structure)
-- ALTER TABLE education_logs_table 
-- ADD CONSTRAINT fk_education_user FOREIGN KEY (UserId) REFERENCES team_table(UserId) ON DELETE CASCADE;

-- Verify table creation
DESCRIBE education_logs_table;

-- Sample query to test
-- SELECT * FROM education_logs_table WHERE UserId = 1 ORDER BY LoggedDate DESC LIMIT 10;
```

**Testing:**
- [ ] Run SQL in phpMyAdmin or MySQL client
- [ ] Verify table exists: `SHOW TABLES LIKE 'education_logs_table';`
- [ ] Check structure: `DESCRIBE education_logs_table;`

---

## **STEP 2: Backend API Endpoints** 🔌

### **STEP 2A: Save Education Log API**

**File:** `backend/pages/api/save-education-log.js`

**Action:** Create new file

**Purpose:** Save education meeting attendance to database

**Code Structure:**
```javascript
import mysql from 'mysql2/promise';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') { ... }
  
  // Only accept POST
  if (req.method !== 'POST') { ... }
  
  // Extract and validate input
  const { userId, imageBase64, platform, topic, confidence, deviceInfo } = req.body;
  
  // Validation
  if (!userId || !platform || !topic) { ... }
  
  // Database connection
  const connection = await mysql.createConnection({ ... });
  
  // If ImageBase64 is empty string, store as null
  const imageBase64ToSave = (imageBase64 && imageBase64.trim() !== '') ? imageBase64 : null;
  
  // Insert into education_logs_table
  const [result] = await connection.execute(
    `INSERT INTO education_logs_table (UserId, Platform, Topic, Confidence, DeviceInfo, ImageBase64)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, platform, topic, confidence, deviceInfo, imageBase64ToSave]
  );
  
  // Return success
  return res.status(200).json({
    success: true,
    id: result.insertId
  });
}
```

**Key Features:**
- Input validation
- Database insert
- Error handling
- CORS support

**Testing:**
- [ ] Test with Postman/curl
- [ ] Verify database insert works
- [ ] Check error handling

---

### **STEP 2B: Get Education Logs API**

**File:** `backend/pages/api/get-education-logs.js`

**Action:** Create new file

**Purpose:** Fetch user's education log history

**Code Structure:**
```javascript
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') { ... }
  
  // Only accept GET
  if (req.method !== 'GET') { ... }
  
  // Get userId from query params
  const { userId } = req.query;
  
  // Validation
  if (!userId) { ... }
  
  // Database connection
  const connection = await mysql.createConnection({ ... });
  
  // Fetch education logs (exclude soft-deleted)
  const [logs] = await connection.execute(
    `SELECT Id, Platform, Topic, CreatedAt, Confidence
     FROM education_logs_table
     WHERE UserId = ? AND (IsDeleted IS NULL OR IsDeleted = 0)
     ORDER BY CreatedAt DESC
     LIMIT 100`,
    [userId]
  );
  
  // Return results
  return res.status(200).json({
    success: true,
    logs: logs
  });
}
```

**Testing:**
- [ ] Test fetching logs for existing user
- [ ] Test empty result set
- [ ] Verify ordering (newest first)

---

### **STEP 2C: Delete Education Log API**

**File:** `backend/pages/api/delete-education-log.js`

**Action:** Create new file

**Purpose:** Soft-delete education log (set IsDeleted = 1 for undo support)

**Code Structure:**
```javascript
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // CORS handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  
  // Only accept DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { userId, logId } = req.body;
  
  // Validation
  if (!userId || !logId) {
    return res.status(400).json({ 
      message: 'Missing required fields: userId, logId' 
    });
  }
  
  try {
    // Database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    
    // Soft delete: set IsDeleted = 1 (allows undo)
    const [result] = await connection.execute(
      `UPDATE education_logs_table SET IsDeleted = 1 WHERE Id = ? AND UserId = ?`,
      [logId, userId]
    );
    
    await connection.end();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education log not found or already deleted'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Education log deleted successfully',
      deletedId: logId
    });
    
  } catch (error) {
    console.error('Delete education log error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete education log',
      error: error.message
    });
  }
}
```

**Testing:**
- [ ] Test deleting existing log
- [ ] Test invalid logId
- [ ] Test unauthorized delete (wrong userId)
- [ ] Verify IsDeleted set to 1 (not hard deleted)

---

### **STEP 2D: Undo Delete Education Log API**

**File:** `backend/pages/api/undo-deleted-education-log.js`

**Action:** Create new file

**Purpose:** Restore soft-deleted education log (for undo functionality)

**Code Structure:**
```javascript
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, userId } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Education log ID is required'
    });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });

    // Optional safety check: ensure row belongs to user
    if (userId) {
      const [ownerCheck] = await connection.execute(
        'SELECT Id FROM education_logs_table WHERE Id = ? AND UserId = ? LIMIT 1',
        [id, userId]
      );
      if (!ownerCheck.length) {
        await connection.end();
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to restore this item.'
        });
      }
    }

    // Restore: set IsDeleted back to 0
    const [result] = await connection.execute(
      'UPDATE education_logs_table SET IsDeleted = 0 WHERE Id = ?',
      [id]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education log not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Education log restored successfully',
      restoredId: id
    });
  } catch (error) {
    if (connection) {
      try { await connection.end(); } catch {}
    }
    console.error('❌ Database undo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to restore education log',
      error: error.message
    });
  }
}
```

**Testing:**
- [ ] Test restoring deleted log
- [ ] Test invalid id
- [ ] Test unauthorized restore (wrong userId)
- [ ] Verify IsDeleted set back to 0

---

## **STEP 3: AI Detection Service** 🤖

**File:** `frontend/src/services/educationDetectionService.js`

**Action:** Create new file

**Purpose:** Detect meeting screenshots and extract meeting info using Gemini AI

**Code Structure:**
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

class EducationDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      });
    }
  }

  /**
   * Detect if image is a virtual meeting screenshot
   */
  async detectMeetingType(imageFile) {
    // Convert to base64
    // Send to Gemini with detection prompt
    // Return { isMeeting: true/false, confidence: 0.95, platform: "Google Meet" }
  }

  /**
   * Analyze meeting image and extract details
   */
  async analyzeMeetingImage(imageFile) {
    // Convert to base64
    // Send to Gemini with analysis prompt
    // Extract platform and title
    // Apply fallback: topic = detectedTitle || "Education Meeting"
    // Return { success: true, platform: "...", topic: "...", confidence: 0.95 }
  }

  // Helper methods
  async fileToBase64(file) { ... }
  parseJsonResponse(text) { ... }
}

export const educationDetectionService = new EducationDetectionService();
```

**Gemini Prompts:**

**Detection Prompt:**
```
Analyze this image and determine if it shows a VIRTUAL MEETING screenshot.

Return ONLY this JSON format:
{
  "isMeeting": true or false,
  "confidence": 0.0 to 1.0,
  "platform": "Google Meet" or "Zoom" or "Microsoft Teams" or null,
  "reason": "brief explanation"
}

Examples:
- Google Meet interface with participants = true
- Zoom meeting with gallery view = true
- Microsoft Teams call window = true
- Food on plate = false
- Weight scale = false
- Random screenshot = false
```

**Analysis Prompt:**
```
Analyze this virtual meeting screenshot and extract meeting information.

PLATFORMS TO DETECT:
- Google Meet (green theme, Meet branding)
- Zoom (black toolbar, Zoom branding)
- Microsoft Teams (purple accents, Teams interface)
- WebEx (Cisco WebEx branding)
- Skype Business
- Other video conferencing platforms

EXTRACT INFORMATION:
1. Platform name (required)
2. Meeting title/topic (if visible - often not shown in Google Meet)

Return ONLY this JSON format:
{
  "platform": "Google Meet",
  "detectedTitle": "Wellness Workshop" or null,
  "confidence": 0.95,
  "participantCount": "5-10 people visible",
  "detectionReason": "Shows Google Meet interface with green theme and multiple participants"
}

IMPORTANT:
- If meeting title is not visible, set detectedTitle to null
- Platform detection is more reliable than title extraction
```

**Key Logic:**
```javascript
// In analyzeMeetingImage():
const geminiResponse = await this.model.generateContent([prompt, imagePart]);
const data = this.parseJsonResponse(geminiResponse.text());

// ALWAYS return a valid topic (never null)
return {
  success: true,
  platform: data.platform,
  topic: data.detectedTitle || "Education Meeting", // ✅ Fallback here
  confidence: data.confidence,
  participantCount: data.participantCount
};
```

**Testing:**
- [ ] Test with Google Meet screenshot
- [ ] Test with Zoom screenshot
- [ ] Test with Teams screenshot
- [ ] Test with food image (should return isMeeting: false)
- [ ] Verify fallback topic works when title not detected

---

## **STEP 4: Update Image Type Detector** 🔍

**File:** `frontend/src/services/imageTypeDetector.js`

**Action:** Modify existing file

**Purpose:** Add 'education' as third detection type

**Changes:**

1. **Import education service:**
```javascript
import { weightDetectionService } from './weightDetectionService';
import { educationDetectionService } from './educationDetectionService'; // ✅ NEW
```

2. **Update detectImageType() method:**
```javascript
async detectImageType(image, imageFile = null) {
  try {
    console.log('🔍 Analyzing image type with Gemini AI...');

    if (!this.initialized) {
      await this.initialize();
    }

    let imgFile = imageFile || image;
    if (typeof image === 'string' && image.startsWith('data:')) {
      imgFile = this.dataURLToFile(image);
    }

    // ✅ NEW: Check for education/meeting first (highest priority)
    const meetingCheck = await educationDetectionService.detectMeetingType(imgFile);
    if (meetingCheck.isMeeting && meetingCheck.confidence > 0.7) {
      console.log('✅ Detected EDUCATION MEETING with Gemini AI');
      return {
        type: 'education',
        confidence: meetingCheck.confidence,
        details: {
          isMeeting: true,
          platform: meetingCheck.platform,
          reason: meetingCheck.reason,
          aiAnalysis: true
        }
      };
    }

    // Existing weight scale detection
    const detection = await weightDetectionService.detectImageType(imgFile);
    
    if (detection.isWeightScale && detection.confidence > 0.6) {
      type = 'weight';
      // ... existing code
    } else {
      type = 'food'; // Default fallback
    }

    return { type, confidence, details };

  } catch (error) {
    // Default to food on error
    return { type: 'food', confidence: 0.3, details: { error: error.message } };
  }
}
```

**Detection Priority:**
1. **Education** (confidence > 0.7) - Highest priority
2. **Weight** (confidence > 0.6) - Medium priority
3. **Food** - Default fallback

**Testing:**
- [ ] Upload meeting screenshot → detects as 'education'
- [ ] Upload weight scale → still detects as 'weight'
- [ ] Upload food → still detects as 'food'

---

## **STEP 5: Update App.js - Main Handler** 🎯

**File:** `frontend/src/App.js`

**Action:** Modify existing file

**Changes Required:**

### **5A: Add State Variables**

**Location:** Near line 150 (after other state declarations)

```javascript
// Existing states
const [weightResult, setWeightResult] = useState(null);
const [nutritionData, setNutritionData] = useState(null);

// ✅ NEW: Education state
const [educationResult, setEducationResult] = useState(null);
```

### **5B: Add Save Function**

**Location:** After saveWeightEntry() function (around line 400)

```javascript
const saveEducationLog = async (educationData, imageBase64) => {
  try {
    console.log('💾 Saving education log:', educationData);
    
    const userIdentifier = user.email || user.id || user.uid;
    
    // Get actual userId
    let actualUserId = user?.id;
    if (!actualUserId) {
      actualUserId = await getUserId(user);
    }
    
    const response = await fetch(`${apiBaseUrl}/api/save-education-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: actualUserId,
        imageBase64: imageBase64,
        platform: educationData.platform,
        topic: educationData.topic,
        confidence: educationData.confidence,
        deviceInfo: window.navigator.userAgent
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Education log saved successfully');
      setSaveLoading(false);
      // Could show success notification here
    } else {
      throw new Error(data.message || 'Failed to save education log');
    }
    
  } catch (error) {
    console.error('❌ Failed to save education log:', error);
    setSaveError('Failed to save education log. Please try again.');
    setSaveLoading(false);
  }
};
```

### **5C: Update handleImageSelect() Function**

**Location:** Around line 1095

**Find this code:**
```javascript
if (detectedType.type === 'weight' && detectedType.confidence > 0.6) {
  // handle weight
  setImageType('weight');
  // ... existing weight code
  return;
}

// It's a food image
setImageType('food');
```

**Insert BEFORE the weight check:**
```javascript
// ✅ NEW: Check for education/meeting first
if (detectedType.type === 'education' && detectedType.confidence > 0.7) {
  console.log('🎓 Education meeting detected, analyzing...');
  setImageType('education');
  
  try {
    const educationData = await educationDetectionService.analyzeMeetingImage(file);
    
    if (educationData.success) {
      console.log('✅ Education data extracted:', educationData);
      
      setEducationResult({
        platform: educationData.platform,
        topic: educationData.topic, // Already has fallback applied
        confidence: educationData.confidence,
        participantCount: educationData.participantCount
      });
      
      // Auto-save to database
      setLoadingState('saving');
      setSaveLoading(true);
      await saveEducationLog(educationData, processedImage);
    } else {
      setError('Unable to analyze meeting screenshot. Please try again.');
    }
  } catch (err) {
    console.error('❌ Education analysis failed:', err);
    setError('Failed to analyze meeting screenshot: ' + err.message);
  }
  
  setLoading(false);
  return;
}

// Existing weight check continues...
if (detectedType.type === 'weight' && detectedType.confidence > 0.6) {
  // ... existing code
}
```

### **5D: Update Dashboard Initial Tab Logic**

**Location:** Around line 296 (in showDashboardPage function)

**Find:**
```javascript
if (imageType === 'weight') {
  setDashboardInitialTab('weight');
} else if (imageType === 'food') {
  setDashboardInitialTab('nutrition');
}
```

**Update to:**
```javascript
if (imageType === 'weight') {
  setDashboardInitialTab('weight');
} else if (imageType === 'food') {
  setDashboardInitialTab('nutrition');
} else if (imageType === 'education') {
  setDashboardInitialTab('education'); // ✅ NEW
}
```

**Testing:**
- [ ] Upload meeting screenshot → calls educationDetectionService
- [ ] Verify auto-save to database
- [ ] Check error handling
- [ ] Verify other image types still work (food, weight)

---

## **STEP 6: Import Services in App.js** 📦

**File:** `frontend/src/App.js`

**Location:** Top of file (imports section, around line 10-30)

**Add:**
```javascript
import { educationDetectionService } from './services/educationDetectionService';
```

---

## **STEP 7: Create Education Log Display Component** 🎨

**File:** `frontend/src/components/EducationLogCard.js`

**Action:** Create new file

**Purpose:** Display education meeting result after analysis

**Code Structure:**
```javascript
import React from 'react';

const EducationLogCard = ({ educationData, onClose }) => {
  if (!educationData) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      {/* Success Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">🎓</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Education Meeting Logged</h3>
            <p className="text-sm text-gray-500">Successfully recorded your attendance</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Meeting Details */}
      <div className="space-y-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4">
        {/* Platform */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="text-xs text-gray-500 font-medium">Platform</p>
            <p className="text-base font-semibold text-gray-900">{educationData.platform}</p>
          </div>
        </div>

        {/* Topic */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-xs text-gray-500 font-medium">Topic</p>
            <p className="text-base font-semibold text-gray-900">{educationData.topic}</p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🕒</span>
          <div>
            <p className="text-xs text-gray-500 font-medium">Logged At</p>
            <p className="text-base font-semibold text-gray-900">
              {new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </p>
          </div>
        </div>

        {/* Confidence (Optional - for debugging) */}
        {educationData.confidence && (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-xs text-gray-500 font-medium">Confidence</p>
              <p className="text-base font-semibold text-gray-900">
                {(educationData.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-sm text-green-800 text-center font-medium">
          ✅ Your education meeting attendance has been recorded
        </p>
      </div>
    </div>
  );
};

export default EducationLogCard;
```

**Features:**
- Clean, modern UI matching app design
- Shows all relevant info (platform, topic, timestamp)
- Success confirmation
- Optional close button

**Testing:**
- [ ] Renders correctly with education data
- [ ] Shows platform name
- [ ] Shows topic (with fallback)
- [ ] Displays timestamp
- [ ] Close button works

---

## **STEP 8: Update App.js - Display Component** 🖼️

**File:** `frontend/src/App.js`

**Action:** Modify existing file

### **8A: Import Component**

**Location:** Top of file (imports section)

```javascript
import EducationLogCard from './components/EducationLogCard';
```

### **8B: Add Display Logic**

**Location:** Around line 1822-1840 (where NutritionCard and WeightResult are displayed)

**Find:**
```javascript
{imageType === 'food' && nutritionData && <NutritionCard ... />}
{imageType === 'weight' && weightResult && <WeightResult ... />}
```

**Add AFTER or BEFORE these lines:**
```javascript
{/* Education Meeting Result */}
{imageType === 'education' && educationResult && (
  <EducationLogCard 
    educationData={educationResult}
    onClose={() => {
      setEducationResult(null);
      setImagePreview(null);
      setSelectedImage(null);
    }}
  />
)}
```

**Testing:**
- [ ] Education card displays after successful detection
- [ ] Shows correct platform and topic
- [ ] Close button clears the result
- [ ] Doesn't interfere with food/weight displays

---

## **STEP 9: Add Reset Logic** 🔄

**File:** `frontend/src/App.js`

**Action:** Modify resetApp() function

**Location:** Around line 1330

**Find:**
```javascript
const resetApp = () => {
  setSelectedImage(null);
  setImagePreview(null);
  setNutritionData(null);
  setError(null);
  setUser(null);
  setIsOtpVerified(false);
  setSaveError(null);
  setLoadingState('analyzing');
};
```

**Update to:**
```javascript
const resetApp = () => {
  setSelectedImage(null);
  setImagePreview(null);
  setNutritionData(null);
  setWeightResult(null);
  setEducationResult(null); // ✅ NEW
  setError(null);
  setUser(null);
  setIsOtpVerified(false);
  setSaveError(null);
  setLoadingState('analyzing');
};
```

---

## **STEP 10: Create Education Dashboard Component** 📊

**File:** `frontend/src/components/EducationDashboard.js`

**Action:** Create new file (similar to WeightDashboard.js)

**Purpose:** Display education meeting history with monthly grouping

**Code Structure:**
```javascript
import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { BookOpen, Calendar, RotateCcw } from 'lucide-react';
import { getUserId } from '../services/getUserId';

const UNDO_SECONDS = 10; // undo countdown duration

// Lazy load card component
const EducationCard = lazy(() => import('./EducationCard'));

/**
 * UndoRow - Inline undo component with countdown (like WeightDashboard)
 */
const UndoRow = ({ pid, originalLog, expiresAt, ttlSeconds = UNDO_SECONDS, onRestore, onExpire }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const { total, delayAtMount } = useMemo(() => {
    const total = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - total * 1000;
    const elapsedAtMount = Math.min(total, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => onExpire(), msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <BookOpen className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed:</span> {originalLog.Topic}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>

      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalLog);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'}`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>

      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span
          key={pid}
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`
          }}
        />
      </span>
    </div>
  );
};

const EducationDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  // State management
  const [educationLogs, setEducationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Undo state
  const [undoState, setUndoState] = useState({});
  
  // Cache userId
  const userIdRef = useRef(null);

  /**
   * Group education logs by month (like WeightDashboard)
   */
  const monthlyGroups = useMemo(() => {
    const grouped = {};
    
    educationLogs.forEach(log => {
      if (!log || !log.CreatedAt) return;
      
      const date = new Date(log.CreatedAt.replace('Z', ''));
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName,
          entries: [],
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1)
        };
      }
      
      grouped[monthKey].entries.push(log);
    });
    
    return Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
  }, [educationLogs]);

  /**
   * Get month statistics
   */
  const getMonthStats = (entries) => {
    if (!entries || entries.length === 0) return null;
    
    const platforms = {};
    entries.forEach(log => {
      platforms[log.Platform] = (platforms[log.Platform] || 0) + 1;
    });
    
    const mostUsedPlatform = Object.keys(platforms).reduce((a, b) => 
      platforms[a] > platforms[b] ? a : b, Object.keys(platforms)[0]
    );
    
    return {
      count: entries.length,
      mostUsedPlatform,
      platforms: Object.keys(platforms).length
    };
  };

  /**
   * Fetch education logs on mount
   */
  useEffect(() => {
    fetchEducationLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fetch education logs from API
   */
  const fetchEducationLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userIdRef.current) {
        userIdRef.current = user?.id || await getUserId(user);
      }
      const userId = userIdRef.current;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`${apiBaseUrl}/api/get-education-logs?userId=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch education logs');
      }

      setEducationLogs(data.logs || []);

    } catch (err) {
      console.error('❌ Fetch education logs error:', err);
      setError(err.message || 'Failed to load education logs');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="backdrop-blur-xl bg-white/30 rounded-2xl p-12 border border-white/30 shadow-2xl">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-300 border-t-purple-600 mb-6 mx-auto"></div>
          <p className="text-gray-700 font-semibold text-xl text-center">Loading education logs...</p>
        </div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!educationLogs || educationLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Education Logs Yet</h3>
          <p className="text-gray-600 mb-4">
            Upload meeting screenshots to automatically track your education sessions
          </p>
        </div>
      </div>
    );
  }

  /**
   * Handle delete education log with undo support (like WeightDashboard)
   */
  const handleDeleteLog = async (logToDelete) => {
    const placeholder = {
      Id: `undo-${logToDelete.Id}`,
      isUndoPlaceholder: true,
      CreatedAt: logToDelete.CreatedAt,
      Platform: logToDelete.Platform,
      Topic: logToDelete.Topic
    };

    // Replace entry in-place with placeholder (no flicker)
    setEducationLogs(prev => {
      const idx = prev.findIndex(e => e.Id === logToDelete.Id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    // Store undo state
    setUndoState(prev => ({
      ...prev,
      [placeholder.Id]: {
        originalLog: logToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS
      }
    }));

    // Immediately soft-delete in backend
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/delete-education-log`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          logId: logToDelete.Id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete education log');
      }

      console.log('✅ Education log soft-deleted:', logToDelete.Id);

    } catch (err) {
      console.error('❌ Delete error:', err);
      // Rollback on backend failure
      setEducationLogs(prev => {
        const idx = prev.findIndex(e => e.Id === placeholder.Id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, logToDelete);
        return next;
      });
      setUndoState(prev => {
        const next = { ...prev };
        delete next[placeholder.Id];
        return next;
      });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  /**
   * Handle undo restore
   */
  const handleUndoRestore = async (pid, originalLog) => {
    // Optimistic restore
    setEducationLogs(prev => {
      const idx = prev.findIndex(e => e.Id === pid);
      if (idx === -1) return prev.concat(originalLog);
      const next = prev.slice();
      next.splice(idx, 1, originalLog);
      return next;
    });
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Call backend undo API
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/undo-deleted-education-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: originalLog.Id,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore log');
      }

      console.log('✅ Education log restored:', originalLog.Id);

    } catch (err) {
      console.error('❌ Undo restore error:', err);
      // Rollback - put placeholder back
      setEducationLogs(prev => {
        const idx = prev.findIndex(e => e.Id === originalLog.Id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, { 
          Id: pid, 
          isUndoPlaceholder: true, 
          CreatedAt: originalLog.CreatedAt,
          Platform: originalLog.Platform,
          Topic: originalLog.Topic
        });
        return next;
      });
      setUndoState(prev => ({
        ...prev,
        [pid]: {
          originalLog,
          expiresAt: Date.now() + UNDO_SECONDS * 1000,
          ttlSeconds: UNDO_SECONDS
        }
      }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  };

  /**
   * Handle undo expiration
   */
  const handleUndoExpire = async (pid, originalLog) => {
    // Remove placeholder from UI
    setEducationLogs(prev => prev.filter(e => e.Id !== pid));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    console.log('⏱️ Undo timer expired, log remains deleted:', originalLog.Id);
  };

  /**
   * Render overview
   */
  return (
    <>
      {/* CSS keyframes for countdown animation */}
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
    <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2">
      <div className="px-4 md:px-6">
        {/* Latest Education Summary Card */}
        <div className="mb-6">
          <div className="w-full max-w-md mx-auto bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-purple-600 font-medium">Total Sessions</p>
                <p className="text-3xl font-bold text-purple-900">{educationLogs.length}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full p-3">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
            
            {monthlyGroups.length > 0 && (() => {
              const currentMonthStats = getMonthStats(monthlyGroups[0].entries);
              return (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-200">
                  <div>
                    <p className="text-xs text-purple-600">This Month</p>
                    <p className="text-lg font-semibold text-purple-900">{currentMonthStats.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-600">Top Platform</p>
                    <p className="text-lg font-semibold text-purple-900 truncate">{currentMonthStats.mostUsedPlatform}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Monthly Groups */}
        {monthlyGroups.map((monthGroup, groupIndex) => {
          const monthStats = getMonthStats(monthGroup.entries);
          
          return (
            <div key={monthGroup.monthKey} className="mb-8">
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                {/* Month Header */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">
                        {monthGroup.monthName}
                      </span>
                    </div>
                    <span className="text-xs text-purple-600">
                      {monthStats.count} {monthStats.count === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                </div>

                {/* Month Entries */}
                <div className="p-4 space-y-3">
                  {monthGroup.entries
                    .filter(log => log && log.Id && log.CreatedAt)
                    .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
                    .map((log, index) => {
                      // Show undo row if this is a placeholder
                      if (log.isUndoPlaceholder) {
                        const undoEntry = undoState[log.Id];
                        if (!undoEntry || !undoEntry.originalLog) return null;
                        return (
                          <UndoRow
                            key={log.Id}
                            pid={log.Id}
                            originalLog={undoEntry.originalLog}
                            expiresAt={undoEntry.expiresAt}
                            ttlSeconds={undoEntry.ttlSeconds ?? UNDO_SECONDS}
                            onRestore={handleUndoRestore}
                            onExpire={() => handleUndoExpire(log.Id, undoEntry.originalLog)}
                          />
                        );
                      }

                      const skeleton = (
                        <div className="bg-gray-50 rounded-xl p-4 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      );

                      return (
                        <Suspense key={log.Id} fallback={skeleton}>
                          <EducationCard
                            data={log}
                            onDelete={handleDeleteLog}
                            index={index}
                          />
                        </Suspense>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
};

export default EducationDashboard;
```

**Key Features:**
- Monthly grouping (like WeightDashboard)
- Latest stats summary card
- Lazy loading for performance
- Empty state handling
- Loading state
- Month statistics (count, platforms used)

**Testing:**
- [ ] Displays education logs correctly
- [ ] Groups by month properly
- [ ] Shows empty state when no logs
- [ ] Loading state works
- [ ] Stats card shows correct numbers

---

## **STEP 11: Create Education Card Component** 🎴

**File:** `frontend/src/components/EducationCard.js`

**Action:** Create new file (similar to WeightCard.js)

**Purpose:** Display individual education log entry

**Code Structure:**
```javascript
import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Calendar, Award } from 'lucide-react';

const platformIcons = {
  'Google Meet': '📱',
  'Zoom': '💻',
  'Microsoft Teams': '👥',
  'WebEx': '🌐',
  'Skype': '💬',
  'default': '🎓'
};

const platformColors = {
  'Google Meet': 'from-green-500 to-emerald-500',
  'Zoom': 'from-blue-500 to-indigo-500',
  'Microsoft Teams': 'from-purple-500 to-pink-500',
  'WebEx': 'from-orange-500 to-red-500',
  'Skype': 'from-cyan-500 to-blue-500',
  'default': 'from-purple-500 to-indigo-500'
};

/**
 * EducationCard Component
 * Card with swipe-to-delete functionality (like WeightCard)
 */
const EducationCard = React.memo(({ 
  data, 
  onDelete,
  index = 0 
}) => {
  // Swipe-to-delete state
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletedOnce, setDeletedOnce] = useState(false);

  const startXRef = useRef(0);
  const rafRef = useRef(null);
  const elRef = useRef(null);

  const SWIPE_DELETE_THRESHOLD = 100;
  const SWIPE_MAX = 140;

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => () => cancelRAF(), []);

  if (!data) return null;

  const { Platform, Topic, CreatedAt, Confidence } = data;
  
  const date = new Date(CreatedAt.replace('Z', ''));
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });

  const platformIcon = platformIcons[Platform] || platformIcons.default;
  const gradientClass = platformColors[Platform] || platformColors.default;

  // Swipe handlers
  const onPointerDown = (e) => {
    if (!e.isPrimary || leaving) return;
    cancelRAF();
    setDragging(true);
    setAnimating(false);
    startXRef.current = e.clientX;
    elRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !e.isPrimary || leaving) return;
    const delta = e.clientX - startXRef.current;
    const nextDx = Math.max(Math.min(delta, 0), -SWIPE_MAX);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(nextDx);
        rafRef.current = null;
        const isNowArmed = Math.abs(nextDx) >= SWIPE_DELETE_THRESHOLD;
        if (isNowArmed !== armed) {
          setArmed(isNowArmed);
          if (isNowArmed && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(10); } catch {}
          }
        }
      });
    }
  };

  const finishInteraction = (e) => {
    if (!dragging) return;
    setDragging(false);
    cancelRAF();
    elRef.current?.releasePointerCapture?.(e?.pointerId);

    if (Math.abs(dx) >= SWIPE_DELETE_THRESHOLD) {
      if (deletedOnce) return;
      setDeletedOnce(true);
      setLeaving(true);
      setAnimating(true);

      requestAnimationFrame(() => {
        setDx(-window.innerWidth);
        setTimeout(() => {
          onDelete(data);
        }, 180);
      });
      return;
    }

    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      setTimeout(() => {
        setAnimating(false);
        setArmed(false);
      }, 220);
    });
  };

  const onPointerUp = (e) => finishInteraction(e);
  const onPointerCancel = (e) => finishInteraction(e);
  const onPointerLeave = (e) => finishInteraction(e);

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return (
    <div 
      className="relative w-full"
      style={{ 
        touchAction: 'pan-y',
        minHeight: 72,
        animation: 'slideInUp 0.2s ease-out both'
      }}
    >
      {/* Background delete reveal */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)',
              strokeWidth: armed ? 2.2 : 2,
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Foreground card */}
      <div
        ref={elRef}
        role="button"
        aria-label={`Education: ${Topic}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        className={`relative z-10 bg-white border border-purple-100 rounded-xl select-none cursor-pointer overflow-hidden
          ${leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          minHeight: 72,
          willChange: 'transform',
        }}
      >
        {/* Bottom progress bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{
            width: `${progress * 100}%`,
            transition: dragging ? 'none' : 'width 180ms ease',
            opacity: progress > 0 ? 1 : 0,
          }}
        />

        <div className="p-4 flex items-start gap-3">
          {/* Platform Icon */}
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0`}>
            <span className="text-2xl">{platformIcon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Topic */}
            <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
              {Topic}
            </h3>

            {/* Platform */}
            <div className="flex items-center gap-1.5 text-sm text-purple-600 mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="font-medium">{Platform}</span>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formattedDate}</span>
              </div>
              <span>•</span>
              <span>{formattedTime}</span>
            </div>

            {/* Confidence Badge (optional) */}
            {Confidence && Confidence > 0.8 && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full">
                <Award className="w-3 h-3 text-green-600" />
                <span className="text-[10px] font-medium text-green-700">
                  High Confidence
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

EducationCard.displayName = 'EducationCard';

export default EducationCard;
```

**Key Features:**
- ✅ **Swipe-to-delete** functionality (like WeightCard)
- Platform-specific icons and colors
- Date and time display
- Confidence badge (optional)
- Smooth animations and haptic feedback
- Touch-optimized gesture handling
- Progress bar shows delete threshold
- Visual feedback with red delete icon

**Testing:**
- [ ] Renders correctly with all data
- [ ] Shows platform icon
- [ ] Displays date/time properly
- [ ] Confidence badge shows when > 0.8
- [ ] ✅ **Swipe left to reveal delete**
- [ ] ✅ **Progress bar shows during swipe**
- [ ] ✅ **Haptic feedback on delete threshold**
- [ ] ✅ **Smooth delete animation**
- [ ] ✅ **Card scales slightly during swipe**

---

## **STEP 12: Update Dashboard.js - Add Education Tab** 🔄

**File:** `frontend/src/components/Dashboard.js`

**Action:** Modify existing file

**Changes Required:**

### **12A: Import Education Dashboard**

**Location:** Top of file (around line 31)

**Add:**
```javascript
const WeightDashboard = lazy(() => import('./WeightDashboard'));
const EducationDashboard = lazy(() => import('./EducationDashboard')); // ✅ NEW
```

### **12B: Add Education Icon Component**

**Location:** After WeighingScaleIcon component (around line 28)

**Add:**
```javascript
// Education icon component
const EducationIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
    <path d="M8 15h6" />
  </svg>
);
```

### **12C: Update State to Support Education Tab**

**Location:** Around line 44

**Find:**
```javascript
const [activeTab, setActiveTab] = useState(() => {
  if (initialTab && (initialTab === 'nutrition' || initialTab === 'weight')) {
    localStorage.setItem('dashboard_activeTab', initialTab);
    return initialTab;
  }
  return localStorage.getItem('dashboard_activeTab') || 'nutrition';
});
```

**Update to:**
```javascript
const [activeTab, setActiveTab] = useState(() => {
  if (initialTab && (initialTab === 'nutrition' || initialTab === 'weight' || initialTab === 'education')) {
    localStorage.setItem('dashboard_activeTab', initialTab);
    return initialTab;
  }
  return localStorage.getItem('dashboard_activeTab') || 'nutrition';
});
```

### **12D: Update Calendar Visibility Logic**

**Location:** Around line 95

**Find:**
```javascript
{activeTab === 'weight' && (
  <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11"></div>
)}
```

**Update to:**
```javascript
{(activeTab === 'weight' || activeTab === 'education') && (
  <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11"></div>
)}
```

### **12E: Add Education Tab Button**

**Location:** After weight tab button (around line 134)

**Add:**
```javascript
<button
  onClick={() => handleTabChange('education')}
  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
    activeTab === 'education'
      ? 'border-purple-600 text-purple-700'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  <EducationIcon className="h-4 w-4" />
  <span>Education</span>
</button>
```

### **12F: Add Education Dashboard Content**

**Location:** After WeightDashboard render (around line 325)

**Add:**
```javascript
{activeTab === 'education' && (
  <EducationDashboard
    user={user}
    onBack={onBack}
    apiBaseUrl={apiBaseUrl}
    hideHeader={true}
  />
)}
```

**Testing:**
- [ ] Education tab appears in dashboard
- [ ] Clicking education tab switches view
- [ ] Education dashboard loads correctly
- [ ] Tab state persists in localStorage
- [ ] Calendar button hidden on education tab
- [ ] Other tabs still work (nutrition, weight)

---

---

## 🧪 **Testing Checklist**

### **Backend Testing:**
- [ ] Database table created successfully
- [ ] Can insert education log via SQL
- [ ] Can query education logs
- [ ] Foreign key constraint works
- [ ] API POST `/api/save-education-log` works
- [ ] API GET `/api/get-education-logs` works (excludes deleted)
- [ ] API DELETE `/api/delete-education-log` works (soft delete)
- [ ] API POST `/api/undo-deleted-education-log` works
- [ ] ✅ **Swipe delete sets IsDeleted = 1**
- [ ] ✅ **Undo restores deleted log (IsDeleted = 0)**
- [ ] ✅ **Undo timer expires after 10 seconds**

### **AI Detection Testing:**
- [ ] Google Meet screenshot detected correctly
- [ ] Zoom screenshot detected correctly
- [ ] Microsoft Teams screenshot detected correctly
- [ ] Food photo NOT detected as meeting
- [ ] Weight scale NOT detected as meeting
- [ ] Topic fallback works when title not found
- [ ] Confidence scores are reasonable (>0.7)

### **Integration Testing:**
- [ ] Upload meeting screenshot → auto-detects as education
- [ ] Auto-saves to database without errors
- [ ] EducationLogCard displays correctly
- [ ] Food upload still works (not broken)
- [ ] Weight upload still works (not broken)
- [ ] Can upload multiple types in sequence

### **UI Testing:**
- [ ] Education card shows platform name
- [ ] Education card shows topic (with fallback)
- [ ] Timestamp displays correctly
- [ ] Close button works
- [ ] No visual glitches
- [ ] Mobile responsive
- [ ] ✅ **Swipe gesture smooth on mobile**
- [ ] ✅ **Delete animation plays correctly**
- [ ] ✅ **Can't swipe while card is leaving**
- [ ] ✅ **Undo row appears after swipe delete**
- [ ] ✅ **Undo button restores log**
- [ ] ✅ **Countdown timer shows remaining seconds**
- [ ] ✅ **Progress bar shrinks over 10 seconds**
- [ ] ✅ **Placeholder removed after timer expires**

### **Error Handling:**
- [ ] Network error handled gracefully
- [ ] Invalid image handled
- [ ] Database error doesn't crash app
- [ ] Gemini API error falls back to food

---

## 📦 **Files Summary**

### **New Files (10):**
1. ✅ `sql/create_education_logs_table.sql` - Includes IsDeleted column
2. ✅ `backend/pages/api/save-education-log.js`
3. ✅ `backend/pages/api/get-education-logs.js` - Excludes deleted records
4. ✅ `backend/pages/api/delete-education-log.js` - Soft delete (IsDeleted = 1)
5. ✅ `backend/pages/api/undo-deleted-education-log.js` - Restore deleted logs
6. ✅ `frontend/src/services/educationDetectionService.js`
7. ✅ `frontend/src/components/EducationLogCard.js` - Result display after upload
8. ✅ `frontend/src/components/EducationDashboard.js` - Dashboard with undo support
9. ✅ `frontend/src/components/EducationCard.js` - Individual log card with swipe-to-delete

### **Modified Files (3):**
1. ✅ `frontend/src/services/imageTypeDetector.js`
2. ✅ `frontend/src/App.js`
3. ✅ `frontend/src/components/Dashboard.js`

---

## 🚀 **Implementation Sequence**

### **Phase 1 - Backend (30 minutes):**
1. Create database table (Step 1)
2. Create save API (Step 2A)
3. Create fetch API (Step 2B)
4. Test with Postman/curl

### **Phase 2 - AI Service (60 minutes):**
1. Create educationDetectionService.js (Step 3)
2. Write Gemini prompts
3. Test with sample images
4. Verify fallback logic

### **Phase 3 - Integration (90 minutes):**
1. Update imageTypeDetector.js (Step 4)
2. Update App.js handler (Step 5)
3. Add imports (Step 6)
4. Test end-to-end flow

### **Phase 4 - UI (120 minutes):**
1. Create EducationLogCard (Step 7)
2. Add display logic to App.js (Step 8)
3. Add reset logic (Step 9)
4. Create EducationDashboard (Step 10)
5. Create EducationCard (Step 11)
6. Update Dashboard tabs (Step 12)
7. Test all UI components

**Total Estimated Time: 5-6 hours**

---

## 💡 **Key Implementation Notes**

1. **Topic is NEVER null:**
   - Gemini returns `detectedTitle` (can be null)
   - Service applies fallback: `topic = detectedTitle || "Education Meeting"`
   - Database and UI always receive a valid string

2. **Detection Priority:**
   - Education > Weight > Food (default)
   - Each has different confidence threshold

3. **Error Handling:**
   - Always default to 'food' type on detection failure
   - Show user-friendly error messages
   - Log detailed errors for debugging

4. **Performance:**
   - Reuse existing Gemini instance
   - Image compression before upload
   - Async/await for non-blocking UI

5. **Security:**
   - Validate all inputs
   - SQL injection prevention (parameterized queries)
   - CORS properly configured
   - File size limits enforced

---

## 📝 **Post-Implementation Tasks**

- [ ] Update user documentation
- [ ] Add to changelog
- [ ] Update privacy policy (if needed)
- [ ] Monitor Gemini API usage
- [ ] Collect user feedback
- [ ] Optimize detection accuracy based on real usage

---

## 🎯 **Success Criteria**

✅ **Feature is complete when:**
1. User can upload meeting screenshot
2. System auto-detects as education (>70% accuracy)
3. Platform is correctly identified
4. Topic shows detected or default value
5. Log is saved to database
6. Result card displays correctly
7. Food/weight detection still works
8. No errors in console

---

**Ready to implement! Follow steps 1-9 in sequence.** 🚀
