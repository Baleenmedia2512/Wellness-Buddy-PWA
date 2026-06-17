# OTP Login API - Quick Reference Guide

## 🎯 API Endpoints

### Base URL
```
Production: https://wellness-valley-pwa-backend-test.vercel.app
Local Dev:  http://localhost:3000
```

---

## 📧 Email OTP Login

### Step 1: Send OTP
```bash
POST /api/auth/send-otp

Headers:
  Content-Type: application/json

Body:
{
  "recipient": "user@example.com",
  "contactType": "email"
}

Response (Success):
{
  "success": true
}
```

### Step 2: Verify OTP
```bash
POST /api/auth/verify-otp

Headers:
  Content-Type: application/json

Body:
{
  "recipient": "user@example.com",
  "otp": "123456",
  "contactType": "email"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "id": 123,
    "username": "john_doe",
    "email": "user@example.com",
    "phone": "",
    "status": "Active"
  }
}
```

---

## 📱 Phone OTP Login (SMS)

### Step 1: Send OTP
```bash
POST /api/auth/send-otp

Headers:
  Content-Type: application/json

Body:
{
  "recipient": "+919876543210",
  "contactType": "phone"
}

Response (Success):
{
  "success": true
}

Response (SMS Config Issue):
{
  "success": true,
  "otp": "123456",  # ⚠️ Returned only if SMS fails (fallback)
  "missingConfig": ["MDT_SMS_TEMPLATE_ID"]
}
```

### Step 2: Verify OTP
```bash
POST /api/auth/verify-otp

Headers:
  Content-Type: application/json

Body:
{
  "recipient": "+919876543210",
  "otp": "654321",
  "contactType": "phone"
}

Response (Success):
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "id": 456,
    "username": "user_919876543210",
    "email": "",
    "phone": "9876543210",
    "status": "Active"
  }
}
```

---

## 🔧 Configuration

### Backend Environment Variables (.env)

```bash
# Email OTP (Gmail SMTP)
SMTP_USER="easy2work.india@gmail.com"
SMTP_PASS="svjh wrjx cizn dhpg"

# Phone OTP (MDT SMS)
MDT_SMS_API_KEY=KLjpUrvI5SWm2ngb
MDT_SMS_SENDER_ID=BALEEN
MDT_SMS_TEMPLATE_ID=1707178115870634276
MDT_SMS_API_URL=http://app.mydreamstechnology.in/vb/apikey.php
```

### Status: ✅ CONFIGURED

---

## 📊 Error Responses

### Invalid OTP
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

### OTP Expired
```json
{
  "success": false,
  "message": "OTP expired"
}
```

### No Active OTP
```json
{
  "success": false,
  "message": "No active OTP found"
}
```

### Missing Recipient
```json
{
  "success": false,
  "message": "Recipient and OTP are required"
}
```

---

## 🧪 Testing Tools

### 1. HTML Demo (Visual Interface)
```bash
open test-login-demo.html
```
**Features:**
- Email/Phone selection
- OTP input with auto-focus
- User info display
- localStorage integration

### 2. CLI Test Script
```bash
# Interactive mode
node test-otp-login.js

# Quick tests
node test-otp-login.js --email user@example.com
node test-otp-login.js --phone +919876543210
node test-otp-login.js --verify user@example.com 123456 email
```

---

## 💡 Frontend Integration Example

### Using Fetch API
```javascript
// Step 1: Send OTP
async function sendOTP(recipient, contactType) {
  const response = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, contactType })
  });
  return response.json();
}

// Step 2: Verify OTP
async function verifyOTP(recipient, otp, contactType) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, otp, contactType })
  });
  const data = await response.json();
  
  if (data.success) {
    // Save user data
    localStorage.setItem('user', JSON.stringify(data.user));
    // Redirect to app
    window.location.href = '/dashboard';
  }
  
  return data;
}

// Usage
await sendOTP('user@example.com', 'email');
// User enters OTP
await verifyOTP('user@example.com', '123456', 'email');
```

---

## 🔒 Security Features

✅ **Email OTP:**
- 6-digit random code
- bcrypt hashing (cost: 10)
- 5-minute expiry
- One-time use (deactivated after verification)

✅ **Phone OTP:**
- 6-digit random code
- bcrypt hashing (cost: 10)
- 10-minute expiry (MDT_OTP_EXPIRY_MINUTES)
- One-time use
- DLT-registered template (India compliance)

---

## 📝 OTP Expiry Times

| Method | Expiry Time | Reason |
|--------|-------------|--------|
| Email  | 5 minutes   | Instant delivery |
| Phone  | 10 minutes  | SMS delays possible |

---

## 🎨 Current Login UI

Your app at `frontend/src/features/user/components/Login.js` already supports:

1. **Google Sign-In** (Firebase OAuth)
2. **Email/Phone OTP** (Unified input field)
   - Auto-detects email vs phone based on input format
   - Uses `useAuthFlow` hook
   - 6-digit OTP input with auto-focus
   - Resend countdown (60 seconds)

---

## ✅ What's Working

| Feature | Status | Provider |
|---------|--------|----------|
| Email OTP Send | ✅ Working | Gmail SMTP |
| Email OTP Verify | ✅ Working | Backend validation |
| Phone OTP Send | ✅ Working | MDT SMS API |
| Phone OTP Verify | ✅ Working | Backend validation |
| Auto User Creation | ✅ Working | team_table insert |
| Google OAuth | ✅ Working | Firebase Auth |

---

## 🚫 What Was Removed

| Feature | Status | Reason |
|---------|--------|--------|
| Firebase Phone Auth | ❌ Removed | No Firebase Admin SDK keys |
| `/api/auth/firebase-phone-login` | ❌ Deleted | Not needed |
| `firebaseAdmin.js` | ❌ Deleted | Not configured |
| `phoneAuthService.js` (frontend) | ❌ Deleted | Replaced by MDT SMS |

---

## 📞 Support

**Email OTP Issues:**
- Check SMTP credentials: `SMTP_USER`, `SMTP_PASS`
- Verify Gmail app password is valid
- Check spam folder

**Phone OTP Issues:**
- Verify MDT credentials: `MDT_SMS_API_KEY`, `MDT_SMS_SENDER_ID`
- Ensure DLT template ID is correct: `MDT_SMS_TEMPLATE_ID`
- Check phone number format: E.164 (+country_code + number)
- India only: Must be 10-digit mobile number

---

## 🎉 Quick Start

1. **Test Email OTP:**
   ```bash
   node test-otp-login.js --email your-email@gmail.com
   # Check your email for OTP
   node test-otp-login.js --verify your-email@gmail.com [OTP] email
   ```

2. **Test Phone OTP:**
   ```bash
   node test-otp-login.js --phone +919876543210
   # Check your SMS for OTP
   node test-otp-login.js --verify +919876543210 [OTP] phone
   ```

3. **Visual Test:**
   ```bash
   open test-login-demo.html
   # Fill form → Send OTP → Enter code → Login!
   ```

---

**Last Updated:** June 17, 2026
**Firebase Phone Auth:** Removed (not configured)
**Primary Auth Method:** Email/Phone OTP via MDT SMS + Gmail SMTP
