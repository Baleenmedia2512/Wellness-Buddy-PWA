/**
 * Public share landing page.
 *
 * Shared meal links (`/share/<token>`) are intended to open the Wellness
 * Valley app via Android App Links. This page is the FALLBACK shown when:
 *   - the recipient doesn't have the app installed, OR
 *   - the link is opened on desktop / unsupported platform.
 *
 * We deliberately do NOT render the meal's nutrition data here — meals are
 * private. The page exists only to bounce installed users into the app and
 * to point everyone else at the store.
 */
import Head from 'next/head';

const APP_PACKAGE = 'com.wellnessvalley.app';
const APP_STORE_ID = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

export async function getServerSideProps({ params, req }) {
  const token = (params?.token || '').toString();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const valid = UUID_RE.test(token);
  // Construct the absolute base URL so OG image tags use a full URL.
  // x-forwarded-proto / x-forwarded-host are set by Vercel and most proxies.
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;
  return { props: { token: valid ? token : null, baseUrl } };
}

const pageBg = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const card = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  border: '1px solid #bbf7d0',
  borderRadius: 20,
  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.08)',
  overflow: 'hidden',
};

const header = {
  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  color: '#fff',
  padding: '24px 20px',
  textAlign: 'center',
};

const avatar = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.2)',
  border: '2px solid rgba(255,255,255,0.4)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 12,
};

const body = { padding: '24px 20px 20px' };
const title = { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px', textAlign: 'center' };
const sub = { fontSize: 14, color: '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.5 };
const primaryBtn = {
  display: 'block',
  width: '100%',
  background: '#10b981',
  color: '#fff',
  textAlign: 'center',
  padding: '14px 16px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  marginBottom: 10,
};
const secondaryBtn = {
  display: 'block',
  width: '100%',
  background: '#f3f4f6',
  color: '#111827',
  textAlign: 'center',
  padding: '12px 16px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  marginBottom: 10,
};
const footer = { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 };

export default function ShareLanding({ token, baseUrl }) {
  // Client-side: try to hand off to the app via Android intent:// for users
  // whose Android App Links haven't auto-verified yet (debug builds, first
  // launch). Verified production builds intercept the https URL directly
  // and never see this script. Desktop / iOS users get the install CTAs.
  const bootstrap = token
    ? `(function(){try{
        var ua = navigator.userAgent || '';
        if (!/Android/i.test(ua)) return;
        var intentUrl = 'intent://share/${token}#Intent;scheme=wellnessvalley;package=${APP_PACKAGE};end';
        var fallbackTimer = setTimeout(function(){
          window.location.href = '${PLAY_STORE_URL}';
        }, 1500);
        window.addEventListener('pagehide', function(){ clearTimeout(fallbackTimer); });
        window.location.href = intentUrl;
      }catch(e){}})();`
    : '';

  return (
    <>
      <Head>
        <title>View my meal on Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
        {/* Open Graph tags — WhatsApp, Telegram, and other link-preview crawlers
            read these to render a branded card instead of a raw URL. */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="View my meal 🍽️" />
        <meta property="og:description" content="A meal was shared with you on Wellness Valley. Tap to open in the app." />
        {baseUrl && <meta property="og:image" content={`${baseUrl}/wellness-valley-icon.png`} />}
        {baseUrl && token && <meta property="og:url" content={`${baseUrl}/share/${token}`} />}
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:site_name" content="Wellness Valley" />
      </Head>
      <div style={pageBg}>
        <div style={card}>
          <div style={header}>
            <div style={avatar}>W</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Wellness Valley</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>A meal was shared with you</div>
          </div>
          <div style={body}>
            {!token ? (
              <>
                <h1 style={title}>Invalid share link</h1>
                <p style={sub}>The link you opened is not valid. Ask the sender to share again.</p>
              </>
            ) : (
              <>
                <h1 style={title}>Open in the app</h1>
                <p style={sub}>
                  Shared meals open inside the Wellness Valley app. Install
                  the app to view the meal in your dashboard.
                </p>
                <a href={PLAY_STORE_URL} style={primaryBtn}>Get the app on Google Play</a>
                <a href={APP_STORE_URL} style={secondaryBtn}>Available on the App Store</a>
                <a
                  href={`wellnessvalley://share/${token}`}
                  style={{ ...secondaryBtn, background: '#ecfdf5', color: '#065f46' }}
                >
                  I already have the app — open it
                </a>
              </>
            )}
            <div style={footer}>Meals are private. Only people you invite can view them.</div>
          </div>
        </div>
      </div>
      {bootstrap ? <script dangerouslySetInnerHTML={{ __html: bootstrap }} /> : null}
    </>
  );
}
