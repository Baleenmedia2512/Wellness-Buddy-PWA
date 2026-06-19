/**
 * MarathonLapDashboard.jsx
 *
 * Member-facing view: shows all active LAPs the user is enrolled in.
 * Each LAP is a 3×3 grid showing:
 *   - Profile photo
 *   - Name + role badge
 *   - Today's weight change (colored pill)
 *   - Discipline status icon (🟢 Eligible / 🔴 Missed / ⚪ No upload)
 *
 * Pure render — receives `laps` array from useMarathon hook.
 */
import React from 'react';

const DISCIPLINE_STATUS = {
  eligible:  { icon: '🟢', label: 'Disciplined', color: '#059669' },
  missed:    { icon: '🔴', label: 'Missed',      color: '#dc2626' },
  no_upload: { icon: '⚪', label: 'No upload',   color: '#9ca3af' },
};

const ROLE_BADGE = {
  captain:           { label: 'C',  bg: '#059669', color: '#fff' },
  assistant_captain: { label: 'AC', bg: '#0891b2', color: '#fff' },
  member:            { label: '',   bg: 'transparent', color: 'transparent' },
};

// ── Pill for weight change ─────────────────────────────────────────────────
const ChangePill = ({ grams }) => {
  if (grams == null) return (
    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>—</span>
  );
  const isLoss = grams < 0;
  const isGain = grams > 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 6px',
      background: isLoss ? '#dcfce7' : isGain ? '#fef3c7' : '#f3f4f6',
      color:      isLoss ? '#15803d' : isGain ? '#92400e' : '#6b7280',
    }}>
      {grams > 0 ? `+${grams}` : grams}g
    </span>
  );
};

// ── Single member cell (112×120) ──────────────────────────────────────────
const MemberCell = ({ member, isCurrentUser }) => {
  const { name, profileImage, role, dailyGrams, disciplineStatus } = member;
  const ds   = DISCIPLINE_STATUS[disciplineStatus] || DISCIPLINE_STATUS.no_upload;
  const rb   = ROLE_BADGE[role] || ROLE_BADGE.member;

  return (
    <div style={{
      background:    isCurrentUser ? '#ecfdf5' : '#fff',
      border:        isCurrentUser ? '1.5px solid #059669' : '1px solid #e5e7eb',
      borderRadius:  14,
      padding:       '8px 6px 10px',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           4,
      position:      'relative',
    }}>
      {/* Role badge */}
      {rb.label && (
        <div style={{
          position: 'absolute', top: 5, left: 5,
          background: rb.bg, color: rb.color,
          fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 4px',
        }}>
          {rb.label}
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        overflow: 'hidden', border: '2px solid #e5e7eb',
        background: '#f3f4f6', flexShrink: 0,
      }}>
        {profileImage ? (
          <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#059669,#0891b2)',
            fontSize: 20, fontWeight: 900, color: '#fff',
          }}>
            {String(name || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#111827', textAlign: 'center',
        maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </div>

      {/* Weight change */}
      <ChangePill grams={dailyGrams} />

      {/* Discipline status */}
      <div style={{ fontSize: 10, color: ds.color, fontWeight: 600 }}>
        {ds.icon} {ds.label}
      </div>
    </div>
  );
};

// ── Empty cell ─────────────────────────────────────────────────────────────
const EmptyCell = () => (
  <div style={{
    borderRadius: 14, border: '1px dashed #e5e7eb',
    background: '#fafafa', minHeight: 120,
  }} />
);

// ── Single LAP section ─────────────────────────────────────────────────────
const LapSection = ({ lap, currentUserId }) => {
  const { marathonName, lapNumber, dayNumber, participants = [], teamDailyTotal, disciplineConfig } = lap;

  const cells = [...participants];
  while (cells.length < 9) cells.push(null);
  const grid = [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)];

  const isLoss   = teamDailyTotal < 0;
  const isGain   = teamDailyTotal > 0;
  const totalAbs = teamDailyTotal != null ? `${isLoss ? '' : '+'}${teamDailyTotal.toFixed(2)} KG` : '—';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
      marginBottom: 20,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#0f766e,#0891b2)',
        padding: '14px 16px 12px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{marathonName}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {lapNumber && (
            <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.18)', borderRadius: 100, padding: '2px 10px' }}>
              Lap {lapNumber}  ·  Day {dayNumber}
            </span>
          )}
          {disciplineConfig && (
            <span style={{ fontSize: 11, opacity: 0.8 }}>
              Window: {disciplineConfig.disciplineStartTime} – {disciplineConfig.disciplineEndTime}
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '12px 12px 8px' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: ri < 2 ? 8 : 0 }}>
            {row.map((m, ci) =>
              m ? (
                <div key={m.userId} style={{ flex: 1 }}>
                  <MemberCell member={m} isCurrentUser={m.userId === currentUserId} />
                </div>
              ) : (
                <div key={`e${ri}${ci}`} style={{ flex: 1 }}>
                  <EmptyCell />
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {/* Footer total */}
      <div style={{
        background: '#f9fafb', padding: '10px 16px',
        borderTop: '1px solid #f3f4f6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Team total today</span>
        <span style={{
          fontSize: 16, fontWeight: 900,
          color: isLoss ? '#059669' : isGain ? '#d97706' : '#6b7280',
        }}>
          {totalAbs}
        </span>
      </div>
    </div>
  );
};

// ── Main dashboard ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   laps: Array,         — from useMarathon.myLaps
 *   loading: boolean,
 *   error: string|null,
 *   currentUserId: number,
 * }} props
 */
const MarathonLapDashboard = ({ laps = [], loading, error, currentUserId }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>
        Loading your LAPs…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: '16px',
        background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: 12, padding: '12px 16px',
        fontSize: 13, color: '#dc2626',
      }}>
        {error}
      </div>
    );
  }

  if (!laps.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏁</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>You are not enrolled in any active LAPs.</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Ask your coach to add you to a marathon.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 32px', maxWidth: 440, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', padding: '16px 0 12px' }}>
        🏃 My LAPs
      </div>
      {laps.map(lap => (
        <LapSection key={lap.marathonId} lap={lap} currentUserId={currentUserId} />
      ))}
    </div>
  );
};

export default MarathonLapDashboard;
