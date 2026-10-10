/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle Noto TTFs used by server-side Transformation share-card compose
  // (opentype path text — without these, Vercel compose fails and Previous tap has no preview).
  outputFileTracingIncludes: {
    '/api/testimonials/**/*': [
      './features/testimonials/assets/NotoSans-Regular.ttf',
      './features/testimonials/assets/NotoSans-Bold.ttf',
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
