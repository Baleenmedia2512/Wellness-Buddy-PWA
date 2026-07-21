/**
 * /share/bpc — legacy path; same instant redirect as /share.
 */
import Head from 'next/head';
import { resolveShareLandingProps } from '../../../utils/shareLandingRedirect.js';

export async function getServerSideProps(ctx) {
  const result = await resolveShareLandingProps(ctx);
  if ('props' in result && result.props) {
    return { props: { ...result.props, ogPath: '/share/bpc' } };
  }
  return result;
}

export default function BpcShareIndex({ baseUrl, isBot, ogPath = '/share/bpc' }) {
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
