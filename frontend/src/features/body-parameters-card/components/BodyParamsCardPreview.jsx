/**
 * BodyParamsCardPreview.jsx
 *
 * Off-screen styled card — "YOUR BODY PARAMETERS".
 * Uses LABEL : VALUE style (colon separator, no dotted lines).
 * Rendered into a hidden div so html2canvas can paint it to a JPEG for share.
 */
import React from 'react';

/* ── Single full-width row: LABEL : value ──────────────────────────────── */
const Row = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 80 }}>
      {label}
    </span>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', marginRight: 8 }}>:</span>
    <span style={{ fontSize: 12, color: '#1a1a6e' }}>{value || '—'}</span>
  </div>
);

/* ── Half-width row used side-by-side ──────────────────────────────────── */
const HalfRow = ({ label, value }) => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginBottom: 7 }}>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 54 }}>
      {label}
    </span>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', marginRight: 6 }}>:</span>
    <span style={{ fontSize: 12, color: '#1a1a6e' }}>{value || '—'}</span>
  </div>
);

/**
 * @param {{ card: object }} props
 */
const BodyParamsCardPreview = React.forwardRef(({ card }, ref) => {
  const fmt = (v, unit = '') => (v !== null && v !== undefined && v !== '') ? `${v}${unit}` : '';

  const fmtDate = (v) => {
    if (!v) return '';
    const s = String(v).replace(/-/g, '');
    if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return v;
  };

  const fatValue = card.fatPercent !== '' && card.fatPercent !== null && card.fatPercent !== undefined
    ? `${card.fatPercent}%${card.gender === 'Male' ? ' (10–20)' : card.gender === 'Female' ? ' (20–30)' : ''}`
    : '';

  return (
    <div
      ref={ref}
      style={{
        width: 340,
        background: 'linear-gradient(135deg, #e8e8ff 0%, #d4d4ff 50%, #c8c8f8 100%)',
        borderRadius: 16,
        padding: 20,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: 'relative',
        boxShadow: '0 4px 20px rgba(43,43,150,0.15)',
      }}
    >
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -8, right: -8, width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,100,220,0.25)' }} />
      <div style={{ position: 'absolute', bottom: 10, left: -6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(100,100,220,0.2)' }} />

      {/* Title */}
      <h2 style={{ textAlign: 'center', color: '#2d2d7a', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, margin: '0 0 14px', textTransform: 'uppercase' }}>
        Your Body Parameters
      </h2>

      {/* Card border box */}
      <div style={{ border: '2px solid #6b6bcb', borderRadius: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.65)' }}>

        {/* DATE : value   LOCATION : value */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <HalfRow label="Date"     value={fmtDate(card.recordedDate)} />
          <HalfRow label="Location" value={card.locationName || ''} />
        </div>

        {/* NAME */}
        <Row label="Name" value={card.name} />

        {/* AGE + GENDER */}
        <div style={{ display: 'flex', gap: 8 }}>
          <HalfRow label="Age"    value={fmt(card.age)} />
          <HalfRow label="Gender" value={card.gender || ''} />
        </div>

        {/* HEIGHT + BMI */}
        <div style={{ display: 'flex', gap: 8 }}>
          <HalfRow label="Height" value={fmt(card.heightCm, 'cm')} />
          <HalfRow label="BMI"    value={fmt(card.bmi)} />
        </div>

        {/* WEIGHT + BMR */}
        <div style={{ display: 'flex', gap: 8 }}>
          <HalfRow label="Weight" value={fmt(card.weightKg, 'kg')} />
          <HalfRow label="BMR"    value={fmt(card.bmr, 'kcal')} />
        </div>

        {/* FAT% */}
        <Row label="Fat%" value={fatValue} />

        {/* BODY AGE */}
        <Row label="Body Age" value={fmt(card.bodyAge, 'yrs')} />

      </div>

      {/* Watermark */}
      <p style={{ textAlign: 'center', fontSize: 8, color: '#6b6bcb', marginTop: 10, letterSpacing: 1 }}>
        WELLNESS VALLEY
      </p>
    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;

