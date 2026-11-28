/**
 * Public Premium payment page opened from the iOS/Android app in Safari/Chrome.
 * Receives a Cashfree payment_session_id created by the authenticated app, then
 * runs Cashfree checkout on wellnessvalley.in (not inside the App Store binary).
 */
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const SDK_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeScript() {
  if (typeof window !== 'undefined' && typeof window.Cashfree === 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk="v3"]');
    const finish = () => {
      if (typeof window.Cashfree === 'function') resolve();
      else reject(new Error('Cashfree could not load'));
    };
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Cashfree could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.dataset.cashfreeSdk = 'v3';
    script.onload = finish;
    script.onerror = () => reject(new Error('Cashfree could not load'));
    document.body.appendChild(script);
  });
}

export default function PremiumPayPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Opening secure checkout…');
  const [failed, setFailed] = useState(false);

  const params = useMemo(() => {
    const q = router.query || {};
    return {
      paymentSessionId: String(q.payment_session_id || '').trim(),
      orderId: String(q.order_id || '').trim(),
      mode: String(q.mode || 'sandbox').trim() === 'production' ? 'production' : 'sandbox',
    };
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady) return undefined;
    let cancelled = false;

    async function start() {
      if (!params.paymentSessionId || !params.orderId) {
        if (!cancelled) {
          setFailed(true);
          setMessage('This payment link is incomplete. Return to the Wellness Valley app and tap Pay Now again.');
        }
        return;
      }
      try {
        await loadCashfreeScript();
        if (cancelled) return;
        const cashfree = window.Cashfree({ mode: params.mode });
        setMessage('Complete payment below. You will return to the app after paying.');
        const result = await cashfree.checkout({
          paymentSessionId: params.paymentSessionId,
          redirectTarget: '_self',
        });
        if (cancelled) return;
        if (result?.error) {
          setFailed(true);
          setMessage(result.error.message || 'Payment could not open');
        }
      } catch (error) {
        if (cancelled) return;
        setFailed(true);
        setMessage(error?.message || 'Payment could not open');
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, params.paymentSessionId, params.orderId, params.mode]);

  return (
    <>
      <Head>
        <title>Premium payment — Wellness Valley</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <main style={page}>
        <div style={card}>
          <p style={brand}>Wellness Valley</p>
          <h1 style={title}>Premium plan</h1>
          <p style={{ ...body, color: failed ? '#b91c1c' : '#374151' }} role={failed ? 'alert' : 'status'}>
            {message}
          </p>
          {params.orderId ? (
            <p style={meta}>Order {params.orderId}</p>
          ) : null}
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
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
};
const meta = {
  margin: '16px 0 0',
  fontSize: 12,
  color: '#9ca3af',
  wordBreak: 'break-all',
};
