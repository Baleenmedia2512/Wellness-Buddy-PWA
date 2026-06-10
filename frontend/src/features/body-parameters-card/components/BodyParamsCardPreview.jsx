/**
 * BodyParamsCardPreview.jsx
 *
 * Health Boarding Pass — Wellness Valley Air template.
 * Green header · 2-column white body · dark-green score stub ·
 * boarding status + QR section · barcode footer.
 * Rendered off-screen so html2canvas can export it as a JPEG.
 */
import React from 'react';

const G          = '#16a34a';
const DARK_GREEN = '#166534';
const MID_GREEN  = '#1a7a3c';

/* ── Left column stat row ── */
const StatRow = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
    <div style={{
      width: 28, height: 28, borderRadius: 6, border: '1.5px solid #e2e8f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, flexShrink: 0, background: '#f8fafc',
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 7.5, fontWeight: 700, color: G, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
        {value}
      </div>
    </div>
  </div>
);

/* ── Right column metric row ── */
const MetricRow = ({ icon, iconBg, label, value, status, refLabel }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: iconBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, flexShrink: 0, marginRight: 6,
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 7, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
    {status && (
      <div style={{ flexShrink: 0, textAlign: 'center', marginLeft: 3 }}>
        <span style={{
          display: 'inline-block', fontSize: 7.5, fontWeight: 800,
          color: '#fff', background: status.bg,
          borderRadius: 20, padding: '2px 6px', whiteSpace: 'nowrap',
        }}>
          {status.label}
        </span>
        {refLabel ? (
          <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 1, textAlign: 'center' }}>{refLabel}</div>
        ) : null}
      </div>
    )}
  </div>
);

/* ─────────────────────────────── main component ── */
const BodyParamsCardPreview = React.forwardRef(({ card }, ref) => {
  const fmt = (v, unit = '') =>
    v !== null && v !== undefined && v !== '' ? `${v}${unit}` : '—';

  const fmtDate = (v) => {
    if (!v) return '—';
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    if (/^\d{8}$/.test(str))
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    return str;
  };

  /* ── Status helpers ── */
  const bmiVal = parseFloat(card.bmi);
  const bmiStatus = !isNaN(bmiVal)
    ? bmiVal < 19 ? { label: 'UNDERWEIGHT', bg: '#f59e0b' }
    : bmiVal > 23 ? { label: 'OVERWEIGHT',  bg: '#ef4444' }
    :               { label: 'NORMAL',       bg: G }
    : null;

  const fatVal = parseFloat(card.fatPercent);
  const isM = card.gender === 'Male', isF = card.gender === 'Female';
  const fatMin = isM ? 10 : 20, fatMax = isM ? 20 : 30;
  const fatRangeLabel = isM ? '(10 – 20)' : isF ? '(20 – 30)' : '';
  const fatStatus = !isNaN(fatVal) && (isM || isF)
    ? fatVal < fatMin ? { label: 'LOW FAT',  bg: '#f59e0b' }
    : fatVal > fatMax ? { label: 'HIGH FAT', bg: '#ef4444' }
    :                   { label: 'HEALTHY',  bg: G }
    : null;

  const bmrVal = parseFloat(card.bmr);
  const bmrStatus = !isNaN(bmrVal) && bmrVal > 0 ? { label: 'GOOD', bg: G } : null;

  const bodyAgeVal = parseFloat(card.bodyAge);
  const ageVal     = parseFloat(card.age);
  const bodyAgeStatus = !isNaN(bodyAgeVal)
    ? (!isNaN(ageVal) && bodyAgeVal > ageVal) ? { label: 'AGING',   bg: '#ef4444' }
    :                                            { label: 'OPTIMAL', bg: G }
    : null;

  /* ── Health score 0-100 ── */
  const healthScore = (() => {
    let pts = 0, total = 0;
    if (!isNaN(bmiVal)) {
      total += 30;
      pts += bmiVal >= 19 && bmiVal <= 23 ? 30 : bmiVal >= 17 && bmiVal <= 25 ? 18 : 8;
    }
    if (!isNaN(fatVal) && (isM || isF)) {
      total += 30;
      pts += fatVal >= fatMin && fatVal <= fatMax ? 30
           : fatVal >= fatMin - 3 && fatVal <= fatMax + 3 ? 18 : 8;
    }
    if (!isNaN(bmrVal) && bmrVal > 0) { total += 20; pts += 20; }
    if (!isNaN(bodyAgeVal)) {
      total += 20;
      pts += (!isNaN(ageVal) && bodyAgeVal > ageVal + 5) ? 8
           : (!isNaN(ageVal) && bodyAgeVal > ageVal) ? 14 : 20;
    }
    return total > 0 ? Math.round((pts / total) * 100) : 0;
  })();

  const stars      = Math.min(5, Math.round(healthScore / 20));
  const scoreClass = healthScore >= 90 ? 'EXCELLENT'
    : healthScore >= 75 ? 'GOOD'
    : healthScore >= 60 ? 'AVERAGE' : 'NEEDS WORK';

  const genderLine = card.age || card.gender
    ? `${card.age ? card.age + ' YRS' : ''}${card.age && card.gender ? ' / ' : ''}${card.gender ? card.gender.toUpperCase() : ''}`
    : '—';

  return (
    <div ref={ref} style={{
      width: 360,
      fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.30)',
    }}>

      {/* ═══ TOP GREEN HEADER STRIP ═══ */}
      <div style={{
        background: DARK_GREEN, padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#4ade80">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C21 9 21 13 21 13c-3 0-4.5-1-4.5-1 1 3 0 5 0 5C14 17 13 13 11 12c0 0 1 3 0 5-3-2-3-6-3-6S7 14 8 17c-3-2-4-6-3-9s5-8 12-4z"/>
          </svg>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: 0.4 }}>WELLNESS</div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: 0.4 }}>VALLEY AIR</div>
          </div>
        </div>
        <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.25)', margin: '0 10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontWeight: 600, letterSpacing: 0.2 }}>YOUR JOURNEY TO A</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontWeight: 600, letterSpacing: 0.2 }}>BETTER YOU</div>
          </div>
          <span style={{ fontSize: 16 }}>🌿</span>
        </div>
      </div>

      {/* ═══ WHITE MAIN SECTION ═══ */}
      <div style={{ background: '#fff', padding: '14px 16px 12px' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1a2e', lineHeight: 1, letterSpacing: -1 }}>
            WELLNESS
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: G, lineHeight: 1.1 }}>
            EVALUATION REPORT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
            <div style={{ flex: 1, borderTop: '1px dashed #d1d5db', marginLeft: 16 }} />
            <span style={{ fontSize: 11 }}>🌿</span>
            <span style={{ fontSize: 8, color: '#94a3b8', letterSpacing: 1.5, fontWeight: 600 }}>FLY HIGH. LIVE WELL.</span>
            <span style={{ fontSize: 11 }}>🌿</span>
            <div style={{ flex: 1, borderTop: '1px dashed #d1d5db', marginRight: 16 }} />
          </div>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

          {/* LEFT — passenger + stats */}
          <div style={{ flex: '0 0 148px' }}>
            <div style={{ marginBottom: 11 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: G, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
                Name
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, color: '#1a1a2e', textTransform: 'uppercase', lineHeight: 1.1, letterSpacing: 0.5 }}>
                {(card.name || '—').toUpperCase()}
              </div>
              {card.locationName ? (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                  {card.locationName}
                </div>
              ) : null}
            </div>
            <StatRow icon="📅" label="Date"          value={fmtDate(card.recordedDate)} />
            <StatRow icon="👤" label="Age / Gender"   value={genderLine} />
            <StatRow icon="📏" label="Height"         value={fmt(card.heightCm, ' cm')} />
            <StatRow icon="⚖️" label="Weight"         value={fmt(card.weightKg, ' kg')} />
          </div>

          {/* RIGHT — sky window only, fills full column height */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              width: '100%', height: 165, borderRadius: 16,
              background: 'linear-gradient(170deg, #7dd3fc 0%, #0284c7 50%, #1d4ed8 100%)',
              border: '3px solid #e2e8f0',
              overflow: 'hidden', position: 'relative',
            }}>
              <div style={{ position: 'absolute', bottom: 12, left: 6, right: 6, height: 12, borderRadius: 10, background: 'rgba(255,255,255,0.45)' }} />
              <div style={{ position: 'absolute', bottom: 26, left: 14, width: 38, height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.30)' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 62, height: 44, background: 'linear-gradient(130deg, #166534 0%, #22c55e 100%)', borderRadius: '38px 0 0 0', opacity: 0.75 }} />
              {/* WELLNESS APPROVED stamp */}
              <div style={{
                position: 'absolute', top: 5, right: 5,
                width: 46, height: 46, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.9)',
                background: 'rgba(22,101,52,0.88)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 5, fontWeight: 800, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}>WELLNESS</div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#4ade80" style={{ margin: '1px 0' }}>
                  <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C21 9 21 13 21 13c-3 0-4.5-1-4.5-1 1 3 0 5 0 5C14 17 13 13 11 12c0 0 1 3 0 5-3-2-3-6-3-6S7 14 8 17c-3-2-4-6-3-9s5-8 12-4z"/>
                </svg>
                <div style={{ fontSize: 5, fontWeight: 800, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}>APPROVED</div>
              </div>
            </div>
          </div>

        </div>
      </div>{/* end white */}

      {/* ═══ METRICS SECTION ═══ */}
      <div style={{ background: '#f1f5f9', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {card.bmi != null && card.bmi !== '' && (
          <MetricRow icon="🧍" iconBg="#dcfce7" label="BMI"       value={String(card.bmi)}            status={bmiStatus}     refLabel="(19 – 23)" />
        )}
        {card.fatPercent != null && card.fatPercent !== '' && (
          <MetricRow icon="💧" iconBg="#dbeafe" label="Body Fat"  value={`${card.fatPercent}%`}       status={fatStatus}     refLabel={fatRangeLabel} />
        )}
        {card.bmr != null && card.bmr !== '' && (
          <MetricRow icon="🔥" iconBg="#fee2e2" label="BMR"       value={`${card.bmr} kcal`}          status={bmrStatus}     refLabel="" />
        )}
        {card.bodyAge != null && card.bodyAge !== '' && (
          <MetricRow icon="⏱️" iconBg="#fef9c3" label="Body Age"  value={`${card.bodyAge} YRS`}       status={bodyAgeStatus} refLabel="" />
        )}
      </div>

      {/* ═══ TEAR LINE ═══ */}
      <div style={{ position: 'relative', height: 22, background: DARK_GREEN, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', zIndex: 2 }} />
        <div style={{ position: 'absolute', top: '50%', left: 12, right: 12, borderTop: '2px dashed rgba(255,255,255,0.35)' }} />
      </div>

      {/* ═══ BOARDING STATUS ═══ */}
      <div style={{ background: MID_GREEN, padding: '14px 16px' }}>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 }}>BOARDING STATUS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>CLEARED FOR TAKEOFF</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginTop: 5 }}>
          Stay Healthy, Stay Happy!
        </div>
      </div>

    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;
