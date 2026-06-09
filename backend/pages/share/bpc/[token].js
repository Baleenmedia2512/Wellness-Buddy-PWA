/**
 * Public share landing page — Body Parameters Card.
 *
 * /share/bpc/<token>  is shared via WhatsApp by coaches.
 * This page is the fallback shown when:
 *   - the recipient doesn't have the app installed, OR
 *   - the link is opened on desktop / unsupported platform.
 *
 * Layout mirrors /share/[token].js (meal share) exactly.
 */
import Head from 'next/head';
import { findCardByToken } from '../../../features/body-parameters-card/data/card.repo.js';

const APP_PACKAGE   = 'com.wellnessvalley.app';
const APP_STORE_ID  = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL  = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

export async function getServerSideProps({ params, req }) {
  const token = (params?.token || '').toString();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const valid = UUID_RE.test(token);

  const proto   = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;

  let memberName   = null;
  let isExpired    = false;

  if (valid) {
    try {
      const card = await findCardByToken(token);
      if (card) {
        memberName = card.name || null;
        isExpired  = card.share_expires_at ? new Date(card.share_expires_at) < new Date() : false;
      }
    } catch {
      // non-fatal — fall back to generic branding
    }
  }

  return { props: { token: valid ? token : null, baseUrl, memberName, isExpired } };
}

/* ── Styles (identical palette to /share/[token].js) ─────────────────────── */
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
const avatarStyle = {
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
  margin: '0 auto 12px',
};
const body    = { padding: '24px 20px 20px' };
const title   = { fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px', textAlign: 'center' };
const sub     = { fontSize: 14, color: '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.5 };
const primaryBtn = {
  display: 'block', width: '100%', background: '#10b981', color: '#fff',
  textAlign: 'center', padding: '14px 16px', borderRadius: 12, fontSize: 15,
  fontWeight: 600, textDecoration: 'none', marginBottom: 10,
};
const secondaryBtn = {
  display: 'block', width: '100%', background: '#f3f4f6', color: '#111827',
  textAlign: 'center', padding: '12px 16px', borderRadius: 12, fontSize: 14,
  fontWeight: 500, textDecoration: 'none', marginBottom: 10,
};
const footer = { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 };

export default function BpcShareLanding({ token, baseUrl, memberName, isExpired }) {
  // On Android: try App Links handoff before showing the page.
  const bootstrap = token
    ? `(function(){try{
        var ua = navigator.userAgent || '';
        if (!/Android/i.test(ua)) return;
        var intentUrl = 'intent://share/bpc/${token}#Intent;scheme=wellnessvalley;package=${APP_PACKAGE};end';
        var fallbackTimer = setTimeout(function(){
          window.location.href = '${PLAY_STORE_URL}';
        }, 1500);
        window.addEventListener('pagehide', function(){ clearTimeout(fallbackTimer); });
        window.location.href = intentUrl;
      }catch(e){}})();`
    : '';

  const displayName = memberName || 'Your Body Parameters';

  return (
    <>
      <Head>
        <title>Body Parameters — Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
        <meta property="og:type"        content="website" />
        <meta property="og:site_name"   content="Wellness Valley" />
        <meta property="og:title"       content={`${displayName} — Body Parameters`} />
        <meta property="og:description" content="Your coach shared a Body Parameters card with you on Wellness Valley." />
        {baseUrl && <meta property="og:image" content={`${baseUrl}/wellness-valley-icon.png`} />}
        {baseUrl && token && <meta property="og:url" content={`${baseUrl}/share/bpc/${token}`} />}
      </Head>

      <div style={pageBg}>
        <div style={card}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={header}>
            <div style={avatarStyle}>W</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{displayName}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Your Body Parameters card
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div style={body}>
            {!token ? (
              <>
                <h1 style={title}>Invalid link</h1>
                <p style={sub}>This link is not valid. Ask your coach to share again.</p>
              </>
            ) : isExpired ? (
              <>
                <h1 style={title}>Link expired</h1>
                <p style={sub}>This Body Parameters card has expired (links are valid for 30 days). Ask your coach to create a new card.</p>
              </>
            ) : (
              <>
                <h1 style={title}>Open in the app</h1>
                <p style={sub}>
                  Your Body Parameters card opens inside the Wellness Valley app.
                  Install the app to save your data to your profile.
                </p>
                <a href={PLAY_STORE_URL} style={primaryBtn}>Get the app on Google Play</a>
                <a href={APP_STORE_URL}  style={secondaryBtn}>Available on the App Store</a>
                <a
                  href={`wellnessvalley://share/bpc/${token}`}
                  style={{ ...secondaryBtn, background: '#ecfdf5', color: '#065f46' }}
                >
                  I already have the app — open it
                </a>
              </>
            )}
            <div style={footer}>Your data is private. Only people you share with can view this.</div>
          </div>

        </div>
      </div>
      {bootstrap ? <script dangerouslySetInnerHTML={{ __html: bootstrap }} /> : null}
    </>
  );
}
