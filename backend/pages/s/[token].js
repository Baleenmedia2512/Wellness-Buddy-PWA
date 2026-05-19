/**
 * backend/pages/s/[token].js
 * ---------------------------------------------------------------------------
 * Public nutrition-analysis result page.
 * Linked from the WhatsApp share caption: https://<app>/s/<token>
 *
 * States:
 *  loading  – first fetch in-flight
 *  pending  – analysis not yet complete; auto-refreshes every 3 s
 *  ready    – displays the nutrition card
 *  error    – token not found / expired / network failure
 * ---------------------------------------------------------------------------
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ── Small reusable stat card ─────────────────────────────────────────────────
function StatCard({ value, unit, label, color, bg }) {
  return (
    <div style={{ backgroundColor: bg, borderRadius: 10, padding: '14px 8px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, fontWeight: 500 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Macronutrient colour bar ─────────────────────────────────────────────────
function MacroBar({ protein = 0, carbs = 0, fat = 0 }) {
  const total = protein + carbs + fat;
  if (!total) return null;
  const pPct = Math.round((protein / total) * 100);
  const cPct = Math.round((carbs / total) * 100);
  const fPct = 100 - pPct - cPct;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Macronutrient Distribution</div>
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 10 }}>
        <div style={{ width: `${pPct}%`, backgroundColor: '#60a5fa' }} title={`Protein ${pPct}%`} />
        <div style={{ width: `${cPct}%`, backgroundColor: '#fbbf24' }} title={`Carbs ${cPct}%`} />
        <div style={{ width: `${fPct}%`, backgroundColor: '#a78bfa' }} title={`Fat ${fPct}%`} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {[['#60a5fa', 'Protein'], ['#fbbf24', 'Carbs'], ['#a78bfa', 'Fat']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ShareResultPage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState('loading'); // loading | pending | ready | error
  const [analysis, setAnalysis] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchResult = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/quick-share/public/${token}`);
      if (res.status === 404) {
        setStatus('error');
        setErrorMsg('Share link not found or has expired.');
        return;
      }
      const json = await res.json();
      if (res.status === 202 || json.data?.status === 'pending') {
        setStatus('pending');
        return;
      }
      if (json.ok && json.data?.analysis) {
        setAnalysis(json.data.analysis);
        setStatus('ready');
      } else {
        setStatus('error');
        setErrorMsg('Could not load analysis result.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Failed to reach the server. Please try again.');
    }
  }, [token]);

  // Initial fetch
  useEffect(() => { fetchResult(); }, [fetchResult]);

  // Auto-refresh while pending
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(fetchResult, 3000);
    return () => clearInterval(t);
  }, [status, fetchResult]);

  const foods = analysis?.foods || [];
  const total = analysis?.total || {};
  const mealName = foods[0]?.name || 'Meal Analysis';

  return (
    <>
      <Head>
        <title>{status === 'ready' ? `${mealName} — Wellness Valley` : 'Wellness Valley'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Nutrition analysis shared from Wellness Valley" />
      </Head>

      <div style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 16px 40px',
      }}>
        {/* Branding header */}
        <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', letterSpacing: 0.5 }}>
            🌿 Wellness Valley
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* ── Loading ── */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ fontWeight: 500 }}>Loading…</div>
            </div>
          )}

          {/* ── Pending ── */}
          {status === 'pending' && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🔄</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#374151', marginBottom: 8 }}>
                Analysing your meal…
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                The AI is computing the nutrition data.<br />
                This page will update automatically in a few seconds.
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
              <div style={{ color: '#ef4444', fontWeight: 600 }}>{errorMsg}</div>
            </div>
          )}

          {/* ── Ready: nutrition card ── */}
          {status === 'ready' && analysis && (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}>
              {/* Green header */}
              <div style={{ backgroundColor: '#16a34a', padding: '18px 20px' }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{mealName}</div>
                {analysis.confidence && (
                  <div style={{ color: '#bbf7d0', fontSize: 12, marginTop: 4 }}>
                    Confidence: {analysis.confidence}
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 16px 20px' }}>
                {/* Stat cards — row 1 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <StatCard
                    value={total.calories ?? foods[0]?.calories ?? '—'}
                    unit="" label="Calories" color="#ef4444" bg="#fee2e2"
                  />
                  <StatCard
                    value={total.carbs ?? foods[0]?.carbs ?? '—'}
                    unit="g" label="Carbs" color="#f59e0b" bg="#fef9c3"
                  />
                </div>

                {/* Stat cards — row 2 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <StatCard
                    value={total.protein ?? foods[0]?.protein ?? '—'}
                    unit="g" label="Protein" color="#3b82f6" bg="#dbeafe"
                  />
                  <StatCard
                    value={total.fat ?? foods[0]?.fat ?? '—'}
                    unit="g" label="Fat" color="#a855f7" bg="#f3e8ff"
                  />
                </div>

                {/* Fiber (if present) */}
                {total.fiber != null && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <StatCard value={total.fiber} unit="g" label="Fiber" color="#16a34a" bg="#dcfce7" />
                    </div>
                    <div style={{ flex: 1 }} />
                  </div>
                )}

                {/* Macro bar */}
                <MacroBar protein={total.protein} carbs={total.carbs} fat={total.fat} />

                {/* Food breakdown */}
                {foods.length > 0 && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                      Food Breakdown
                    </div>
                    {foods.map((food, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                        paddingBottom: 12,
                        borderBottom: i < foods.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{food.name}</div>
                          {food.quantity && (
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{food.quantity}</div>
                          )}
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            Protein {food.protein ?? 0}g · Carbs {food.carbs ?? 0}g
                            {food.fiber ? ` · Fiber ${food.fiber}g` : ''} · Fat {food.fat ?? 0}g
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap', marginLeft: 12 }}>
                          {food.calories} kcal
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {analysis.summary && (
                  <div style={{
                    backgroundColor: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                    fontSize: 13, color: '#6b7280', marginTop: 8,
                  }}>
                    {analysis.summary}
                  </div>
                )}

                {/* Footer */}
                <div style={{
                  textAlign: 'center', marginTop: 20, paddingTop: 14,
                  borderTop: '1px solid #f3f4f6',
                }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Shared via </span>
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Wellness Valley</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
