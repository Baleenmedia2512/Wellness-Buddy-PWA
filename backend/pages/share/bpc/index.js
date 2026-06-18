/**
 * Generic BPC share landing page — /share/bpc (no token).
 *
 * WhatsApp crawls this clean URL when the coach shares a body-parameters
 * card. Provides branded OG meta tags so the link preview looks good
 * instead of showing a 404.
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

export default function BpcShareIndex({ baseUrl }) {
  const ogImageUrl = baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null;
  const appUrl     = baseUrl || 'https://wellness-buddy-pwa-eta.vercel.app';

  return (
    <>
      <Head>
        <title>Body Parameters Card — Wellness Valley</title>
        <meta name="description" content="Your body parameters card has been shared with you via Wellness Valley." />
        <meta property="og:title" content="🌿 Body Parameters Card" />
        <meta property="og:description" content="Your coach has shared a body parameters card with you. Open the app to view it." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${appUrl}/share/bpc`} />
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="🌿 Body Parameters Card" />
        <meta name="twitter:description" content="Your coach has shared a body parameters card with you." />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Head>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#ecfdf5 0%,#fff 100%)', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, boxShadow: '0 8px 24px rgba(16,185,129,.08)', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', padding: '32px 24px 24px' }}>
            <img src="/wellness-valley-icon.png" alt="Wellness Valley" width={72} height={72} style={{ borderRadius: 16, marginBottom: 12 }} />
            <h1 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 700 }}>Body Parameters Card</h1>
            <p style={{ color: '#d1fae5', margin: '8px 0 0', fontSize: 15 }}>Shared via Wellness Valley</p>
          </div>
          <div style={{ padding: '28px 24px' }}>
            <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
              Your coach has shared a body parameters card with you. Open the Wellness Valley app to view it.
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
