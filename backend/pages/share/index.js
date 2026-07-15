/**
 * Generic landing — /share (no token).
 *
 * Used for: meal-share OG previews, body-parameters onboarding link,
 * and any WhatsApp message that needs a clean install/open-app URL.
 */
import Head from 'next/head';

const APP_PACKAGE = 'com.wellnessvalley.app';
const APP_STORE_ID = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

export async function getServerSideProps({ req }) {
  const ua = req.headers['user-agent'] || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return { redirect: { destination: APP_STORE_URL, permanent: false } };
  }
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;
  return { props: { baseUrl } };
}

export default function ShareIndex({ baseUrl }) {
  const ogImageUrl = baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null;
  const appUrl = baseUrl || 'https://wellness-buddy-pwa-eta.vercel.app';

  const bootstrap = `(function(){try{
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return;
    if (/Android/i.test(ua)) {
      var intentUrl = 'intent://share#Intent;scheme=wellnessvalley;package=${APP_PACKAGE};end';
      var t = setTimeout(function(){ window.location.replace('${PLAY_STORE_URL}'); }, 1200);
      window.addEventListener('pagehide', function(){ clearTimeout(t); });
      window.location.href = intentUrl;
      return;
    }
    window.location.replace('${PLAY_STORE_URL}');
  }catch(e){ window.location.replace('${PLAY_STORE_URL}'); }})();`;

  return (
    <>
      <Head>
        <title>Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Download or open Wellness Valley — your wellness tracking app." />
        <meta property="og:title" content="Wellness Valley" />
        <meta property="og:description" content="Download or open the Wellness Valley app." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${appUrl}/share`} />
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Wellness Valley" />
        <meta name="twitter:description" content="Download or open the Wellness Valley app." />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Head>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${PLAY_STORE_URL}`} />
      </noscript>
      <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
    </>
  );
}
