/**
 * Public nutrition share viewer.
 * Served by the Next.js backend at /share/[token].
 * Renders nutrition data for the given public-share token, or a
 * "pending" state with an auto-refresh if analysis is not yet complete.
 *
 * The UI mirrors the in-app NutritionCard so recipients see the same
 * design that the sender captured/shared.
 */
import Head from 'next/head';
import { getPublicCapture } from '../../features/background-analysis/analysis.service.js';
import { validatePublicCapture } from '../../features/background-analysis/analysis.validators.js';

// ─── server-side data fetch ──────────────────────────────────────────────────

export async function getServerSideProps({ params }) {
  const { token } = params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) {
    return { props: { state: 'not_found' } };
  }

  try {
    const result = await getPublicCapture(validatePublicCapture({ token }));
    const { httpStatus, body } = result;

    if (httpStatus === 404) return { props: { state: 'not_found' } };
    if (httpStatus === 410) return { props: { state: 'expired' } };

    if (body.data?.pending) {
      return { props: { state: 'pending', imageBase64: body.data.imageBase64 || null } };
    }

    // Pre-format the date server-side so the rendered string is identical on
    // server and client, preventing Next.js hydration mismatches.
    const formattedDate = body.data.createdAt
      ? new Date(body.data.createdAt).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        })
      : null;

    return {
      props: {
        state: 'ready',
        nutrition: body.data.nutrition,
        analysis: body.data.analysis,
        formattedDate,
        imageBase64: body.data.imageBase64 || null,
      },
    };
  } catch (_) {
    return { props: { state: 'error' } };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Build a usable <img src> regardless of whether the stored base64 already
 * contains a "data:..." prefix or just the raw payload.
 */
function toImageSrc(imageBase64) {
  if (!imageBase64) return null;
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:image/jpeg;base64,${imageBase64}`;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round(v) {
  return Math.round(toNumber(v));
}

// ─── styles (inline; this page is SSR-only, no Tailwind) ────────────────────

const pageBg = {
  background: '#f3f4f6',
  minHeight: '100vh',
  padding: '20px 12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const card = {
  maxWidth: 440,
  margin: '0 auto',
  background: '#fff',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  border: '2px solid #bbf7d0',
};

const header = {
  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  color: '#fff',
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const avatar = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 700,
  flexShrink: 0,
};

const tileGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  padding: '0 20px',
  marginBottom: 12,
};

const tileBase = {
  borderRadius: 12,
  padding: '14px 8px',
  textAlign: 'center',
  border: '1px solid',
};

const tileValue = { fontSize: 26, fontWeight: 700, lineHeight: 1.1 };
const tileLabel = { fontSize: 12, fontWeight: 600, marginTop: 4 };

const TILES = {
  calories: { bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca', text: '#dc2626', label: '#b91c1c' },
  carbs:    { bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a', text: '#d97706', label: '#b45309' },
  protein:  { bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe', text: '#2563eb', label: '#1d4ed8' },
  fat:      { bg: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', border: '#e9d5ff', text: '#9333ea', label: '#7e22ce' },
  fiber:    { bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0', text: '#16a34a', label: '#15803d' },
};

function StatTile({ kind, value, suffix, label }) {
  const c = TILES[kind];
  return (
    <div style={{ ...tileBase, background: c.bg, borderColor: c.border }}>
      <div style={{ ...tileValue, color: c.text }}>{value}{suffix}</div>
      <div style={{ ...tileLabel, color: c.label }}>{label}</div>
    </div>
  );
}

// ─── shells ─────────────────────────────────────────────────────────────────

function MessageCard({ title, message }) {
  return (
    <div style={pageBg}>
      <div style={card}>
        <div style={header}>
          <div style={avatar}>W</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Wellness Valley</div>
            <div style={{ fontSize: 12, color: '#bbf7ec' }}>Shared meal</div>
          </div>
        </div>
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>{message}</div>
        </div>
      </div>
    </div>
  );
}

// ─── page component ─────────────────────────────────────────────────────────

export default function SharePage({ state, nutrition, analysis, formattedDate, imageBase64 }) {
  if (state === 'not_found' || state === 'error') {
    return <MessageCard title="Link not found" message="This share link doesn’t exist or has been removed." />;
  }

  if (state === 'expired') {
    return <MessageCard title="Link expired" message="Share links are valid for 30 days. This one has expired." />;
  }

  const imgSrc = toImageSrc(imageBase64);

  if (state === 'pending') {
    return (
      <div style={pageBg}>
        <Head>
          <meta httpEquiv="refresh" content="5" />
          <title>Analysing meal… · Wellness Valley</title>
        </Head>
        <div style={card}>
          <div style={header}>
            <div style={avatar}>W</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Wellness Valley</div>
              <div style={{ fontSize: 12, color: '#bbf7ec' }}>Shared meal</div>
            </div>
          </div>

          {imgSrc && (
            <img
              src={imgSrc}
              alt="Shared meal"
              style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}
            />
          )}

          <div style={{ background: '#22c55e', color: '#fff', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Analysing your meal…</div>
            <div style={{ fontSize: 13, color: '#dcfce7', marginTop: 4 }}>
              Nutrition will appear here in a few seconds
            </div>
          </div>

          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              This page refreshes automatically.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ready ──
  const foods = Array.isArray(analysis?.foods) ? analysis.foods : [];
  const primaryFood = foods[0]?.name || 'Meal';
  const moreCount = Math.max(0, foods.length - 1);
  const itemsLabel = foods.length > 0
    ? `${foods.length} food item${foods.length === 1 ? '' : 's'} analyzed`
    : 'Nutrition summary';

  const carbsG = toNumber(nutrition?.carbs);
  const proteinG = toNumber(nutrition?.protein);
  const fatG = toNumber(nutrition?.fat);
  const totalKcalFromMacros = carbsG * 4 + proteinG * 4 + fatG * 9;
  const carbsPct = totalKcalFromMacros > 0 ? (carbsG * 4 / totalKcalFromMacros) * 100 : 0;
  const proteinPct = totalKcalFromMacros > 0 ? (proteinG * 4 / totalKcalFromMacros) * 100 : 0;
  const fatPct = totalKcalFromMacros > 0 ? (fatG * 9 / totalKcalFromMacros) * 100 : 0;

  return (
    <div style={pageBg}>
      <Head>
        <title>{primaryFood} · Wellness Valley</title>
      </Head>

      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={avatar}>W</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Wellness Valley</div>
            <div style={{ fontSize: 12, color: '#bbf7ec' }}>
              {formattedDate || 'Shared meal'}
            </div>
          </div>
        </div>

        {/* Image */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt={primaryFood}
            style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}
          />
        )}

        {/* Meal title banner */}
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: '#fff',
          padding: '14px 16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, textTransform: 'capitalize' }}>
            {primaryFood}{moreCount > 0 ? ` + ${moreCount} more` : ''}
          </div>
          <div style={{ fontSize: 13, color: '#dcfce7', marginTop: 4 }}>{itemsLabel}</div>
        </div>

        {/* Nutrition tiles */}
        <div style={{ padding: '20px 0 4px' }}>
          <div style={tileGrid}>
            <StatTile kind="calories" value={round(nutrition?.calories)} suffix="" label="Calories" />
            <StatTile kind="carbs" value={round(nutrition?.carbs)} suffix="g" label="Carbs" />
            <StatTile kind="protein" value={round(nutrition?.protein)} suffix="g" label="Protein" />
            <StatTile kind="fat" value={round(nutrition?.fat)} suffix="g" label="Fat" />
          </div>

          {/* Fiber - full width */}
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <div style={{ ...tileBase, background: TILES.fiber.bg, borderColor: TILES.fiber.border }}>
              <div style={{ ...tileValue, color: TILES.fiber.text }}>{round(nutrition?.fiber)}g</div>
              <div style={{ ...tileLabel, color: TILES.fiber.label }}>Fiber</div>
            </div>
          </div>

          {/* Macronutrient distribution */}
          {totalKcalFromMacros > 0 && (
            <div style={{ padding: '8px 20px 4px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Macronutrient Distribution
              </div>
              <div style={{
                display: 'flex',
                height: 14,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#e5e7eb',
              }}>
                <div style={{ width: `${carbsPct}%`, background: '#facc15' }} />
                <div style={{ width: `${proteinPct}%`, background: '#60a5fa' }} />
                <div style={{ width: `${fatPct}%`, background: '#c084fc' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#facc15', marginRight: 4 }} />Carbs {Math.round(carbsPct)}%</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', marginRight: 4 }} />Protein {Math.round(proteinPct)}%</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c084fc', marginRight: 4 }} />Fat {Math.round(fatPct)}%</span>
              </div>
            </div>
          )}

          {/* Food Breakdown */}
          {foods.length > 0 && (
            <div style={{ padding: '20px 20px 8px', borderTop: '1px solid #f3f4f6', marginTop: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>
                Food Breakdown
              </div>
              {foods.map((f, i) => {
                const fn = f.nutrition || f;
                const kcal = round(fn.calories);
                const p = round(fn.protein);
                const c = round(fn.carbs);
                const fb = round(fn.fiber);
                const ft = round(fn.fat);
                const serving = f.serving || f.portion || f.quantity || '';
                return (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderBottom: i === foods.length - 1 ? 'none' : '1px solid #f3f4f6',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                          {f.name || 'Item'}
                        </div>
                        {serving && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{serving}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginLeft: 12 }}>
                        {kcal} kcal
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: '#2563eb' }}>Protein {p}g</span>
                      <span style={{ color: '#d97706' }}>Carbs {c}g</span>
                      <span style={{ color: '#16a34a' }}>Fiber {fb}g</span>
                      <span style={{ color: '#9333ea' }}>Fat {ft}g</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px 18px',
          textAlign: 'center',
          fontSize: 12,
          color: '#9ca3af',
          background: '#f9fafb',
          borderTop: '1px solid #f3f4f6',
        }}>
          Shared via Wellness Valley
        </div>
      </div>
    </div>
  );
}
