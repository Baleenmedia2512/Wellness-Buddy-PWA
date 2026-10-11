/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pack share-card assets into testimonials API functions (logo + Noto fonts).
  outputFileTracingIncludes: {
    '/api/testimonials/**/*': [
      './features/testimonials/assets/NotoSans-Regular.ttf',
      './features/testimonials/assets/NotoSans-Bold.ttf',
      './features/testimonials/assets/logo.png',
    ],
  },
  async redirects() {
    return [
      // Legacy body-params onboarding link — /app was never deployed to some envs.
      { source: '/app', destination: '/share', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-App-Version, X-App-Version-Code, X-App-Platform' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
