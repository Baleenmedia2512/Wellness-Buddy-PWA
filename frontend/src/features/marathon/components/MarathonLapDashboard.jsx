/**
 * MarathonLapDashboard.jsx
 *
 * Premium live LAP view — same design language as MarathonTeamCard.
 * Member-facing: shows all active LAPs the user is enrolled in.
 *
 * Visual parity with the share card:
 *   - Same gradient header (TEAM_BG)
 *   - Same participant cells (photo, role badge, leader badge, name, weight)
 *   - Same badge placement and sizes
 *   - Additionally shows: discipline status, current-user highlight
 *
 * Day/Lap leaders computed from participants (eligible + most negative change).
 * Participant ordering: captain=slot1, AC=slot9, members 2-8.
 *
 * Pure render — receives laps array from useMarathon hook.
 */
import React from 'react';

// ── Shared design tokens (mirror MarathonTeamCard exactly) ─────────────────
const TEAM_BG    = 'linear-gradient(160deg, #0f766e 0%, #0d9488 40%, #0891b2 100%)';
const PHOTO_SIZE = 56;  // slightly smaller than share card for mobile comfort

const DS = {
  eligible:  { icon: '🟢', label: 'Submitted', color: '#059669' },
  missed:    { icon: '🔴', label: 'Missed',    color: '#dc2626' },
  no_upload: { icon: '🟡', label: 'Pending',   color: '#ca8a04' },
};

// ── Crown badge (day leader) ────────────────────────────────────────────────
const CrownBadge = () => (
  <div style={{
    position: 'absolute', top: 3, right: 3, zIndex: 10,
    background: '#f59e0b', borderRadius: '50%',
    width: 20, height: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(245,158,11,0.7)', fontSize: 11, lineHeight: 1,
  }}>👑</div>
);

// ── Shirt badge (lap leader) ────────────────────────────────────────────────
const ShirtBadge = () => (
  <div style={{
    position: 'absolute', top: 3, right: 3, zIndex: 10,
    background: '#2563eb', borderRadius: '50%',
    width: 20, height: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(37,99,235,0.7)', fontSize: 11, lineHeight: 1,
  }}>👕</div>
);

// ── Role badge — top-left, every participant gets one ──────────────────────
const RoleBadge = ({ lapRole, isAssistantCaptainDownline }) => {
  if (lapRole === 'captain') {
    return (
      <div style={{ position: 'absolute', top: 3, left: 3, zIndex: 10,
        background: '#059669', color: '#fff', fontSize: 7, fontWeight: 900,
        borderRadius: 3, padding: '1px 3px', lineHeight: 1.4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>C</div>
    );
  }
  if (lapRole === 'assistant_captain') {
    return (
      <div style={{ position: 'absolute', top: 3, left: 3, zIndex: 10,
        background: '#0891b2', color: '#fff', fontSize: 7, fontWeight: 900,
        borderRadius: 3, padding: '1px 3px', lineHeight: 1.4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>AC</div>
    );
  }
  if (isAssistantCaptainDownline) {
    // Plain gold star — no background
    return (
      <div style={{ position: 'absolute', top: 1, left: 3, zIndex: 10, fontSize: 9, lineHeight: 1 }}>⭐</div>
    );
  }
  return null;
};

// ── Initial avatar fallback ────────────────────────────────────────────────
const InitialAvatar = ({ name, size }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0d9488, #0891b2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.38, fontWeight: 900, color: '#fff', flexShrink: 0,
  }}>
    {String(name || '?').trim().charAt(0).toUpperCase()}
  </div>
);

// ── Weight formatting helper (shared with MarathonTeamCard) ──────────────
function formatGrams(grams) {
  if (grams == null) return '—';
  if (grams === 0)   return '▬ 0g';
  const abs  = Math.abs(grams);
  const sign = grams < 0 ? '▼' : '▲';
  return abs >= 1000
    ? `${sign} ${(abs / 1000).toFixed(2)}kg`
    : `${sign} ${abs}g`;
}

// ── Weight result pill — inline, below name ────────────────────────────────
const ResultPill = ({ dailyGrams, dailyChange, dayChange, lapGrams }) => {
  // Defensive fallback: dailyGrams → dailyChange → dayChange → lapGrams (vs. baseline)
  const grams = dailyGrams != null
    ? dailyGrams
    : dailyChange != null
    ? Math.round(dailyChange * 1000)
    : dayChange != null
    ? Math.round(dayChange * 1000)
    : lapGrams != null
    ? lapGrams
    : null;

  if (grams == null) {
    return <div style={{ marginTop: 3, fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>—</div>;
  }
  const isLoss = grams < 0;
  const isGain = grams > 0;
  const color  = isLoss ? '#059669' : isGain ? '#d97706' : '#6b7280';
  const bg     = isLoss ? '#dcfce7' : isGain ? '#fef3c7' : '#f3f4f6';
  return (
    <div style={{
      marginTop: 3, fontSize: 9, fontWeight: 800,
      color, background: bg, borderRadius: 20, padding: '1px 6px', lineHeight: 1.4,
    }}>{formatGrams(grams)}</div>
  );
};

// ── Single participant cell (matches share card MemberCell + discipline) ────
const MemberCell = ({ member, isDayLeader, isLapLeader, isCurrentUser }) => {
  const { name, profileImage, role, isAssistantCaptainDownline, dailyGrams, dailyChange, dayChange, lapGrams, disciplineStatus } = member;
  const ds = DS[disciplineStatus] || DS.no_upload;

  const ringColor = isDayLeader
    ? '#f59e0b'
    : isLapLeader
      ? '#2563eb'
      : isCurrentUser
        ? '#059669'
        : '#e5e7eb';
  const ringWidth = isDayLeader || isLapLeader || isCurrentUser ? 2.5 : 1.5;
  const shadow = isDayLeader
    ? '0 0 0 2px rgba(245,158,11,0.4), 0 3px 12px rgba(0,0,0,0.15)'
    : isLapLeader
      ? '0 0 0 2px rgba(37,99,235,0.35), 0 3px 12px rgba(0,0,0,0.15)'
      : isCurrentUser
        ? '0 0 0 2px rgba(5,150,105,0.30), 0 3px 10px rgba(0,0,0,0.12)'
        : '0 2px 8px rgba(0,0,0,0.10)';

  return (
    <div style={{
      flex: '1 1 0',
      background: isCurrentUser ? 'rgba(236,253,245,0.98)' : 'rgba(255,255,255,0.97)',
      borderRadius: 12, position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 3px 8px', boxSizing: 'border-box',
      boxShadow: shadow, overflow: 'visible',
    }}>
      <RoleBadge lapRole={role} isAssistantCaptainDownline={isAssistantCaptainDownline} />
      {isDayLeader && <CrownBadge />}
      {isLapLeader && !isDayLeader && <ShirtBadge />}

      <div style={{
        width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: '50%', overflow: 'hidden',
        border: `${ringWidth}px solid ${ringColor}`, background: '#e5e7eb', flexShrink: 0,
      }}>
        {profileImage
          ? <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <InitialAvatar name={name} size={PHOTO_SIZE} />
        }
      </div>

      {/* Name — 2-line wrap, no hard truncation */}
      <div style={{
        marginTop: 4, fontSize: 9.5, fontWeight: 700, color: '#111827',
        textAlign: 'center', lineHeight: 1.3, width: '100%', padding: '0 3px',
        boxSizing: 'border-box', wordBreak: 'break-word',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{name}</div>

      <ResultPill dailyGrams={dailyGrams} dailyChange={dailyChange} dayChange={dayChange} lapGrams={lapGrams} />

      {/* Discipline status */}
      <div style={{ marginTop: 3, fontSize: 9, color: ds.color, fontWeight: 600, textAlign: 'center', lineHeight: 1 }}>
        {ds.icon} {ds.label}
      </div>
    </div>
  );
};

// ── Empty slot placeholder ─────────────────────────────────────────────────
const EmptyCell = () => (
  <div style={{
    flex: '1 1 0', borderRadius: 12, minHeight: 100,
    background: 'rgba(0,0,0,0.06)', border: '1px dashed rgba(255,255,255,0.25)',
  }} />
);

// ── Compute day leader from participants (mirrors backend findDayLeaderV2) ──
function computeDayLeader(participants) {
  return participants.reduce((best, p) => {
    if (p.disciplineStatus !== 'eligible' || p.dayChange == null || p.dayChange >= 0) return best;
    if (!best || p.dayChange < best.dayChange) return p;
    return best;
  }, null);
}

// ── Compute lap leader from participants (mirrors backend findLapLeaderV2) ──
function computeLapLeader(participants) {
  return participants.reduce((best, p) => {
    if (p.disciplineStatus !== 'eligible' || p.lapChange == null || p.lapChange >= 0) return best;
    if (!best || p.lapChange < best.lapChange) return p;
    return best;
  }, null);
}

// ── Single LAP section — matches the share card's visual language ──────────
const LapSection = ({ lap, currentUserId }) => {
  const {
    marathonName, teamName, lapSequence, lapNumber, dayNumber,
    participants = [], teamDailyTotal, teamDailyTotalDisplay, disciplineConfig,
    dayLeader: apiDayLeader, lapLeader: apiLapLeader,
  } = lap;

  const displayName = teamName || marathonName || 'Team';

  // Use API-provided leaders if available; compute from participants as fallback
  const dayLeader   = apiDayLeader ?? computeDayLeader(participants);
  const lapLeader   = apiLapLeader ?? computeLapLeader(participants);
  const dayLeaderId = dayLeader?.userId;
  const lapLeaderId = lapLeader?.userId;

  // Enforce slot order: captain=slot1, AC=slot9, members 2-8
  const captain = participants.filter(p => p.role === 'captain');
  const ac      = participants.filter(p => p.role === 'assistant_captain');
  const members = participants.filter(p => p.role !== 'captain' && p.role !== 'assistant_captain');
  const ordered = [...captain, ...members, ...ac];
  while (ordered.length < 9) ordered.push(null);
  const grid = [ordered.slice(0, 3), ordered.slice(3, 6), ordered.slice(6, 9)];

  const isLoss     = teamDailyTotal != null && teamDailyTotal < 0;
  const isGain     = teamDailyTotal != null && teamDailyTotal > 0;
  const totalColor = isLoss ? '#34d399' : isGain ? '#fbbf24' : '#9ca3af';
  const totalStr   = teamDailyTotalDisplay
    || (teamDailyTotal != null
      ? `${isGain ? '+' : ''}${teamDailyTotal.toFixed(2)} KG`
      : '—');

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden', marginBottom: 20,
      boxShadow: '0 6px 32px rgba(0,0,0,0.18)',
    }}>

      {/* Premium header — identical language to the share card */}
      <div style={{ background: TEAM_BG, padding: '16px 18px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 1 }}>
          Wellness Valley
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: 2.5, textTransform: 'uppercase', textShadow: '0 2px 8px rgba(0,0,0,0.20)', lineHeight: 1.1, marginBottom: 8 }}>
          MARATHON
        </div>
        {/* Team name pill */}
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.94)', color: '#0f766e', fontSize: 12, fontWeight: 800, borderRadius: 100, padding: '3px 16px', maxWidth: '85%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', marginBottom: 6 }}>
          {displayName}
        </div>
        {/* Lap + Day badge */}
        <div>
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.92)', background: 'rgba(0,0,0,0.22)', borderRadius: 100, padding: '3px 14px' }}>
            LAP {lapNumber} · DAY {dayNumber}
          </span>
        </div>
        {/* Discipline window hint */}
        {disciplineConfig && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 5 }}>
            Weight window: {disciplineConfig.disciplineStartTime} – {disciplineConfig.disciplineEndTime}
          </div>
        )}
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { text: 'C = Captain',     bg: '#059669' },
            { text: 'AC = Asst. Cap.', bg: '#0891b2' },
            { text: '👑 Day Leader',   bg: 'rgba(245,158,11,0.80)' },
            { text: '👕 Lap Leader',   bg: 'rgba(37,99,235,0.80)' },
            { text: '⭐ AC Downline',   bg: 'rgba(0,0,0,0.35)' },
          ].map(({ text, bg }) => (
            <span key={text} style={{ fontSize: 8, fontWeight: 600, color: '#fff', background: bg, borderRadius: 5, padding: '2px 5px' }}>{text}</span>
          ))}
        </div>
      </div>

      {/* 3x3 grid — same gradient bg as share card */}
      <div style={{ background: TEAM_BG, padding: '0 12px 12px', overflow: 'visible' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 6, marginBottom: ri < 2 ? 6 : 0, alignItems: 'stretch' }}>
            {row.map((m, ci) =>
              m ? (
                <MemberCell
                  key={m.userId ?? `m-${ri}-${ci}`}
                  member={m}
                  isDayLeader={m.userId === dayLeaderId}
                  isLapLeader={m.userId === lapLeaderId}
                  isCurrentUser={m.userId === currentUserId}
                />
              ) : (
                <EmptyCell key={`e-${ri}-${ci}`} />
              )
            )}
          </div>
        ))}
      </div>

      {/* Premium footer */}
      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '12px 18px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 3 }}>
          Team Total Today
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: totalColor, letterSpacing: -0.5 }}>
          {totalStr}
        </div>
      </div>
    </div>
  );
};

// ── Main dashboard ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   laps: Array,          — from useMarathon.myLaps (each lap has participants, dayLeader, etc.)
 *   loading: boolean,
 *   error: string|null,
 *   currentUserId: number,
 * }} props
 */
const MarathonLapDashboard = ({ laps = [], loading, error, currentUserId }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏃</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Loading your LAPs…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ margin: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>
        {error}
      </div>
    );
  }

  if (!laps.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#6b7280' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>No Active LAPs</div>
        <div style={{ fontSize: 13, textAlign: 'center' }}>Ask your coach to add you to a marathon.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px 40px', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', padding: '4px 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🏃</span> My LAPs
      </div>
      {laps.map(lap => (
        <LapSection key={lap.marathonId} lap={lap} currentUserId={currentUserId} />
      ))}
    </div>
  );
};

export default MarathonLapDashboard;
