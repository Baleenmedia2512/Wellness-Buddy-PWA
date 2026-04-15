const config = {
  appId: 'com.wellnessvalley.app',
  appName: 'Wellness Valley',
  webDir: 'build',
  bundledWebRuntime: false,
  
  // ✅ ANDROID PERFORMANCE: Optimize for fast image loading
  android: {
    allowMixedContent: true,
    captureInput: true,
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
  
  // ✅ Use HTTP scheme for local development (allows connecting to HTTP backend)
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: ['wellness-buddy-pwa-eta.vercel.app'],
    cleartext: false
  },
  
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com',
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
