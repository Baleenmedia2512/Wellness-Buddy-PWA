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
  
  // ✅ Use HTTPS scheme for hardware acceleration
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: ['*']
  },
  
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    GalleryMonitor: {},
    CameraMonitor: {},
    
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
