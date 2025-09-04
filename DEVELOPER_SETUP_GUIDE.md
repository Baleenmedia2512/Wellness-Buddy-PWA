# Wellness Buddy PWA - Developer Setup Guide

<div align="center">

![Wellness Buddy](https://img.shields.io/badge/Wellness-Buddy-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)

*An AI-powered nutrition tracking Progressive Web App with mobile support*

</div>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Environment Setup](#-environment-setup)
- [Installation & Setup](#-installation--setup)
- [Development Workflow](#-development-workflow)
- [Mobile Development](#-mobile-development)
- [Backend Services](#-backend-services)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🎯 Project Overview

**Wellness Buddy** is a modern Progressive Web App that helps users track their nutrition through AI-powered food recognition. Users can capture photos of their meals, and the app automatically analyzes nutritional content, providing detailed insights and daily tracking.

### ✨ Key Features

- 📸 **AI Food Recognition** - Capture food photos for automatic nutrition analysis
- 📊 **Daily Nutrition Dashboard** - Track calories, macros, and micronutrients
- 📱 **Mobile-First Design** - Responsive PWA with native mobile app support
- 🔐 **Google Authentication** - Secure user authentication with Google OAuth
- 💾 **Real-time Sync** - Data synchronization across devices
- 📈 **Progress Tracking** - Historical data and trends analysis

### 🏗️ Tech Stack

**Frontend:**
- React 18+ (JavaScript)
- Tailwind CSS (Styling)
- Capacitor (Mobile Bridge)
- Lucide React (Icons)

**Backend:**
- Next.js API Routes (Node.js)
- MySQL Database
- Google Cloud Vision API (Food Recognition)
- OpenAI API (Nutrition Analysis)

**Mobile:**
- Android (Capacitor + React)
- Progressive Web App (PWA)

---

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

### Required Software

| Tool | Version | Purpose | Download Link |
|------|---------|---------|---------------|
| **Node.js** | 18.x or higher | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **npm** | 9.x or higher | Package manager | Included with Node.js |
| **Java JDK** | 17 (LTS) | Android development | [Eclipse Adoptium](https://adoptium.net) |
| **Android Studio** | Latest | Android SDK & Emulator | [developer.android.com](https://developer.android.com/studio) |
| **Git** | Latest | Version control | [git-scm.com](https://git-scm.com) |

### System Requirements

- **OS**: Windows 10/11, macOS 12+, or Ubuntu 20.04+
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space for Android SDK

---

## 📁 Project Structure

```
Wellness-Buddy-PWA/
├── 📁 frontend/                    # React PWA Application
│   ├── 📁 public/                  # Static assets
│   ├── 📁 src/                     # Source code
│   │   ├── 📁 components/          # React components
│   │   ├── 📁 pages/               # Page components
│   │   ├── 📁 services/            # API services
│   │   └── 📁 plugins/             # Capacitor plugins
│   ├── 📁 android/                 # Android platform files
│   │   ├── 📁 app/                 # Android app configuration
│   │   └── 📄 gradle.properties    # Gradle configuration
│   ├── 📄 capacitor.config.js      # Capacitor configuration
│   ├── 📄 package.json             # Frontend dependencies
│   └── 📄 tailwind.config.js       # Tailwind CSS configuration
│
├── 📁 backend/                     # Next.js API Backend
│   ├── 📁 pages/api/               # API endpoints
│   ├── 📄 package.json             # Backend dependencies
│   └── 📄 next.config.js           # Next.js configuration
│
├── 📁 sql/                         # Database scripts
│   ├── 📄 scripts.sql              # Database setup
│   └── 📄 test_queries.sql         # Test queries
│
├── 📁 play-store-assets/           # App store assets
├── 📄 README.md                    # This file
└── 📄 *.md                         # Various guide documents
```

---

## 🛠️ Environment Setup

### 1. Java Development Kit (JDK) Setup

```bash
# Download and install Eclipse Adoptium JDK 17
# Set JAVA_HOME environment variable
# Windows:
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot"

# macOS/Linux:
export JAVA_HOME="/usr/local/java/jdk-17"
```

### 2. Android Development Environment

1. **Install Android Studio**:
   - Download from [developer.android.com](https://developer.android.com/studio)
   - Follow the installation wizard
   - Install Android SDK and required components

2. **Configure Android SDK**:
   ```bash
   # Set Android environment variables
   # Windows:
   setx ANDROID_HOME "C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
   setx ANDROID_SDK_ROOT "C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
   
   # macOS/Linux:
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
   ```

3. **Required SDK Components**:
   - Android SDK Platform-Tools
   - Android SDK Build-Tools (latest)
   - Android 14 (API level 34)
   - Android 15 (API level 35)
   - Google APIs Intel x86 Atom System Images

### 3. Node.js Setup

```bash
# Verify Node.js installation
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Install global dependencies
npm install -g @capacitor/cli
npm install -g @ionic/cli  # Optional but recommended
```

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Baleenmedia2512/Wellness-Buddy-PWA.git
cd Wellness-Buddy-PWA
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env.local  # Copy if exists, or create new

# Configure environment variables in .env.local:
# DATABASE_URL=mysql://user:password@localhost/wellness_buddy
# OPENAI_API_KEY=your_openai_api_key
# GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Database Setup

```bash
# Create MySQL database
mysql -u root -p

# In MySQL:
CREATE DATABASE wellness_buddy;
USE wellness_buddy;

# Run database scripts
source ../sql/scripts.sql;
```

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env.local  # Copy if exists, or create new

# Configure environment variables in .env.local:
# REACT_APP_API_BASE_URL=http://localhost:3000
# REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

### 5. Mobile Platform Setup

```bash
# Add Android platform (if not already added)
npx cap add android

# Sync frontend changes with mobile platform
npx cap sync

# Copy web assets to mobile platform
npx cap copy
```

---

## 💻 Development Workflow

### Running the Development Environment

#### 1. Start Backend Server
```bash
cd backend
npm run dev
# Backend will run on http://localhost:3000
```

#### 2. Start Frontend Development Server
```bash
cd frontend
npm start
# Frontend will run on http://localhost:3001
```

#### 3. Mobile Development

**For Web Testing:**
```bash
cd frontend
npm start
# Test PWA features in Chrome DevTools
```

**For Android Development:**
```bash
cd frontend

# Build the web app
npm run build

# Sync with Capacitor
npx cap sync

# Open in Android Studio
npx cap open android
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start frontend development server |
| `npm run build` | Build production frontend |
| `npm test` | Run frontend tests |
| `npx cap sync` | Sync web app with mobile platforms |
| `npx cap run android` | Run on Android device/emulator |
| `npx cap build android` | Build Android APK |

---

## 📱 Mobile Development

### Android Setup

1. **Ensure Android Studio is properly configured**
2. **Create or connect Android Virtual Device (AVD)**:
   ```bash
   # List available AVDs
   emulator -list-avds
   
   # Start emulator
   emulator -avd Pixel_8_API_35
   ```

3. **Build and run on Android**:
   ```bash
   cd frontend
   npm run build
   npx cap sync
   npx cap run android
   ```

### Building for Production

```bash
cd frontend

# Build optimized web app
npm run build

# Sync with mobile platforms
npx cap sync

# Build Android APK
npx cap build android
```

### Android Signing (for Release)

1. **Generate signing key**:
   ```bash
   keytool -genkey -v -keystore wellness-buddy-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias wellness-buddy
   ```

2. **Configure signing in `android/app/build.gradle`**
3. **Build signed APK**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

---

## 🔧 Backend Services

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/save-google-user` | POST | Save/update Google user |
| `/api/send-otp` | POST | Send OTP verification |
| `/api/verify-otp` | POST | Verify OTP code |
| `/api/save-background-analysis` | POST | Save nutrition analysis |
| `/api/get-background-analysis` | GET | Get user's analyses |
| `/api/user-nutrition-stats` | GET | Get nutrition statistics |
| `/api/service-health` | GET | Service health check |

### Environment Variables

Create `.env.local` files in both `backend/` and `frontend/` directories:

**Backend (`backend/.env.local`):**
```env
# Database
DATABASE_URL=mysql://username:password@localhost:3306/wellness_buddy
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=wellness_buddy

# APIs
OPENAI_API_KEY=sk-your-openai-api-key
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-api-key

# Authentication
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# SMS/OTP (Optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

**Frontend (`frontend/.env.local`):**
```env
# API
REACT_APP_API_BASE_URL=http://localhost:3000

# Authentication
REACT_APP_GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Features
REACT_APP_ENABLE_PWA=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

---

## 🧪 Testing

### Frontend Testing

```bash
cd frontend

# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# E2E testing (if configured)
npm run test:e2e
```

### Backend Testing

```bash
cd backend

# Run API tests
npm test

# Test specific endpoint
npm run test:api
```

### Mobile Testing

```bash
cd frontend

# Test Android build
npx cap run android --target=<device_id>

# Test on emulator
npx cap run android --target=emulator
```

### Manual Testing Checklist

- [ ] User authentication (Google OAuth)
- [ ] Food photo capture and analysis
- [ ] Nutrition data display
- [ ] Daily tracking functionality
- [ ] Data persistence
- [ ] Mobile responsiveness
- [ ] PWA installation
- [ ] Offline functionality

---

## 🚀 Deployment

### Frontend (PWA) Deployment

```bash
cd frontend

# Build for production
npm run build

# Deploy to hosting service (e.g., Vercel, Netlify)
# Follow your hosting provider's deployment guide
```

### Backend Deployment

```bash
cd backend

# Build for production
npm run build

# Deploy to hosting service (e.g., Vercel, Railway)
# Configure environment variables in production
```

### Android App Store Deployment

1. **Build signed APK**:
   ```bash
   cd frontend/android
   ./gradlew assembleRelease
   ```

2. **Test signed APK**:
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

3. **Upload to Google Play Console**:
   - Create developer account
   - Follow Google Play Store publishing guidelines
   - Upload APK and complete store listing

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Java/Android Issues

**Problem**: `JAVA_HOME` not found
```bash
# Solution: Set JAVA_HOME environment variable
echo $JAVA_HOME  # Verify it's set
export JAVA_HOME="/path/to/jdk-17"  # Set if missing
```

**Problem**: Android SDK not found
```bash
# Solution: Verify ANDROID_HOME is set
echo $ANDROID_HOME
export ANDROID_HOME="$HOME/Library/Android/sdk"  # macOS/Linux
export ANDROID_HOME="%LOCALAPPDATA%\Android\Sdk"  # Windows
```

#### 2. Capacitor Issues

**Problem**: Platform not added
```bash
# Solution: Add platform
npx cap add android
npx cap sync
```

**Problem**: Native dependencies not synced
```bash
# Solution: Clean and sync
npx cap clean android
npx cap sync android
```

#### 3. Build Issues

**Problem**: npm install fails
```bash
# Solution: Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Gradle build fails
```bash
# Solution: Clean gradle cache
cd frontend/android
./gradlew clean
./gradlew build
```

#### 4. Database Connection Issues

**Problem**: Cannot connect to MySQL
- Verify MySQL is running
- Check database credentials in `.env.local`
- Ensure database exists and user has permissions

#### 5. API Integration Issues

**Problem**: CORS errors in development
- Ensure backend is running on correct port
- Check API base URL in frontend environment

### Debug Commands

```bash
# Check system information
npx cap doctor

# Check Capacitor configuration
npx cap ls

# View Android logs
adb logcat

# Check network requests
# Use browser developer tools > Network tab

# Check mobile app logs
# Android Studio > Logcat
```

### Getting Help

1. **Check existing documentation**:
   - `TROUBLESHOOTING.md`
   - `TESTING_GUIDE.md`
   - Individual setup guides

2. **Common resources**:
   - [Capacitor Documentation](https://capacitorjs.com/docs)
   - [React Documentation](https://react.dev)
   - [Android Developer Documentation](https://developer.android.com)

3. **Create an issue**:
   - Search existing issues first
   - Provide detailed error messages
   - Include system information and steps to reproduce

---

## 🤝 Contributing

### Development Setup for Contributors

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes and test thoroughly**
4. **Follow code style guidelines**
5. **Create pull request**

### Code Style Guidelines

- **JavaScript**: Use ESLint configuration
- **CSS**: Follow Tailwind CSS conventions
- **Commits**: Use conventional commit messages

### Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update README.md if necessary
5. Request review from maintainers

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Support

For support and questions:

- **Documentation**: Check the `/docs` folder
- **Issues**: Create a GitHub issue
- **Discussions**: Use GitHub Discussions

---

## 🏆 Acknowledgments

- **OpenAI** - For nutrition analysis AI
- **Google Cloud Vision** - For food recognition
- **Capacitor Team** - For the amazing mobile bridge
- **React Team** - For the excellent frontend framework
- **Tailwind CSS** - For beautiful, utility-first styling

---

<div align="center">

**Happy Coding! 🚀**

*Made with ❤️ by the Wellness Buddy Team*

</div>
