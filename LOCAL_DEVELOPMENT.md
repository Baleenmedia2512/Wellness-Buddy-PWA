# 💻 Local Development Setup

This guide shows how to run the app locally with the secure backend proxy architecture.

---

## 🔧 Prerequisites

- Node.js 16+ installed
- Your **NEW** Gemini API key (not the old exposed one)
- Backend and Frontend code already updated (secure services in place)

---

## ⚙️ Setup Steps

### **1. Backend Setup** (Runs on `localhost:3000`)

```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA\backend

# Edit .env file and add your NEW Gemini key:
notepad .env
```

**In `backend/.env`, update:**
```env
# Replace the old key with your NEW key
GEMINI_API_KEY=AIzaSy_YOUR_NEW_KEY_HERE

# Keep other existing settings (SMTP, Firebase, DB, etc.)
```

**Start the backend:**
```powershell
npm run dev
```

Backend will run on: `http://localhost:3000`

---

### **2. Frontend Setup** (Runs on `localhost:3001`)

```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA\frontend

# Edit .env to point to local backend:
notepad .env
```

**In `frontend/.env`, set:**
```env
# Point to local backend
REACT_APP_API_BASE_URL=http://localhost:3000

# NO API KEYS HERE! They're in the backend.
```

**Start the frontend:**
```powershell
# Use a different port to avoid conflict with backend
$env:PORT=3001; npm start
```

Frontend will run on: `http://localhost:3001`

---

## 🧪 Test the Local Setup

### **1. Check Backend is Running:**
```powershell
curl http://localhost:3000/api/health
```
Should return: `{ "status": "ok" }`

### **2. Test AI Endpoint:**
```powershell
# Create a simple test
curl -X POST http://localhost:3000/api/ai/analyze-nutrition `
  -H "Content-Type: application/json" `
  -d '{\"userId\":\"test-user\",\"prompt\":\"Describe this food\"}'
```

Should return JSON (or error if no image provided, which is expected).

### **3. Open the App:**
- Go to: `http://localhost:3001`
- Login
- Try taking/uploading a food photo
- Check browser DevTools Network tab
- Should see: `POST http://localhost:3000/api/ai/analyze-nutrition`

---

## 🔄 Architecture Flow (Local Dev)

```
┌─────────────────────┐
│  Browser            │
│  localhost:3001     │
└──────────┬──────────┘
           │
           │ POST /api/ai/analyze-nutrition
           ▼
┌─────────────────────┐
│  Backend Server     │
│  localhost:3000     │
│  (has GEMINI_API_KEY│
│   in .env)          │
└──────────┬──────────┘
           │
           │ Uses GEMINI_API_KEY
           ▼
┌─────────────────────┐
│  Google Gemini API  │
│  (external)         │
└─────────────────────┘
```

**Key Point:** Frontend never sees the API key, even in local dev! ✅

---

## 📝 File Checklist

| File | Should Contain | Should NOT Contain |
|------|----------------|---------------------|
| `backend/.env` | ✅ `GEMINI_API_KEY=AIza...` | ❌ Nothing to exclude |
| `frontend/.env` | ✅ `REACT_APP_API_BASE_URL=http://localhost:3000` | ❌ `REACT_APP_GEMINI_API_KEY` |
| `.gitignore` | ✅ `.env` (both folders) | - |

---

## 🔍 Troubleshooting

### **Backend Error: "GEMINI_API_KEY not configured"**
**Fix:**
```powershell
cd backend
notepad .env
# Add: GEMINI_API_KEY=your_new_key
# Restart: npm run dev
```

### **Frontend Can't Connect to Backend**
**Fix:**
```powershell
cd frontend
notepad .env
# Verify: REACT_APP_API_BASE_URL=http://localhost:3000
# Restart: $env:PORT=3001; npm start
```

### **CORS Error in Browser**
**Fix:** Check `backend/next.config.js` allows `http://localhost:3001`:
```javascript
headers: async () => [
  {
    source: '/api/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3001' },
      // ...
    ],
  },
],
```

---

## 🚀 Switch Between Local & Production

### **Use Local Backend:**
```env
# frontend/.env
REACT_APP_API_BASE_URL=http://localhost:3000
```

### **Use Production Backend:**
```env
# frontend/.env
REACT_APP_API_BASE_URL=https://wellness-valley-pwa-backend-test.vercel.app
```

**Tip:** Use `.env.local` for your personal overrides (auto-ignored by Git).

---

## ✅ Summary

**For Local Development:**
1. ✅ Backend `.env` has `GEMINI_API_KEY` (server-side)
2. ✅ Frontend `.env` has `REACT_APP_API_BASE_URL=http://localhost:3000` only
3. ✅ No API keys in frontend code
4. ✅ Backend runs on port 3000, frontend on port 3001
5. ✅ Frontend calls backend, backend calls Gemini

**No API keys are ever exposed!** 🔒
