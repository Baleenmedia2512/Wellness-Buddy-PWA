# Weight Tracking Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Database Table
```bash
mysql -u root -p
USE wellness_buddy;
SOURCE c:/xampp/htdocs/Wellness-Buddy-PWA-1/sql/weight_tracking_schema.sql;
```

### Step 2: Verify Installation
Check that tesseract.js is installed:
```bash
cd frontend
npm list tesseract.js
# Should show: tesseract.js@6.0.1
```

### Step 3: Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### Step 4: Test Feature
1. Login to app
2. Click avatar → "Weight Tracking"
3. Take photo of weighing scale
4. Verify OCR extracts weight
5. Save and view in Insights

---

## 📁 Files Created

### Backend APIs (3 files)
```
backend/pages/api/
├── save-weight-entry.js
├── get-weight-history.js
└── delete-weight-entry.js
```

### Frontend Components (3 files)
```
frontend/src/
├── components/
│   ├── WeightCapture.js
│   └── WeightInsights.js
└── services/
    └── weightOcrService.js
```

### Database (1 file)
```
sql/
└── weight_tracking_schema.sql
```

---

## 🎯 User Flow

```
1. Click "Weight Tracking" in menu
         ↓
2. Take photo of scale
         ↓
3. OCR extracts weight (2-5 sec)
         ↓
4. Review/Edit weight value
         ↓
5. Click "Save Weight"
         ↓
6. View in "Weight Insights"
```

---

## 🔑 Key Features

✅ **Camera-only capture** (no gallery upload)  
✅ **Automatic OCR** (Tesseract.js)  
✅ **Manual fallback** if OCR fails  
✅ **Weight validation** (20-300 kg)  
✅ **Full history** with statistics  
✅ **Image storage** for reference  
✅ **Soft delete** capability  

---

## 📊 API Endpoints

### Save Weight
```javascript
POST /api/save-weight-entry
{
  "userId": "user@example.com",
  "weightValue": 72.5,
  "unit": "kg",
  "imageBase64": "data:image/jpeg;base64,...",
  "confidenceScore": 0.85
}
```

### Get History
```javascript
POST /api/get-weight-history
{
  "userId": "user@example.com",
  "limit": 50,
  "offset": 0
}
```

### Delete Entry
```javascript
POST /api/delete-weight-entry
{
  "userId": "user@example.com",
  "entryId": 123
}
```

---

## 🧪 Testing Checklist

- [ ] Take scale photo
- [ ] Verify OCR extraction
- [ ] Test manual entry
- [ ] Save weight entry
- [ ] View history
- [ ] Check statistics
- [ ] Delete entry
- [ ] Test navigation

---

## 🐛 Common Issues

### OCR not detecting weight
**Fix:** Ensure good lighting, steady camera, clear display

### Images not loading
**Fix:** Check LONGTEXT field size, verify base64 encoding

### Save failing
**Fix:** Check network, verify DB connection, check API logs

---

## 📱 Navigation

```
Header Menu
  ├── Nutrition Dashboard
  ├── ⚖️ Weight Tracking  ← NEW
  │   └── Weight Insights
  ├── Test Camera
  └── Sign Out
```

---

## 🎨 UI Components

### WeightCapture
- Camera capture button
- OCR progress indicator
- Manual entry field
- Save/Retake buttons

### WeightInsights
- Latest weight card
- Weight change indicator
- Average weight display
- History timeline
- Image preview
- Delete functionality

---

## ⚙️ Configuration

### .env Frontend
```env
REACT_APP_API_BASE_URL=http://localhost:3000
```

### .env Backend
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=wellness_buddy
```

---

## 📈 Statistics Provided

- **Latest Weight** - Most recent entry
- **Weight Change** - Difference from previous
- **Average Weight** - Mean of all entries
- **Min/Max Weight** - Range of values
- **Total Entries** - Number of records

---

## 🔧 OCR Service Usage

```javascript
import { weightOcrService } from './services/weightOcrService';

// Extract weight
const result = await weightOcrService.extractWeightFromImage(imageFile);

// Validate weight
const valid = weightOcrService.validateWeight(72.5, 'kg');

// Convert units
const lbs = weightOcrService.convertWeight(72.5, 'kg', 'lbs');
```

---

## 📸 Photo Tips

✅ **Good lighting** on scale display  
✅ **Steady camera** - no blur  
✅ **Clear numbers** - focused  
✅ **No reflections** or shadows  
✅ **Digital scales** work best  

---

## 🚀 Production Deployment

### Before Launch:
1. ✅ Test OCR accuracy
2. ✅ Verify database indexes
3. ✅ Enable CORS properly
4. ✅ Add rate limiting
5. ✅ Compress images
6. ✅ Test on real devices

---

## 📚 Documentation

- **Full Guide:** `WEIGHT_TRACKING_FEATURE.md`
- **API Docs:** See backend API files
- **Component Docs:** See component source files

---

**Quick Support:**
- Check lighting and photo clarity
- Use manual entry if OCR fails
- Refresh page if data not loading
- Check console for errors

---

**Version:** 1.0.0  
**Last Updated:** November 10, 2025
