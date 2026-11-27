/**
 * Cashfree return page after Premium payment on the website.
 * Confirms nothing itself — the app verifies the order when it resumes —
 * and tries to hand the member back into the installed app.
 */
import Head from 'next/head';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

const APP_PACKAGE = 'com.wellnessvalley.app';
const APP_STORE_ID = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

function buildAppLink(orderId) {
  const id = encodeURIComponent(String(orderId || '').trim());
  return `wellnessvalley://premium/paid?order_id=${id}`;
}

function buildAndroidIntent(orderId) {
  const id = encodeURIComponent(String(orderId || '').trim());
  return `intent://premium/paid?order_id=${id}#Intent;scheme=wellnessvalley;package=${APP_PACKAGE};end`;
}

export default function PremiumPaidPage() {
  const router = useRouter();
  const orderId = useMemo(
    () => String(router.query?.order_id || '').trim(),
    [router.query],
  );

  useEffect(() => {
    if (!router.isReady) return undefined;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isAndroid = /Android/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    if (!isAndroid && !isIos) return undefined;

    const appLink = buildAppLink(orderId);
    const target = isAndroid ? buildAndroidIntent(orderId) : appLink;
    const timer = setTimeout(() => {
      try {
        window.location.href = target;
      } catch {
        // Member can tap Open app manually.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [router.isReady, orderId]);

  return (
    <>
      <Head>
        <title>Premium payment complete — Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <main style={page}>
        <div style={card}>
          <p style={brand}>Wellness Valley</p>
          <h1 style={title}>Payment received</h1>
          <p style={body}>
            Return to the Wellness Valley app. Premium will show on your profile after a moment.
          </p>
          {orderId ? <p style={meta}>Order {orderId}</p> : null}
          <a href={buildAppLink(orderId)} style={primaryBtn}>
            Open Wellness Valley
          </a>
          <a href={PLAY_STORE_URL} style={secondaryBtn}>
            Get the Android app
          </a>
          <a href={APP_STORE_URL} style={secondaryBtn}>
            Get the iPhone app
          </a>
        </div>
      </main>
    </>
  );
}

const page = {
  minHeight: '100vh',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'linear-gradient(180deg, #ecfdf5 0%, #f9fafb 55%, #ffffff 100%)',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};
const card = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  borderRadius: 20,
  padding: '28px 24px',
  boxShadow: '0 12px 40px rgba(16, 185, 129, 0.12)',
  border: '1px solid #d1fae5',
  textAlign: 'center',
};
const brand = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#059669',
};
const title = {
  margin: '8px 0 12px',
  fontSize: 24,
  fontWeight: 800,
  color: '#064e3b',
};
const body = {
  margin: '0 0 16px',
  fontSize: 15,
  lineHeight: 1.5,
  color: '#374151',
};
const meta = {
  margin: '0 0 16px',
  fontSize: 12,
  color: '#9ca3af',
  wordBreak: 'break-all',
};
const primaryBtn = {
  display: 'block',
  background: '#059669',
  color: '#fff',
  textAlign: 'center',
  padding: '12px 16px',
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  textDecoration: 'none',
  marginBottom: 10,
};
const secondaryBtn = {
  display: 'block',
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
