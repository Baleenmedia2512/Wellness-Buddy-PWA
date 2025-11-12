# Weight Tracking Feature - Complete Implementation Guide

## 📋 Overview

The **Weight Tracking Feature** allows users to track their weight by taking photos of their weighing scale. The system uses **OCR (Optical Character Recognition)** powered by Tesseract.js to automatically extract weight values from the images.

### Key Features
- ✅ **Camera-only photo capture** (no gallery uploads)
- ✅ **Automatic OCR weight extraction** from scale images
- ✅ **Manual weight entry fallback** if OCR fails
- ✅ **Weight validation** (20-300 kg or 44-660 lbs)
- ✅ **Complete weight history** with statistics
- ✅ **Weight trend tracking** (gains, losses, averages)
- ✅ **Image storage** for future reference
- ✅ **Soft delete** capability with undo option

---

## 🗂️ File Structure

### Backend Files

```
backend/pages/api/
├── save-weight-entry.js       # API to save weight entries
├── get-weight-history.js      # API to fetch weight history
└── delete-weight-entry.js     # API to delete weight entries (soft delete)
```

### Frontend Files

```
frontend/src/
├── components/
│   ├── WeightCapture.js       # Photo capture + OCR processing
│   ├── WeightInsights.js      # Weight history & statistics display
│   └── Header.js              # Updated with Weight Tracking button
├── services/
│   └── weightOcrService.js    # Tesseract.js OCR service
└── App.js                     # Main app with routing
```

### Database Schema

```
sql/
└── weight_tracking_schema.sql  # Database table schema
```

---

## 🗄️ Database Schema

### Table: `weight_tracking`

```sql
CREATE TABLE IF NOT EXISTS weight_tracking (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  UserID VARCHAR(255) NOT NULL,
  WeightValue DECIMAL(5,2) NOT NULL,
  Unit VARCHAR(10) DEFAULT 'kg',
  ImagePath VARCHAR(500) DEFAULT NULL,
  ImageBase64 LONGTEXT DEFAULT NULL,
  ConfidenceScore DECIMAL(3,2) DEFAULT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  IsDeleted TINYINT(1) DEFAULT 0,
  Notes TEXT DEFAULT NULL,
  INDEX idx_user_id (UserID),
  INDEX idx_created_at (CreatedAt),
  INDEX idx_is_deleted (IsDeleted)
);
```

### To Create the Table:

```bash
# Connect to MySQL
mysql -u root -p

# Use your database
USE wellness_buddy;

# Run the schema file
SOURCE c:/xampp/htdocs/Wellness-Buddy-PWA-1/sql/weight_tracking_schema.sql;
```

---

## 🔌 Backend API Endpoints

### 1. Save Weight Entry

**Endpoint:** `POST /api/save-weight-entry`

**Request Body:**
```json
{
  "userId": "user@example.com",
  "weightValue": 72.5,
  "unit": "kg",
  "imagePath": "weight_1699999999.jpg",
  "imageBase64": "data:image/jpeg;base64,...",
  "confidenceScore": 0.85,
  "notes": "Morning weight"
}
```

**Response:**
```json
{
  "success": true,
  "id": 123,
  "message": "Weight entry saved successfully",
  "data": {
    "userId": "user@example.com",
    "weightValue": 72.5,
    "unit": "kg",
    "confidenceScore": 0.85,
    "timestamp": "2025-11-10T10:30:00.000Z"
  }
}
```

### 2. Get Weight History

**Endpoint:** `POST /api/get-weight-history`

**Request Body:**
```json
{
  "userId": "user@example.com",
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "ID": 123,
      "WeightValue": 72.5,
      "Unit": "kg",
      "ImagePath": "weight_1699999999.jpg",
      "ImageBase64": "data:image/jpeg;base64,...",
      "ConfidenceScore": 0.85,
      "Notes": null,
      "CreatedAt": "2025-11-10T10:30:00.000Z"
    }
  ],
  "stats": {
    "totalEntries": 15,
    "latestWeight": {
      "value": 72.5,
      "unit": "kg",
      "date": "2025-11-10T10:30:00.000Z"
    },
    "previousWeight": {
      "value": 73.0,
      "unit": "kg",
      "date": "2025-11-09T10:30:00.000Z"
    },
    "weightChange": -0.5,
    "averageWeight": 72.8,
    "minWeight": 71.0,
    "maxWeight": 75.0
  },
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### 3. Delete Weight Entry

**Endpoint:** `POST /api/delete-weight-entry`

**Request Body:**
```json
{
  "userId": "user@example.com",
  "entryId": 123
}
```

**Response:**
```json
{
  "success": true,
  "message": "Weight entry deleted successfully",
  "deletedId": 123
}
```

---

## 🎯 OCR Service (weightOcrService.js)

### Key Methods

#### `extractWeightFromImage(image)`
Extracts weight value from weighing scale image using OCR.

**Parameters:**
- `image` (string|File): Image data URL or File object

**Returns:**
```javascript
{
  success: true,
  weightValue: 72.5,
  unit: "kg",
  confidence: 0.85,
  rawText: "72.5 kg"
}
```

#### `parseWeightFromText(text)`
Parses weight value from OCR text.

**Patterns Detected:**
- `72.5 kg`
- `160 lbs`
- `72,5` (comma as decimal separator)
- `160.2`

**OCR Error Corrections:**
- `O` → `0`
- `l` → `1`
- `I` → `1`
- `S` → `5`
- `B` → `8`

#### `validateWeight(weight, unit)`
Validates weight value is within acceptable range.

**Valid Ranges:**
- kg: 20 - 300 kg
- lbs: 44 - 660 lbs

#### `convertWeight(weight, fromUnit, toUnit)`
Converts weight between kg and lbs.

---

## 🎨 User Interface Components

### WeightCapture Component

**Features:**
- Camera button to capture weighing scale photo
- Automatic OCR processing with progress indicator
- Manual weight entry if OCR fails
- Unit selection (kg/lbs)
- Weight validation
- Save/Retake buttons

**Props:**
```javascript
<WeightCapture 
  user={user}
  apiBaseUrl="http://localhost:3000"
  onWeightSaved={(data) => console.log('Saved:', data)}
/>
```

### WeightInsights Component

**Features:**
- Statistics cards (latest weight, change, average)
- Weight history list with timeline
- Image preview for each entry
- Delete functionality with confirmation
- Weight trend visualization placeholder

**Props:**
```javascript
<WeightInsights 
  user={user}
  apiBaseUrl="http://localhost:3000"
  onBack={() => console.log('Back pressed')}
/>
```

---

## 🚀 Usage Flow

### User Workflow

1. **User clicks "Weight Tracking" in Header menu**
   - Opens WeightCapture page

2. **User takes photo of weighing scale**
   - Camera opens (camera only, no gallery)
   - User captures clear photo of scale display

3. **OCR Processing**
   - Tesseract.js extracts text from image
   - System parses weight value (e.g., "72.5 kg")
   - Shows confidence score

4. **Review & Edit (if needed)**
   - User can manually edit weight value
   - Change unit (kg ↔ lbs)
   - Add optional notes

5. **Save to Database**
   - Weight entry saved with image
   - Success message displayed
   - Redirects to Insights page

6. **View History**
   - See all past weight entries
   - View statistics and trends
   - Click entry to see original image
   - Delete entries if needed

---

## 📱 Navigation

### Header Menu Options

```
┌─────────────────────────────┐
│  User Avatar (Click)        │
├─────────────────────────────┤
│ 📊 Nutrition Dashboard      │
│ ⚖️  Weight Tracking         │  ← NEW
│ 📸 Test Camera              │
│ 🚪 Sign Out                 │
└─────────────────────────────┘
```

### Page Navigation

```
Main App
  ├── Nutrition Dashboard
  ├── Weight Tracking          ← NEW
  │   └── Weight Insights      ← NEW
  └── Camera Test
```

---

## ⚠️ Error Handling

### OCR Failures

**Error Message:**
```
"Unable to detect weight. Please retake the photo."
```

**Fallback:**
- Manual weight entry field appears
- User can type weight directly
- Validation still applies

### Validation Errors

**Weight out of range:**
```
"Weight must be between 20 and 300 kg"
```

**Invalid format:**
```
"Please enter a valid weight value"
```

### Network Errors

**Save failure:**
```
"Failed to save weight. Please try again."
```

**Load failure:**
```
"Failed to load weight history"
```

---

## 🔧 Configuration

### Environment Variables

Ensure your `.env` file has:

```env
REACT_APP_API_BASE_URL=http://localhost:3000
```

### Database Connection

Backend APIs use these environment variables:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=wellness_buddy
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Take photo of weighing scale
- [ ] Verify OCR extracts correct weight
- [ ] Test manual entry fallback
- [ ] Test unit conversion (kg ↔ lbs)
- [ ] Save weight entry
- [ ] View weight history
- [ ] Check statistics calculation
- [ ] Test image preview
- [ ] Delete weight entry
- [ ] Test back navigation
- [ ] Test with poor image quality
- [ ] Test with different scale types

### Test Cases

#### 1. Perfect OCR Scenario
```
Input: Clear scale photo showing "72.5 kg"
Expected: Weight extracted as 72.5 kg with high confidence
```

#### 2. OCR Failure Scenario
```
Input: Blurry or unclear image
Expected: Error message + manual entry field appears
```

#### 3. Weight Validation
```
Input: Manual entry of "500 kg"
Expected: Error "Weight must be between 20 and 300 kg"
```

#### 4. History Display
```
Input: View insights after 3 entries
Expected: 
- Latest weight shown
- Weight change calculated
- Average displayed
```

---

## 📊 Performance Considerations

### OCR Processing Time
- Average: 2-5 seconds per image
- Depends on image size and device performance

### Image Storage
- Images stored as base64 in database
- Compression recommended for production
- Consider using separate image storage (S3, CDN) for scale

### Database Queries
- Indexed on `UserID` and `CreatedAt`
- Pagination implemented (50 entries per page)
- Soft delete for data recovery

---

## 🎯 Future Enhancements

### Planned Features
- [ ] Weight goal setting
- [ ] BMI calculation
- [ ] Weight chart visualization (line graph)
- [ ] Export weight data (CSV, PDF)
- [ ] Reminder notifications
- [ ] Multi-user support (family members)
- [ ] Integration with fitness apps
- [ ] Dark mode support

### Technical Improvements
- [ ] Image compression before upload
- [ ] Offline mode support
- [ ] Real-time sync across devices
- [ ] Advanced OCR models (Google Vision API)
- [ ] Voice input for weight entry

---

## 🐛 Troubleshooting

### Issue: OCR not detecting weight

**Solution:**
1. Ensure good lighting on scale display
2. Keep camera steady and focused
3. Avoid reflections or shadows
4. Try manual entry as fallback

### Issue: Images not loading in history

**Solution:**
1. Check database LONGTEXT field size limit
2. Verify base64 encoding is correct
3. Check CORS settings for image URLs

### Issue: Weight not saving

**Solution:**
1. Check network connectivity
2. Verify database connection
3. Check backend API logs
4. Ensure user authentication is valid

---

## 📝 Code Examples

### Using OCR Service Directly

```javascript
import { weightOcrService } from './services/weightOcrService';

// Extract weight from image
const result = await weightOcrService.extractWeightFromImage(imageFile);

if (result.success) {
  console.log('Weight:', result.weightValue, result.unit);
  console.log('Confidence:', result.confidence);
} else {
  console.error('OCR failed:', result.error);
}
```

### Saving Weight Entry

```javascript
const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.email,
    weightValue: 72.5,
    unit: 'kg',
    imageBase64: imageData,
    confidenceScore: 0.85
  })
});

const data = await response.json();
console.log('Saved:', data);
```

### Fetching Weight History

```javascript
const response = await fetch(`${apiBaseUrl}/api/get-weight-history`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.email,
    limit: 50,
    offset: 0
  })
});

const data = await response.json();
console.log('History:', data.data);
console.log('Stats:', data.stats);
```

---

## 🔒 Security Considerations

### Data Privacy
- Images stored securely in database
- User authentication required for all operations
- User can only access their own weight data

### Input Validation
- Weight values validated on both client and server
- SQL injection prevention (parameterized queries)
- XSS protection (sanitized inputs)

### API Security
- CORS enabled for trusted origins
- Request size limits (10MB max)
- Rate limiting recommended for production

---

## 📚 Dependencies

### Frontend
- `tesseract.js` v6.0.1 - OCR processing
- `@capacitor/camera` v7.0.1 - Camera access
- `react` v18.3.1
- `lucide-react` - Icons

### Backend
- `mysql2` v3.14.1 - Database driver
- `next` v15.3.5 - API routes

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Test with sample images
4. Contact development team

---

**Version:** 1.0.0  
**Last Updated:** November 10, 2025  
**Author:** Wellness Buddy Development Team
