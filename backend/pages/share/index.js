/**
 * Generic share landing page — /share (no token).
 *
 * This page is shown when WhatsApp crawls the clean share URL
 * (e.g. https://app/share) that the app sends in WhatsApp messages
 * instead of the full /share/<uuid>?n=... URL.
 *
 * Purpose: provide proper OG meta tags so the WhatsApp link preview
 * shows branded Wellness Valley content (title, description, icon)
 * rather than a blank or broken card.
 *
 * Functionality is NOT affected — the actual deep-link token is stored
 * in the app and handled natively via Android App Links / iOS Universal Links.
 */
import Head from 'next/head';

const APP_PACKAGE = 'com.wellnessvalley.app';
const APP_STORE_ID = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

export async function getServerSideProps({ req }) {
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;
  return { props: { baseUrl } };
}

export default function ShareIndex({ baseUrl }) {
  const ogImageUrl = baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null;
  const appUrl = baseUrl || 'https://wellness-buddy-pwa-eta.vercel.app';

  return (
    <>
      <Head>
        <title>Wellness Valley — Health Tracking</title>
        <meta name="description" content="Track your meals, weight, and wellness journey with Wellness Valley." />
        <meta property="og:title" content="🌿 Wellness Valley" />
        <meta property="og:description" content="A healthy update has been shared with you. Open the app to view it." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${appUrl}/share`} />
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="🌿 Wellness Valley" />
        <meta name="twitter:description" content="A healthy update has been shared with you." />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Head>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#ecfdf5 0%,#fff 100%)', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, boxShadow: '0 8px 24px rgba(16,185,129,.08)', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', padding: '32px 24px 24px' }}>
            <img src="/wellness-valley-icon.png" alt="Wellness Valley" width={72} height={72} style={{ borderRadius: 16, marginBottom: 12 }} />
            <h1 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 700 }}>Wellness Valley</h1>
            <p style={{ color: '#d1fae5', margin: '8px 0 0', fontSize: 15 }}>Your trusted health companion</p>
          </div>
          <div style={{ padding: '28px 24px' }}>
            <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
              A health update has been shared with you. Open the Wellness Valley app to view the details.
            </p>
            <a href={APP_STORE_URL} style={{ display: 'block', background: '#000', color: '#fff', borderRadius: 12, padding: '14px 20px', textDecoration: 'none', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              📱 Download on App Store
            </a>
            <a href={PLAY_STORE_URL} style={{ display: 'block', background: '#1a73e8', color: '#fff', borderRadius: 12, padding: '14px 20px', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
              🤖 Get it on Google Play
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
