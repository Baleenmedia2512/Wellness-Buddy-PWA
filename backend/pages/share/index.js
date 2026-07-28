/**
 * /share — instant device redirect (no landing UI for real users).
 *
 * Android → Play Store app page (market://)
 * iOS     → App Store app page (itms-apps://)
 * App installed → Android App Links open the app before this page loads
 *
 * WhatsApp/link-preview bots get a minimal OG-only HTML shell (no buttons).
 */
import Head from 'next/head';
import { resolveShareLandingProps } from '../../utils/shareLandingRedirect.js';

export async function getServerSideProps(ctx) {
  return resolveShareLandingProps(ctx);
}

export default function ShareIndex({ baseUrl, isBot, ogPath = '/share' }) {
  if (!isBot) return null;

  const ogImageUrl = baseUrl ? `${baseUrl}/wellness-valley-icon.png` : null;
  const pageUrl = baseUrl ? `${baseUrl}${ogPath}` : null;

  return (
    <>
      <Head>
        <title>Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta name="description" content="Download or open Wellness Valley." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Wellness Valley" />
        <meta property="og:title" content="Wellness Valley" />
        <meta property="og:description" content="Download or open the Wellness Valley app." />
        {pageUrl && <meta property="og:url" content={pageUrl} />}
        {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
      </Head>
    </>
  );
}
