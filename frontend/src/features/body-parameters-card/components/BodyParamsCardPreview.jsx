/**
 * BodyParamsCardPreview.jsx
 *
 * Off-screen styled card — "YOUR BODY PARAMETERS".
 * Single-column layout: LABEL (fixed width) : value
 * Rendered into a hidden div so html2canvas can paint it to a JPEG for share.
 */
import React from 'react';

/* ── Full-width row with fixed label column so colons align ── */
const Row = ({ label, value, badge = null }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
    <span style={{
      width: 90,
      flexShrink: 0,
      fontWeight: 700,
      fontSize: 11,
      color: '#2d2d7a',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    }}>
      {label}
    </span>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', marginRight: 8 }}>:</span>
    {badge ? badge : (
      <span style={{ fontSize: 12, color: '#1a1a6e' }}>{value || '—'}</span>
    )}
  </div>
);

/**
 * @param {{ card: object }} props
 */
const BodyParamsCardPreview = React.forwardRef(({ card }, ref) => {
  const fmt = (v, unit = '') => (v !== null && v !== undefined && v !== '') ? `${v}${unit}` : '';

  const fmtDate = (v) => {
    if (!v) return '';
    const str = String(v);
    // Already YYYY-MM-DD (from HTML date input)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    // Compact YYYYMMDD (no hyphens)
    if (/^\d{8}$/.test(str)) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
    return str;
  };

  const bmiValue = (() => {
    const b = card.bmi;
    if (b === '' || b === null || b === undefined) return { text: '', outOfRange: false };
    const val = parseFloat(b);
    if (val < 19) return { text: `${b} ⚠️ Below Normal (19–23)`, outOfRange: true };
    if (val > 23) return { text: `${b} ⚠️ Above Normal (19–23)`, outOfRange: true };
    return { text: `${b} (19–23)`, outOfRange: false };
  })();

  const fatValue = (() => {
    const f = card.fatPercent;
    if (f === '' || f === null || f === undefined) return { text: '', outOfRange: false };
    const val = parseFloat(f);
    const pct = `${f}%`;
    if (card.gender === 'Male') {
      if (val < 10)  return { text: `${pct} ⚠️ Below Normal (10–20)`, outOfRange: true };
      if (val > 20)  return { text: `${pct} ⚠️ Above Normal (10–20)`, outOfRange: true };
      return { text: `${pct} (10–20)`, outOfRange: false };
    }
    if (card.gender === 'Female') {
      if (val < 20)  return { text: `${pct} ⚠️ Below Normal (20–30)`, outOfRange: true };
      if (val > 30)  return { text: `${pct} ⚠️ Above Normal (20–30)`, outOfRange: true };
      return { text: `${pct} (20–30)`, outOfRange: false };
    }
    return { text: pct, outOfRange: false };
  })();

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

        <Row label="Date"     value={fmtDate(card.recordedDate)} />
        <Row label="Location" value={card.locationName || ''} />
        <Row label="Name"     value={card.name} />
        <Row label="Age"      value={fmt(card.age)} />
        <Row label="Gender"   value={card.gender || ''} />
        <Row label="Height"   value={fmt(card.heightCm, ' cm')} />
        <Row label="Weight"   value={fmt(card.weightKg, ' kg')} />

        {/* BMI — red pill when out of range */}
        <Row label="BMI" badge={
          bmiValue.text ? (
            bmiValue.outOfRange ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#c0392b', borderRadius: 20, padding: '2px 10px' }}>
                {bmiValue.text}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#1a1a6e' }}>{bmiValue.text}</span>
            )
          ) : <span style={{ fontSize: 12, color: '#1a1a6e' }}>—</span>
        } />

        <Row label="BMR"      value={fmt(card.bmr, ' kcal')} />

        {/* Fat% — red pill when out of range */}
        <Row label="Fat%" badge={
          fatValue.text ? (
            fatValue.outOfRange ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#c0392b', borderRadius: 20, padding: '2px 10px' }}>
                {fatValue.text}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#1a1a6e' }}>{fatValue.text}</span>
            )
          ) : <span style={{ fontSize: 12, color: '#1a1a6e' }}>—</span>
        } />

        <Row label="Body Age" value={fmt(card.bodyAge, ' yrs')} />

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

