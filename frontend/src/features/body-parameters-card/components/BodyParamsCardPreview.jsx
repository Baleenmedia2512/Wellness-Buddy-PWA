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

  const bmiPill  = card.bmi       != null && card.bmi       !== '' ? `${card.bmi}`       : null;
  const fatPill  = card.fatPercent != null && card.fatPercent !== '' ? `${card.fatPercent}%` : null;
  const fatLabel = card.gender === 'Male' ? '(10–20)' : card.gender === 'Female' ? '(20–30)' : '';

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

      {/* ── Dark circle with logo inside ── */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: '#1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
        boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
        position: 'relative', zIndex: 2,
      }}>
        {/* White inner circle with logo */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img
            src="/logo.png"
            alt="Wellness Valley"
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </div>
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
            <Field label="BMI"      badge={bmiPill  ? <Pill value={bmiPill}  ref_label="(19–23)" /> : null} value="" />
            <Field label="BMR"      value={fmt(card.bmr, ' kcal')} />
            <Field label="Fat%"     badge={fatPill  ? <Pill value={fatPill}  ref_label={fatLabel} /> : null} value="" />
            <Field label="Body Age" value={fmt(card.bodyAge, ' yrs')} />
          </div>

          {/* ── Dark footer strip with WELLNESS VALLEY + scalloped bottom edge ── */}
          <div style={{ margin: '14px -18px 0' }}>

            {/* Dark strip */}
            <div style={{
              background: '#1a1a1a',
              padding: '8px 0 10px',
              textAlign: 'center',
            }}>
              <p style={{
                margin: 0,
                fontSize: 10, fontWeight: 800,
                color: '#16a34a', letterSpacing: 3, textTransform: 'uppercase',
              }}>
                WELLNESS VALLEY
              </p>
            </div>

            {/* Scalloped bottom edge — white semi-circles cut from dark band */}
            <svg
              width="100%" height="18"
              viewBox="0 0 320 18"
              preserveAspectRatio="none"
              style={{ display: 'block', borderRadius: '0 0 14px 14px' }}
            >
              <rect x="0" y="0" width="320" height="18" fill="#1a1a1a" />
              {Array.from({ length: 18 }).map((_, i) => (
                <circle key={i} cx={i * 18 + 9} cy="18" r="9" fill="#fff" />
              ))}
            </svg>

          </div>

        </div>
      </div>
    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;
