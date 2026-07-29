const config = {
  appId: 'com.wellnessvalley.app',
  appName: 'Wellness Valley',
  webDir: 'build',
  bundledWebRuntime: false,
  
  // ✅ ANDROID PERFORMANCE: Optimize for fast image loading
  android: {
    allowMixedContent: true,
    // Must stay false: captureInput=true replaces the WebView IME with a generic
    // BaseInputConnection, which always shows QWERTY and ignores type="tel"/inputmode.
    captureInput: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#ffffff',
    loggingBehavior: 'none',
    
    // ✅ FIX: Android text selection settings
    // These preferences help prevent images from appearing in text selection
    preferences: {
      'AndroidInsecureFileModeEnabled': 'false',
      'AndroidXAutoCompleteEnabled': 'true',
      'DisallowOverscroll': 'true'
    }
  },
  
  // WebView origin MUST NOT equal the API host. If hostname is
  // wellness-valley.vercel.app, Android intercepts same-origin /api/* calls and
  // returns local index.html (text/html 200) → OTP "Unexpected server response".
  // API calls use REACT_APP_API_BASE_URL → https://wellness-valley.vercel.app (cross-origin).
  server: {
    androidScheme: 'https',
    hostname: 'app.wellnessvalley.app',
    allowNavigation: [
      'wellness-valley.vercel.app',
      'wellness-valley-pwa-backend-test.vercel.app',
      'wellness-buddy-pwa-backend-test.vercel.app',
      '*.vercel.app',
      '*.googleapis.com',
      '*.firebase.com',
      '*.firebaseapp.com',
      '*.firebaseio.com',
      'share.wellnessvalley.app',
      '*.wellnessvalley.app'
    ],
    cleartext: false
  },
  
  // ✅ iOS configuration
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    limitsNavigationsToAppBoundDomains: false
  },
  
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '499376291787-gkivhgcdsc3tep13m6a3khlgtgksfuq8.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    GalleryMonitor: {},
    CameraMonitor: {},
    
    // ✅ Share plugin configuration for optimal Android sharing
    Share: {
      // Allow sharing of images and text
      enabledShareTypes: ['image', 'text', 'url']
    },
    
    // ✅ Filesystem plugin for share operations
    Filesystem: {
      // Configure cache directory for temporary share files
      cacheDir: 'cache'
    },
    
    // ✅ Optimize splash screen for faster startup
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER',
      showSpinner: false
    },
    
    // ✅ Native keyboard handling for better performance
    Keyboard: {
      resize: 'native',
      style: 'light',
      resizeOnFullScreen: true
    }
  }
};

module.exports = config;