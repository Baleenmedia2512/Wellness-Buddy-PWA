/**
 * Wellness Counselling share landing page — /share/counselling
 *
 * WhatsApp crawls this clean URL when a coach shares the counselling
 * assessment form link with a lead or member. Provides branded OG meta
 * tags so the link preview renders a rich card instead of a raw URL.
 *
 * Layout mirrors /share/bpc/index.js exactly.
 */
import Head from 'next/head';

const APP_PACKAGE    = 'com.wellnessvalley.app';
const APP_STORE_ID   = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL  = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

export async function getServerSideProps({ req }) {
  const proto   = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;
  return { props: { baseUrl } };
}

export default function CounsellingShareIndex({ baseUrl }) {
  const ogImageUrl = baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null;
  const appUrl     = baseUrl || 'https://wellness-buddy-pwa-eta.vercel.app';

  return (
    <>
      <Head>
        <title>Wellness Counselling — Wellness Valley</title>
        <meta name="description" content="Your coach has invited you to take a wellness counselling assessment via Wellness Valley." />
        <meta property="og:title" content="🌿 Wellness Counselling Assessment" />
        <meta property="og:description" content="Your coach has invited you to complete a wellness counselling assessment. Open the Wellness Valley app to get started." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${appUrl}/share/counselling`} />
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="🌿 Wellness Counselling Assessment" />
        <meta name="twitter:description" content="Your coach has invited you to complete a wellness counselling assessment." />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Head>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#ecfdf5 0%,#fff 100%)', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, boxShadow: '0 8px 24px rgba(16,185,129,.08)', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', padding: '32px 24px 24px' }}>
            <img src="/wellness-valley-icon.png" alt="Wellness Valley" width={72} height={72} style={{ borderRadius: 16, marginBottom: 12 }} />
            <h1 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 700 }}>Wellness Counselling</h1>
            <p style={{ color: '#d1fae5', margin: '8px 0 0', fontSize: 15 }}>Shared via Wellness Valley</p>
          </div>
          <div style={{ padding: '28px 24px' }}>
            <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
              Your coach has invited you to complete a wellness counselling assessment.
              Open the Wellness Valley app to get started.
            </p>
            <a href={PLAY_STORE_URL} style={{ display: 'block', background: '#1a73e8', color: '#fff', borderRadius: 12, padding: '14px 20px', textDecoration: 'none', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              🤖 Get it on Google Play
            </a>
            <a href={APP_STORE_URL} style={{ display: 'block', background: '#000', color: '#fff', borderRadius: 12, padding: '14px 20px', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
              📱 Download on App Store
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
