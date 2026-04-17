# Wellness Valley PWA v1.7 - Executive Feature Overview

**Branch:** MAD_Yasheer_2026_01_09  
**Version:** 1.7  
**Platform:** Android (Google Play Store) + iOS (Apple App Store) + Website (PWA)  
**Deployment:** Vercel (Frontend + Backend Serverless APIs)

---

## 🎯 Overview
AI-powered wellness coach assistant for nutrition tracking, weight management, and education logging with 24/7 background monitoring and hierarchical coach network support.

**Available On:** 
- 📱 **Android App** - Google Play Store
- 🍎 **iOS App** - Apple App Store
- 🌐 **Website** - Works on all browsers (Chrome, Safari, Firefox, Edge)

---

## 🔐 Authentication & User Roles
- **Google OAuth:** Firebase-based social login
- **Email OTP:** 6-digit verification (5-min expiry), bcrypt hashing
- **3 User Roles:** Admin (token monitoring), Coach (team management + discipline reports), User (personal tracking)
- **Session:** LocalStorage-based auth state persistence

---

## 👤 User Profile Management
- **Profile Modal:** Accessible from header menu dropdown (click user name/photo)
- **Editable Fields:**
  - Name (display name)
  - Height (50-198 cm, used for BMR calculations)
  - BMR (1100-2200 kcal/day, auto-calculated or manually entered)
  - Diet Type (Vegetarian, Non-Vegetarian, Vegan, Pescatarian)
- **First-Time User Flow:** Modal automatically shown for new users after signup to complete profile
- **BMR Auto-Calculation:** If height + latest weight available, system calculates BMR automatically
- **API Endpoints:**
  - `GET /api/get-user-profile` - Fetches current profile data (no cache for fresh data)
  - `POST /api/update-user-profile` - Saves profile changes
- **Data Persistence:** Updates stored in `team_table` (UserName, Height, DietType) and `weight_records_table` (Bmr)
- **AI Personalization:** Diet preference updates trigger user context refresh for improved AI food analysis
- **Success Feedback:** Green checkmark + "Profile saved successfully!" message, auto-closes after 2 seconds

---

## 🍽️ Core Features

### 1. Nutrition Tracking
- **AI Food Recognition:** Google Gemini API analyzes food images → extracts Name, Calories, Protein, Carbs, Fats
- **Daily Target:** 2100 kcal with macro breakdown visualization
- **Meal Corrections:** Users can request manual corrections (stored in `food_corrections_table`)
- **Dashboard:** Today/7-day/30-day summaries with color-coded calorie bars

### 2. Weight Monitoring
- **OCR Input:** Tesseract.js reads weight from scale photos
- **Monthly Grouping:** Auto-groups by month with min/max/avg/latest stats
- **Chart View:** Line graphs showing weight trends over time

### 3. Education Logging
- **Session Tracker:** Users manually log education sessions (title/details/date/time)
- **Team Visibility:** Logged sessions visible to assigned coach for progress monitoring

---

## 🤖 AI Analysis System
- **Model:** `gemini-2.5-flash-lite` (cost-optimized at ₹0.12 per 1M tokens)
- **Workflow:** Image Upload → Base64 encoding → Gemini API → JSON response → Supabase storage
- **Token Tracking:** All API calls logged in `ai_token_usage_table` (prompt tokens, completion tokens, total cost in ₹)
- **Fallback Model:** `gemini-2.0-flash` for enhanced analysis when needed

---

## 📊 Unified Dashboard
**3-Tab Interface:**
1. **Nutrition Tab:** Calorie progress, meal history, AI-analyzed food cards
2. **Weight Tab:** Monthly weight records with OCR input, trend charts
3. **Education Tab:** Session logs with manual entry form

**Data Views:** Today, Last 7 Days, Last 30 Days (toggle buttons)

---

## 👥 Coach Network System

### Team Hierarchy
- **Team ID:** 6-digit unique identifiers (e.g., `100001`)
- **Upline Assignment:** Users enter Team ID during setup → Creates coach-user relationship
- **Approval Workflow:** Requests stored in `approval_requests_table` (Pending/Approved/Rejected)
- **Coach Teams Table:** Tracks upline-downline links (`coach_teams_table`)

### Discipline Report (Coach Feature)
- **5 Activities:** Diet Following, Exercise, Water Intake, Sleep, Stress Management
- **Rating Scale:** 1-10 for each activity
- **Weekly Tracking:** Coaches submit weekly reports for each team member
- **Visual Dashboard:** Bar charts showing team discipline trends

---

## 🔄 Background Services

### Android Gallery Monitor
- **Implementation:** Java foreground service (`GalleryMonitorService.java`)
- **Trigger:** Monitors `MediaStore.Images.Media.EXTERNAL_CONTENT_URI` for new images
- **Auto-Upload:** Detects food photos → Triggers nutrition analysis in background
- **Permissions:** `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`
- **Battery Optimization:** Requests exclusion for 24/7 operation

---

## 🛠️ Admin Features

### AI Token Cost Monitor Dashboard
- **Real-Time Tracking:** Total tokens used, total cost (₹), cost per user
- **Usage Charts:** Daily/weekly token consumption trends
- **Model Breakdown:** Separate stats for `gemini-2.5-flash-lite` vs `gemini-2.0-flash`
- **Budget Alerts:** Configurable thresholds for cost monitoring

---

## 💻 Technical Stack

### Frontend
- **Framework:** React 18.3.1 + Ionic React 8.6.4
- **Mobile Bridge:** Capacitor 7.4.2 (iOS/Android support)
- **Styling:** Tailwind CSS 3.3.0 + Framer Motion 12.23.3
- **Auth:** Firebase 11.10.0 (Google OAuth + FCM push notifications)
- **OCR:** Tesseract.js 6.0.1
- **Charts:** Victory Native 43.3.12, Chart.js 5.0.1

### Backend
- **API Framework:** Next.js 15.3.6 (serverless API routes on Vercel)
- **Database:** Supabase PostgreSQL (@supabase/supabase-js 2.90.1)
- **AI Provider:** Google Gemini (@google/generative-ai 0.24.1)
- **Email:** Nodemailer 7.0.5 (OTP delivery via Gmail SMTP)
- **Security:** bcryptjs 3.0.2 (password/OTP hashing), helmet.js 8.0.0

### Database Schema (12 Key Tables)
1. `team_table` - User profiles + Team IDs
2. `food_nutrition_data_table` - AI-analyzed meal records
3. `weight_records_table` - Weight logs with OCR source
4. `education_logs_table` - Education session tracking
5. `coach_teams_table` - Upline-downline relationships
6. `approval_requests_table` - Team join requests
7. `discipline_reports_table` - Weekly coach assessments
8. `ai_token_usage_table` - Gemini API cost tracking
9. `food_corrections_table` - User-requested meal edits
10. `token_pricing_config_table` - AI model cost configuration
11. `otp_table` - Email verification codes
12. `enquiry_table` - Contact form submissions

---

## 📱 Mobile-Specific Features

### Android App (Google Play Store)
- **Play Store Distribution:** Available for download on Google Play Store
- **In-App Updates:** Google Play integration for seamless updates
- **Persistent Notifications:** Foreground service status indicator
- **Battery Exclusion:** Prompt users to disable optimization for background monitoring
- **Gallery Access:** Real-time detection of new photos via ContentObserver

### iOS App (Apple App Store)
- **App Store Distribution:** Available for download on Apple App Store
- **iOS Compatibility:** Full support for iPhone and iPad devices
- **Safari Optimization:** Optimized for Safari browser performance
- **Native iOS Experience:** Built with Capacitor 7.4.2 for native performance

### PWA Capabilities (All Platforms)
- **Offline Support:** Service workers cache UI assets
- **Install Prompt:** Add to Home Screen functionality (Android/iOS/Desktop)
- **Push Notifications:** Firebase Cloud Messaging integration
- **Cross-Browser:** Works on Chrome, Safari, Firefox, Edge

---

## 🔒 Security & Privacy
- **Data Encryption:** HTTPS-only API communication (Vercel SSL)
- **Auth Tokens:** LocalStorage with expiry validation
- **API Rate Limiting:** Vercel serverless function quotas
- **Environment Variables:** `.env` for secrets (Supabase keys, Gemini API keys, Gmail credentials)
- **CORS Policy:** Configured Next.js headers for frontend-backend communication

---

## 📈 Version 1.7 Highlights
- ✅ Cross-platform support (Android, iOS, Website)
- ✅ Unified 3-tab dashboard (Nutrition/Weight/Education)
- ✅ AI token cost monitoring for admins (₹ tracking)
- ✅ Coach discipline report system (5-activity rating)
- ✅ 24/7 background gallery monitoring (Android foreground service)
- ✅ Supabase migration from MySQL (REST API client)
- ✅ Google Gemini 2.5 Flash Lite integration (10x cost reduction vs 2.0)
- ✅ Enhanced approval workflow with status tracking
- ✅ OCR weight input via Tesseract.js

---

## 📞 Support & Credits
**Development Team:** MAD_Yasheer (Branch Owner)  
**API Base URL:** Backend hosted on Vercel  
**Database:** Supabase PostgreSQL Cloud  
**AI Provider:** Google Gemini API  
**Email Service:** Gmail SMTP (Nodemailer)

**Download Links:**
- 📱 Google Play Store: Available for Android devices
- 🍎 Apple App Store: Available for iOS devices
- 🌐 Website: Direct browser access

---

**Document Version:** 2.0 (Executive Summary)  
**Generated:** January 2026  
**Branch:** MAD_Yasheer_2026_01_09

---

**End of Document** 🎉

