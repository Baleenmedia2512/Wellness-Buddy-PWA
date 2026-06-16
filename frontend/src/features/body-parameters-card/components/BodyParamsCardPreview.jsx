/**
 * BodyParamsCardPreview.jsx
 *
 * Wellness Evaluation Report share card.
 * bg.png canvas · green-bordered ticket · label:value stats table ·
 * value | reference layout · circular body-age gauge.
 * Rendered off-screen so html2canvas can export it as a JPEG.
 */
import React from 'react';

const G          = '#16a34a';
const DARK_GREEN = '#166534';
// const BLUE       = '#3b82f6';
const RED        = '#ef4444';
const INK        = '#1a1a2e';
const OUTER_BG   = '#f5f0e8';
const CARD_WIDTH  = 430;
const CANVAS_WIDTH = 520;

/* ── Custom metric icons (SVG) ── */
const WeightScaleIcon = () => (
  <svg viewBox="0 0 28 28" width="22" height="22" fill="none">
    <rect x="2" y="4" width="24" height="21" rx="4" stroke="#16a34a" strokeWidth="2.2"/>
    <path d="M7 16 Q14 8 21 16" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="14" y1="16" x2="18" y2="11" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="14" cy="16" r="1.6" fill="#16a34a"/>
  </svg>
);

const HeightIcon = () => (
  <svg viewBox="0 0 28 28" width="22" height="22">
    <circle cx="9" cy="5" r="2.5" fill="#374151"/>
    <rect x="6.5" y="8.5" width="5" height="8" rx="2" fill="#374151"/>
    <rect x="6.5" y="16.5" width="2" height="6" rx="1" fill="#374151"/>
    <rect x="9.5" y="16.5" width="2" height="6" rx="1" fill="#374151"/>
    <rect x="19" y="2" width="4" height="24" rx="1.5" fill="#374151"/>
    <rect x="19" y="6" width="4" height="1.5" fill="white"/>
    <rect x="19" y="11" width="4" height="1.5" fill="white"/>
    <rect x="19" y="16" width="4" height="1.5" fill="white"/>
    <rect x="19" y="21" width="4" height="1.5" fill="white"/>
  </svg>
);

const FatDropIcon = () => (
  <svg viewBox="0 0 28 28" width="22" height="22">
    <path d="M14 2 C13 4 6 12 6 17.5 C6 22.2 9.6 26 14 26 C18.4 26 22 22.2 22 17.5 C22 12 15 4 14 2Z" fill="#3b82f6"/>
    <text x="9.5" y="22" fontSize="9" fill="white" fontWeight="900" fontFamily="Arial,sans-serif">%</text>
  </svg>
);

/* ── Thin vertical | divider ── */
const VDivider = () => (
  <div style={{
    width: 1, alignSelf: 'stretch',
    background: '#c8d8d0', margin: '4px 12px', flexShrink: 0,
  }} />
);

/* ── Single label : value  |  extra info row ── */
const InfoRow = ({ icon, label, value, extra, extraColor }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px dashed #e2e8f0',
    minHeight: 42,
  }}>
    <div style={{
      width: 30, fontSize: 22, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginRight: 8,
    }}>
      {icon}
    </div>
    <div style={{
      width: 105, fontSize: 16, fontWeight: 800, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: 0.7, flexShrink: 0,
    }}>
      {label}
    </div>
    <div style={{ width: 22, fontSize: 16, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
      :
    </div>
    <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
      {value}
    </div>
    {extra ? (
      <>
        <VDivider />
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: extraColor || '#9ca3af',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {extra}
        </span>
      </>
    ) : null}
  </div>
);

/* ── Circular gauge with value label inside ── */
const BodyAgeCircle = ({ value, color }) => {
  const r = 22, cx = 27, cy = 27, size = 54;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#dfe5ec" strokeWidth="4.5"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4.5"
          strokeDasharray={arc + ' ' + circ}
          strokeLinecap="round"
          transform={'rotate(-90 ' + cx + ' ' + cy + ')'}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 900, color,
      }}>
        {value}
      </div>
    </div>
  );
};

/* ── Circle ring for metric values ──────────────────────────────────────────
   outOfRange (fresh user)  → RED ring, dark text
   greenRing  (existing)    → GREEN ring, green text
   neither                  → no ring at all (plain text)
*/
const MetricCircle = ({ value, outOfRange, greenRing }) => {
  const size = 64, r = 28, cx = 32, cy = 32;
  const stroke    = greenRing ? G : RED;
  const sw        = greenRing ? 2.5 : 1.5;
  const textColor = greenRing ? G : INK;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-flex' }}>
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, fontWeight: 900, color: textColor,
      }}>
        {value}
      </div>
    </div>
  );
};

/* ── Metric row ─────────────────────────────────────────────────────────────
   isExistingUser = true  → 3 columns: CURRENT | PREV | REFERENCE
                            ring is always green (tracking mode)
   isExistingUser = false → 2 columns: CURRENT | REFERENCE
                            red ring only when oval && out-of-range
*/
const MetricRow = ({
  icon, iconBg, label, value,
  rangeLabel, status, bodyAgeMode, bodyAgeVal, oval, rangeNote,
  prevValue, isExistingUser,
}) => {
  const isOutOfRange  = status && status.bg === RED;
  const showRedRing   = !isExistingUser && oval && isOutOfRange;
  const showGreenRing = isExistingUser && oval;
  const hasRef        = rangeLabel || (bodyAgeMode && bodyAgeVal != null);

  // Column widths shrink slightly when PREV column is present
  const REF_W  = isExistingUser ? 100 : 120;
  const PREV_W = 70;

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px dashed #d1d9e0',
      minHeight: 56,
    }}>
      {/* Icon bubble */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0, marginRight: 12,
      }}>
        {icon}
      </div>

      {/* Label */}
      <div style={{
        width: 92, fontSize: 15, fontWeight: 800, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
      }}>
        {label}
      </div>

      {/* Colon */}
      <div style={{ width: 22, fontSize: 16, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>:</div>

      {/* Current value */}
      <div style={{
        flex: isExistingUser ? 0 : 1,
        width: isExistingUser ? 64 : undefined,
        minWidth: isExistingUser ? 64 : 0,
        display: 'flex', alignItems: 'center',
      }}>
        {showRedRing ? (
          <MetricCircle value={value} outOfRange />
        ) : showGreenRing ? (
          <MetricCircle value={value} greenRing />
        ) : (
          <span style={{ fontSize: 20, fontWeight: 900, color: INK }}>{value}</span>
        )}
      </div>

      {/* PREV column — only for existing user */}
      {isExistingUser && (
        <>
          <VDivider />
          <div style={{
            width: PREV_W, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#6b7280' }}>
              {prevValue || '—'}
            </span>
          </div>
        </>
      )}

      {/* Reference column */}
      {hasRef ? (
        <>
          <VDivider />
          <div style={{
            width: REF_W, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            {bodyAgeMode && rangeNote ? (
              <span style={{ fontSize: 14, fontWeight: 800, color: '#9ca3af', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {rangeNote}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.3 }}>
                {rangeLabel}
              </span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

/* ─────────────────────────────── main component ── */
const BodyParamsCardPreview = React.forwardRef(({ card, previousCard = null }, ref) => {
  const isExistingUser = Boolean(previousCard);
  const fmt = (v, unit) => {
    const u = unit || '';
    return v !== null && v !== undefined && v !== '' ? (v + u) : '—';
  };

  const fmtDate = (v) => {
    if (!v) return '—';
    const str = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    if (/^\d{8}$/.test(str))
      return str.slice(0, 4) + '-' + str.slice(4, 6) + '-' + str.slice(6, 8);
    return str;
  };

  /* ── Status helpers ── */
  const bmiVal = parseFloat(card.bmi);
  const bmiStatus = !isNaN(bmiVal)
    ? bmiVal < 19 ? { label: 'UNDERWEIGHT', bg: RED  }
    : bmiVal > 23 ? { label: 'OVERWEIGHT',  bg: RED  }
    :               { label: 'NORMAL',       bg: G }
    : null;
  const bmiRangeColor = bmiStatus ? bmiStatus.bg : null;

  const fatVal  = parseFloat(card.fatPercent);
  const gender  = String(card.gender || '').toLowerCase();
  const isM = gender === 'male', isF = gender === 'female';
  const fatMin = isM ? 10 : 20, fatMax = isM ? 20 : 30;
  const fatRangeLabel = isM ? '10 to 20%' : isF ? '20 to 30%' : '';
  const fatStatus = !isNaN(fatVal) && (isM || isF)
    ? fatVal < fatMin ? { label: 'LOW FAT',  bg: RED  }
    : fatVal > fatMax ? { label: 'HIGH FAT', bg: RED  }
    :                   { label: 'HEALTHY',  bg: G }
    : null;
  const fatRangeColor = fatStatus ? fatStatus.bg : null;

  const bmrVal    = parseFloat(card.bmr);
  const bmrStatus = !isNaN(bmrVal) && bmrVal > 0 ? { label: 'GOOD', bg: G } : null;

  const bodyAgeVal    = parseFloat(card.bodyAge);
  const ageVal        = parseFloat(card.age);
  const bodyAgeStatus = !isNaN(bodyAgeVal)
    ? (!isNaN(ageVal) && bodyAgeVal > ageVal) ? { label: 'AGING',   bg: RED }
    :                                           { label: 'OPTIMAL', bg: G   }
    : null;
  const bodyAgeRangeNote = !isNaN(ageVal) ? ('\u2264 ' + card.age + ' Yrs') : null;

  /* ── Ideal weight range from height (BMI 19–23) ── */
  const idealWeightHint = (function () {
    const h = parseFloat(card.heightCm);
    if (!h || h < 100 || h > 250) return null;
    const m = h / 100;
    const lo = Math.round(19 * m * m * 10) / 10;
    const hi = Math.round(23 * m * m * 10) / 10;
    return lo + ' to ' + hi + ' kg';
  }());

  return (
    <div
      ref={ref}
      data-testid="body-params-share-canvas"
      style={{
        width: CANVAS_WIDTH,
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        background: OUTER_BG,
        backgroundImage: 'url(/bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '36px 28px 52px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle light overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.32) 0%, transparent 45%, rgba(0,0,0,0.04) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Green-bordered ticket card */}
      <div
        data-testid="body-params-share-card"
        style={{
          width: CARD_WIDTH,
          margin: '0 auto',
          border: '2px solid ' + DARK_GREEN,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 14px 40px rgba(22,101,52,0.22)',
          position: 'relative',
          zIndex: 1,
        }}
      >

        {/* ═══ TOP GREEN HEADER ═══ */}
        <div style={{
          background: DARK_GREEN, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: '#fff', border: '2px solid rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/logo.png" alt="Wellness Valley" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          </div>
          <span style={{
            fontSize: 19, fontWeight: 900, color: '#fff',
            letterSpacing: 0.8, flex: 1, lineHeight: 1.25,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}>
            Body Composition Metric
          </span>
        </div>

        {/* ═══ PERSONAL STATS SECTION ═══ */}
        <div style={{ background: '#fff', padding: '18px 22px 12px' }}>

          <InfoRow icon="👤" label="Name"     value={(card.name || '—').toUpperCase()} />
          {card.phoneNumber ? (
            <InfoRow icon="📞" label="Phone" value={card.phoneNumber} />
          ) : null}
          <InfoRow icon="📅" label="Date"     value={fmtDate(card.recordedDate)} />
          <InfoRow icon="🎂" label="Age"      value={card.age ? card.age + ' Yrs' : '—'} />
          <InfoRow icon="🚻" label="Gender"   value={card.gender ? card.gender.charAt(0).toUpperCase() + card.gender.slice(1).toLowerCase() : '—'} />
          <InfoRow icon={<HeightIcon />} label="Height"   value={fmt(card.heightCm, ' cm')} />
          {card.bmr != null && card.bmr !== '' && (
            <InfoRow icon="🔥" label="BMR" value={card.bmr + ' kcal'} />
          )}

        </div>

        {/* ═══ TEAR LINE ═══ */}
        <div style={{ position: 'relative', height: 26, background: '#fff', overflow: 'visible' }}>
          <div style={{
            position: 'absolute', left: -13, top: '50%', transform: 'translateY(-50%)',
            width: 26, height: 26, borderRadius: '50%', background: OUTER_BG, zIndex: 3,
          }} />
          <div style={{
            position: 'absolute', right: -13, top: '50%', transform: 'translateY(-50%)',
            width: 26, height: 26, borderRadius: '50%', background: OUTER_BG, zIndex: 3,
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: 16, right: 16,
            borderTop: '2px dashed #86efac',
          }} />
        </div>

        {/* ═══ METRICS SECTION ═══ */}
        <div style={{ background: '#f0fdf4', padding: '14px 22px 18px' }}>

          {/* Column header row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            paddingBottom: 6, marginBottom: 2,
            borderBottom: '1.5px solid #bbf7d0',
          }}>
            <div style={{ flex: 1 }} />
            {/* PREV header — only when existing user */}
            {isExistingUser && (
              <>
                <div style={{ width: 1, margin: '0 12px', flexShrink: 0 }} />
                <span style={{ width: 70, flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#86a88e', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' }}>
                  Prev
                </span>
              </>
            )}
            {/* Phantom VDivider space */}
            <div style={{ width: 1, margin: '0 12px', flexShrink: 0 }} />
            <span style={{ width: isExistingUser ? 100 : 120, flexShrink: 0, fontSize: 11, fontWeight: 900, color: '#86a88e', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' }}>
              Reference
            </span>
          </div>

          {card.weightKg != null && card.weightKg !== '' && (
            <MetricRow
              icon={<WeightScaleIcon />} iconBg="#f0fdf4"
              label="Weight"
              value={fmt(card.weightKg, ' kg')}
              rangeLabel={idealWeightHint}
              status={null}
              prevValue={previousCard?.weightKg != null ? previousCard.weightKg + ' kg' : '—'}
              isExistingUser={isExistingUser}
            />
          )}
          {card.bmi != null && card.bmi !== '' && (
            <MetricRow
              icon="🧍" iconBg="#dcfce7"
              label="BMI"
              value={String(card.bmi)}
              rangeLabel="19 to 23"
              status={bmiStatus}
              oval
              prevValue={previousCard?.bmi != null ? String(previousCard.bmi) : '—'}
              isExistingUser={isExistingUser}
            />
          )}
          {card.fatPercent != null && card.fatPercent !== '' && (
            <MetricRow
              icon={<FatDropIcon />} iconBg="#fef9c3"
              label="Fat %"
              value={card.fatPercent + '%'}
              rangeLabel={fatRangeLabel}
              status={fatStatus}
              oval
              prevValue={previousCard?.fatPercent != null ? previousCard.fatPercent + '%' : '—'}
              isExistingUser={isExistingUser}
            />
          )}
          {card.bodyAge != null && card.bodyAge !== '' && (
            <MetricRow
              icon="⏱️" iconBg="#fef9c3"
              label="Body Age"
              value={card.bodyAge + ' Yrs'}
              status={bodyAgeStatus}
              bodyAgeMode
              bodyAgeVal={isNaN(bodyAgeVal) ? null : bodyAgeVal}
              rangeNote={bodyAgeRangeNote}
              prevValue={previousCard?.bodyAge != null ? previousCard.bodyAge + ' Yrs' : '—'}
              isExistingUser={isExistingUser}
            />
          )}

          {/* Footer brand */}
          <div style={{
            marginTop: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, borderTop: '1px dashed #bbf7d0' }} />
            <span style={{
              fontSize: 13, fontWeight: 900, color: DARK_GREEN,
              letterSpacing: 2, textTransform: 'uppercase',
            }}>
              Wellness Valley
            </span>
            <div style={{ flex: 1, borderTop: '1px dashed #bbf7d0' }} />
          </div>

        </div>

      </div>{/* end card */}

      {/* Bottom-right flower decoration */}
      <div style={{
        position: 'absolute', bottom: 10, right: 18, zIndex: 2, pointerEvents: 'none',
      }}>
        <img src="/flower-icon.png" alt="" aria-hidden="true" style={{ width: 72, height: 88, objectFit: 'contain', display: 'block' }} />
      </div>
    </div>
  );
});

BodyParamsCardPreview.displayName = 'BodyParamsCardPreview';
export default BodyParamsCardPreview;
