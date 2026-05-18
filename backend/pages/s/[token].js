/**
 * backend/pages/s/[token].js
 * ---------------------------------------------------------------------------
 * Public, unauthenticated HTML page for a shared quick-capture. Auto-polls
 * the JSON endpoint until analysis is ready. No app install required.
 * ---------------------------------------------------------------------------
 */
import React, { useEffect, useState } from 'react';
import { validatePublicToken } from '../../features/quick-share/validation/quick-share.validators.js';

export async function getServerSideProps({ params }) {
  try {
    const { token } = validatePublicToken(params);
    return { props: { token } };
  } catch {
    return { notFound: true };
  }
}

export default function PublicSharePage({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(`/api/quick-share/public/${token}`, { cache: 'no-store' });
        if (res.status === 404) { setError('not_found'); return; }
        if (res.status === 410) { setError('expired'); return; }
        const json = await res.json();
        if (cancelled) return;
        setData(json.data);
        if (json.data?.status === 'pending' && attempts < 30) {
          setTimeout(poll, 2000);
        }
      } catch (_) {
        if (attempts < 5) setTimeout(poll, 2000);
        else setError('network');
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Wellness Valley · Meal Report</h1>
        {error === 'not_found' && <p style={styles.muted}>This share link is no longer available.</p>}
        {error === 'expired' && <p style={styles.muted}>This share link has expired.</p>}
        {error === 'network' && <p style={styles.muted}>Could not load. Please try again later.</p>}
        {!error && !data && <p style={styles.muted}>Loading…</p>}
        {!error && data?.status === 'pending' && (
          <p style={styles.muted}>Analysis in progress — this page will update automatically.</p>
        )}
        {!error && data?.status === 'ready' && <Report data={data} />}
      </div>
      <footer style={styles.footer}>Powered by Wellness Valley</footer>
    </main>
  );
}

function Report({ data }) {
  const n = data.nutrition || {};
  return (
    <>
      <ul style={styles.list}>
        <Row label="Calories" value={n.calories} unit="kcal" />
        <Row label="Protein"  value={n.protein}  unit="g" />
        <Row label="Carbs"    value={n.carbs}    unit="g" />
        <Row label="Fat"      value={n.fat}      unit="g" />
        <Row label="Fiber"    value={n.fiber}    unit="g" />
      </ul>
      {Array.isArray(data.foods) && data.foods.length > 0 && (
        <>
          <h2 style={styles.h2}>Detected items</h2>
          <ul style={styles.foods}>
            {data.foods.map((f, i) => <li key={i}>{f.name || 'Item'}</li>)}
          </ul>
        </>
      )}
    </>
  );
}

function Row({ label, value, unit }) {
  return (
    <li style={styles.row}>
      <span>{label}</span>
      <strong>{value == null ? '—' : `${value} ${unit}`}</strong>
    </li>
  );
}

const styles = {
  page:   { minHeight: '100vh', background: '#f7f7f9', display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  card:   { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  title:  { margin: 0, fontSize: 20, color: '#1a3a52' },
  h2:     { fontSize: 14, color: '#666', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  muted:  { color: '#666', marginTop: 12 },
  list:   { listStyle: 'none', padding: 0, margin: '16px 0 0' },
  row:    { display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: '1px solid #eee', fontSize: 14 },
  foods:  { paddingLeft: 18, color: '#444', fontSize: 14 },
  footer: { marginTop: 24, color: '#999', fontSize: 12 },
};
