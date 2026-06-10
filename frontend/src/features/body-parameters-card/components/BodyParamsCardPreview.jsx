/**
 * BodyParamsCardPreview.jsx
 *
 * Receipt-style card modelled after a UPI payment slip.
 * Orange gradient background · mandala corners · green tick ·
 * white ticket card with side notches · dashed divider · watermark.
 * Rendered off-screen so html2canvas can export it as a JPEG.
 */
import React from 'react';

/* ── Field row inside the white card ── */
const Field = ({ label, value, badge = null }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
    <span style={{
      width: 88, flexShrink: 0,
      fontSize: 10, fontWeight: 700,
      color: '#555', textTransform: 'uppercase', letterSpacing: 0.3,
    }}>
      {label}
    </span>
    <span style={{ fontSize: 10, fontWeight: 700, color: '#555', marginRight: 7 }}>:</span>
    {badge || <span style={{ fontSize: 11, color: '#222', fontWeight: 600 }}>{value || '—'}</span>}
  </div>
);

/* ── Red pill for BMI / Fat% values ── */
const Pill = ({ value, ref_label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <span style={{
      fontSize: 10, fontWeight: 700, color: '#fff',
      background: '#c0392b', borderRadius: 20, padding: '2px 9px',
    }}>{value}</span>
    {ref_label && <span style={{ fontSize: 10, color: '#555' }}>{ref_label}</span>}
  </span>
);

/**
 * @param {{ card: object }} props
 */
const BodyParamsCardPreview = React.forwardRef(({ card }, ref) => {
  const fmt = (v, unit = '') =>
    v !== null && v !== undefined && v !== '' ? `${v}${unit}` : '';

  const fmtDate = (v) => {
    if (!v) return '';
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    if (/^\d{8}$/.test(str))
      return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
    return str;
  };

  const bmiValue = (() => {
    const b = card.bmi;
    if (b === '' || b === null || b === undefined) return { pill: null, label: '(19–23)', outOfRange: false };
    const val = parseFloat(b);
    const outOfRange = val < 19 || val > 23;
    return { pill: `${b}`, label: '(19–23)', outOfRange };
  })();

  const fatValue = (() => {
    const f = card.fatPercent;
    if (f === '' || f === null || f === undefined) return { pill: null, label: '', outOfRange: false };
    const val = parseFloat(f);
    const pct = `${f}%`;
    if (card.gender === 'Male') {
      return { pill: pct, label: '(10–20)', outOfRange: val < 10 || val > 20 };
    }
    if (card.gender === 'Female') {
      return { pill: pct, label: '(20–30)', outOfRange: val < 20 || val > 30 };
    }
    return { pill: pct, label: '', outOfRange: false };
  })();

  /* ── Mandala SVG (simple concentric-ring decoration) ── */
  const Mandala = ({ size, opacity }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
      {[48,40,32,24,16,8].map((r, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none" stroke="#fff"
          strokeWidth="1.2" strokeDasharray={i % 2 === 0 ? '6 4' : '3 5'} />
      ))}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 50 + 10 * Math.cos(rad), y1 = 50 + 10 * Math.sin(rad);
        const x2 = 50 + 46 * Math.cos(rad), y2 = 50 + 46 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth="0.8" opacity="0.5" />;
      })}
    </svg>
  );

  return (
    <div ref={ref} style={{
      width: 320,
      background: 'linear-gradient(160deg, #22c55e 0%, #16a34a 45%, #15803d 100%)',
      borderRadius: 20,
      padding: '28px 18px 20px',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    }}>

      {/* Mandala — top-left */}
      <div style={{ position: 'absolute', top: -18, left: -18, opacity: 0.35 }}>
        <Mandala size={110} opacity={1} />
      </div>
      {/* Mandala — bottom-right */}
      <div style={{ position: 'absolute', bottom: -18, right: -18, opacity: 0.28 }}>
        <Mandala size={100} opacity={1} />
      </div>
      {/* Mandala — bottom-left small */}
      <div style={{ position: 'absolute', bottom: 10, left: -10, opacity: 0.2 }}>
        <Mandala size={60} opacity={1} />
      </div>

      {/* ── Logo: plain white circle ── */}
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
        boxShadow: '0 3px 12px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        position: 'relative', zIndex: 2,
      }}>
        <img
          src="/logo.png"
          alt="Wellness Valley"
          style={{ width: 44, height: 44, objectFit: 'contain' }}
        />
      </div>

      {/* ── White ticket card ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* Left + Right notch (ticket tear effect) */}
        <div style={{
          position: 'absolute', left: -18, top: '48%',
          width: 18, height: 18, borderRadius: '0 50% 50% 0',
          background: 'linear-gradient(160deg, #22c55e 0%, #16a34a 100%)',
          zIndex: 3,
        }} />
        <div style={{
          position: 'absolute', right: -18, top: '48%',
          width: 18, height: 18, borderRadius: '50% 0 0 50%',
          background: 'linear-gradient(160deg, #16a34a 0%, #15803d 100%)',
          zIndex: 3,
        }} />

        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '18px 18px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>

          {/* Title + name */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: 1, textTransform: 'uppercase' }}>
              WELLNESS EVALUATION REPORT
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>
              {card.name || '—'}
            </p>
            {card.locationName && (
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#888' }}>
                {card.locationName}
              </p>
            )}
          </div>

          {/* ── Dashed divider ── */}
          <div style={{
            borderTop: '2px dashed #e5e7eb',
            margin: '10px -18px',
          }} />

          {/* All fields */}
          <div style={{ paddingTop: 10 }}>
            <Field label="Date"     value={fmtDate(card.recordedDate)} />
            <Field label="Age"      value={fmt(card.age)} />
            <Field label="Gender"   value={card.gender || ''} />
            <Field label="Height"   value={fmt(card.heightCm, ' cm')} />
            <Field label="Weight"   value={fmt(card.weightKg, ' kg')} />
            <Field label="BMI" badge={
              bmiValue.pill ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: bmiValue.outOfRange ? '#fff' : '#1a1a6e',
                    background: bmiValue.outOfRange ? '#c0392b' : 'transparent',
                    borderRadius: 20,
                    padding: bmiValue.outOfRange ? '2px 9px' : '0',
                  }}>{bmiValue.pill}</span>
                  <span style={{ fontSize: 10, color: '#555' }}>{bmiValue.label}</span>
                </span>
              ) : null
            } value={bmiValue.pill ? '' : '—'} />
            <Field label="BMR"      value={fmt(card.bmr, ' kcal')} />
            <Field label="Fat%" badge={
              fatValue.pill ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: fatValue.outOfRange ? '#fff' : '#1a1a6e',
                    background: fatValue.outOfRange ? '#c0392b' : 'transparent',
                    borderRadius: 20,
                    padding: fatValue.outOfRange ? '2px 9px' : '0',
                  }}>{fatValue.pill}</span>
                  {fatValue.label && <span style={{ fontSize: 10, color: '#555' }}>{fatValue.label}</span>}
                </span>
              ) : null
            } value={fatValue.pill ? '' : '—'} />
            <Field label="Body Age" value={fmt(card.bodyAge, ' yrs')} />
          </div>

        </div>

        {/* ── WELLNESS VALLEY watermark ── */}
        <div style={{
          background: '#fff',
          borderRadius: '0 0 14px 14px',
          padding: '8px 0 12px',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
        }}>
          <p style={{
            margin: 0,
            fontSize: 8, fontWeight: 600,
            color: '#888', letterSpacing: 1, textTransform: 'uppercase',
          }}>
            Powered by
          </p>
          <p style={{
            margin: '2px 0 0',
            fontSize: 10, fontWeight: 800,
            color: '#16a34a', letterSpacing: 3, textTransform: 'uppercase',
          }}>
            WELLNESS VALLEY
          </p>
        </div>

      </div>
    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;
