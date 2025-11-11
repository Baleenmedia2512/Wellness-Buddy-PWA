# Weight Tracking - Quick Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Database Setup
```bash
# Navigate to project root
cd c:\xampp\htdocs\Wellness-Buddy-PWA-1

# Run database schema
mysql -u root -p wellness_buddy < sql/weight_tracking_schema.sql
```

Or manually in phpMyAdmin:
1. Open phpMyAdmin
2. Select `wellness_buddy` database (or your database name)
3. Go to SQL tab
4. Copy contents of `sql/weight_tracking_schema.sql`
5. Click "Go"

### Step 2: Verify Database
```sql
-- Check table exists
DESCRIBE weight_entries_table;

-- Should show columns: ID, UserID, WeightValue, WeightUnit, ImageBase64, etc.
```

### Step 3: Test Backend APIs
```bash
# Start backend server
cd backend
npm run dev

# Backend should run on http://localhost:3000
```

Test endpoints:
```bash
# Test database connection
curl http://localhost:3000/api/test-db

# Test save weight (replace userId with your test user ID)
curl -X POST http://localhost:3000/api/save-weight-entry \
  -H "Content-Type: application/json" \
  -d '{"userId":"277","weightValue":75.5,"weightUnit":"kg"}'

# Test get weight history
curl http://localhost:3000/api/get-weight-history?userId=277
```

### Step 4: Test Frontend
```bash
# In new terminal, start frontend
cd frontend
npm start

# Frontend should run on http://localhost:3001
```

### Step 5: Manual Testing
1. Open browser to http://localhost:3001
2. Login to Wellness Buddy
3. Click "Insights" button (bottom-right)
4. Click Scale icon (⚖️) in top-right of dashboard
5. Click "Add Weight" button
6. Click "Take Photo"
7. Allow camera permission
8. Take photo of weighing scale (or any object with numbers)
9. Verify OCR detects weight (or enter manually)
10. Click "Save Weight"
11. Verify entry appears in list

---

## 🎯 Feature Location

**Main App → Insights (Dashboard) → Scale Icon (⚖️) → Weight Tracking**

Or access via:
- NutritionDashboard header → Scale icon button

---

## 📱 Mobile Testing

### Build Android APK
```bash
cd frontend
npm run build
npx cap sync android
cd android
gradlew assembleDebug
```

### Install on Device
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Test on Device
1. Open Wellness Buddy app
2. Login
3. Navigate to Insights
4. Tap Scale icon
5. Tap "Add Weight"
6. Take photo with camera
7. Verify OCR and save

---

## ✅ Verification Checklist

- [ ] Database table `weight_entries_table` created
- [ ] Backend APIs respond correctly
- [ ] Frontend loads without errors
- [ ] Camera opens when clicking "Take Photo"
- [ ] OCR processes images (may take 3-5 seconds)
- [ ] Weight entries save to database
- [ ] Weight history displays entries
- [ ] Photos display as thumbnails
- [ ] Stats calculate correctly (current, change, total)
- [ ] Delete function works
- [ ] Error messages show when OCR fails
- [ ] Manual entry works as fallback

---

## 🐛 Quick Troubleshooting

### "Cannot find module 'tesseract.js'"
```bash
cd frontend
npm install tesseract.js
```

### "Table doesn't exist"
- Run the SQL schema again
- Verify you're using the correct database name
- Check database connection in `.env` files

### "Camera permission denied"
- Browser: Allow camera in browser settings
- Android: Grant camera permission in app settings

### "OCR not detecting weight"
- Ensure good lighting
- Take clear, focused photo
- Use manual entry as fallback

### "API connection failed"
- Verify backend is running on port 3000
- Check CORS settings
- Verify `REACT_APP_API_BASE_URL` in `.env`

---

## 🎨 Customization

### Change Weight Units Default
Edit `frontend/src/components/WeightScaleCapture.js`:
```javascript
const [unit, setUnit] = useState('kg'); // Change to 'lbs' for pounds
```

### Change Weight Range
Edit `backend/pages/api/save-weight-entry.js`:
```javascript
// Current: 20-300 kg, 44-660 lbs
// Modify validation ranges as needed
```

### Add More Statistics
Edit `frontend/src/components/WeightHistory.js`:
Add new stat cards in the stats section.

---

## 📚 Documentation

Full documentation: See `WEIGHT_TRACKING_FEATURE.md`

**Implementation Details**:
- Database schema
- API endpoints
- OCR service
- Component architecture
- Testing guide
- Troubleshooting

---

## 🎓 Key Technologies

- **OCR**: Tesseract.js 6.0.1
- **Camera**: Capacitor Camera Plugin
- **Database**: MySQL/MariaDB
- **Frontend**: React 18
- **Backend**: Next.js
- **UI**: Tailwind CSS + Lucide Icons

---

## 📞 Support

For issues or questions:
1. Check `WEIGHT_TRACKING_FEATURE.md` for detailed docs
2. Review browser console for errors
3. Check backend logs for API errors
4. Verify database connection

---

**Setup complete! Start tracking your weight! 🎯⚖️**
