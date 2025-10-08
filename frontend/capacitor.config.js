const config = {
  appId: 'com.wellnessbuddy.app',
  appName: 'Wellness Buddy',
  webDir: 'build',
  bundledWebRuntime: false,
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

module.exports = config;
