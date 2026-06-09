/**
 * BodyParamsCardPreview.jsx
 *
 * Off-screen styled card that matches "YOUR BODY PARAMETERS" card (Image 1).
 * Rendered into a hidden div so html2canvas can paint it to a JPEG for share.
 * This component is pure-presentational — zero state, zero fetch.
 */
import React from 'react';

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', minWidth: 80, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </span>
    <span style={{ flex: 1, borderBottom: '1.5px dotted #6b6bcb', minWidth: 80, height: 16 }} />
    <span style={{ fontSize: 12, color: '#2d2d7a', minWidth: 60, textAlign: 'right' }}>
      {value || ''}
    </span>
  </div>
);

const HalfRow = ({ label, value }) => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
    <span style={{ fontWeight: 700, fontSize: 11, color: '#2d2d7a', minWidth: 50, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </span>
    <span style={{ flex: 1, borderBottom: '1.5px dotted #6b6bcb', height: 16 }} />
    <span style={{ fontSize: 12, color: '#2d2d7a', minWidth: 40, textAlign: 'right' }}>
      {value || ''}
    </span>
  </div>
);

/**
 * @param {{ card: object }} props
 *   card: { name, age, gender, heightCm, weightKg, bmi, fatPercent, bmr, bodyAge, recordedDate, locationName }
 */
const BodyParamsCardPreview = React.forwardRef(({ card }, ref) => {
  const fmt = (v, unit = '') => (v !== null && v !== undefined && v !== '') ? `${v}${unit}` : '';

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
      <h2 style={{ textAlign: 'center', color: '#2d2d7a', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, margin: '0 0 12px', textTransform: 'uppercase' }}>
        Your Body Parameters
      </h2>

      {/* Card border box */}
      <div style={{ border: '2px solid #6b6bcb', borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.6)' }}>
        {/* Date + Location */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <HalfRow label="Date"     value={card.recordedDate  || ''} />
          <HalfRow label="Location" value={card.locationName  || ''} />
        </div>

        {/* Name */}
        <Row label="Name"     value={card.name} />

        {/* Age + Gender */}
        <div style={{ display: 'flex', gap: 12 }}>
          <HalfRow label="Age"    value={fmt(card.age)} />
          <HalfRow label="Gender" value={card.gender || ''} />
        </div>

        {/* Height + BMI */}
        <div style={{ display: 'flex', gap: 12 }}>
          <HalfRow label="Height" value={fmt(card.heightCm, ' cm')} />
          <HalfRow label="BMI"    value={fmt(card.bmi)} />
        </div>

        {/* Fat% note */}
        <p style={{ fontSize: 9, color: '#5555aa', margin: '2px 0 6px', textAlign: 'right' }}>
          Fat% M:10–20 / F:20–30
        </p>

        {/* Weight + BMR */}
        <div style={{ display: 'flex', gap: 12 }}>
          <HalfRow label="Weight" value={fmt(card.weightKg, ' kg')} />
          <HalfRow label="BMR"    value={fmt(card.bmr, ' kcal')} />
        </div>

        {/* Fat% */}
        <Row label="Fat%"     value={fmt(card.fatPercent, '%')} />

        {/* Body Age */}
        <Row label="Body Age" value={fmt(card.bodyAge, ' yrs')} />
      </div>

      {/* Watermark */}
      <p style={{ textAlign: 'center', fontSize: 8, color: '#6b6bcb', marginTop: 8, letterSpacing: 1 }}>
        WELLNESS VALLEY
      </p>
    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;
