/**
 * MarathonTeamCard.jsx — Premium 3x3 team recognition card.
 * v5: 480px, auto-height cells, overflow:visible, inline weight result,
 *     role badges (C/AC/🔗/⭐), leader badges (👑/👕), enforced slot order.
 * Pure render — no hooks, no API calls.
 */
import React from 'react';

const CARD_W     = 480;
const PHOTO_SIZE = 68;
const TEAM_BG    = 'linear-gradient(160deg, #0f766e 0%, #0d9488 40%, #0891b2 100%)';

// Crown badge (day leader)
const CrownBadge = () => (
  <div style={{
    position: 'absolute', top: 4, right: 4, zIndex: 10,
    background: '#f59e0b', borderRadius: '50%',
    width: 22, height: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(245,158,11,0.7)', fontSize: 13, lineHeight: 1,
  }}>👑</div>
);

// Shirt badge (lap leader)
const ShirtBadge = () => (
  <div style={{
    position: 'absolute', top: 4, right: 4, zIndex: 10,
    background: '#2563eb', borderRadius: '50%',
    width: 22, height: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(37,99,235,0.7)', fontSize: 13, lineHeight: 1,
  }}>👕</div>
);

// Role badge — top-left; every participant gets one
const RoleBadge = ({ lapRole, systemRole }) => {
  let label, bg;
  if      (lapRole === 'captain')           { label = 'C';  bg = '#059669'; }
  else if (lapRole === 'assistant_captain') { label = 'AC'; bg = '#0891b2'; }
  else if (systemRole === 'upline' || systemRole === 'admin') { label = '⭐'; bg = '#7c3aed'; }
  else                                      { label = '🔗'; bg = '#d97706'; }
  return (
    <div style={{
      position: 'absolute', top: 4, left: 4, zIndex: 10,
      background: bg, color: '#fff',
      fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '2px 4px',
      lineHeight: 1.4, boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    }}>{label}</div>
  );
};

// Weight result pill — inline, below name
const ResultPill = ({ dailyGrams, dailyChange }) => {
  const grams = dailyGrams != null
    ? dailyGrams
    : (dailyChange != null ? Math.round(dailyChange * 1000) : null);

  if (grams == null) {
    return <div style={{ marginTop: 4, fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>—</div>;
  }
  const isLoss  = grams < 0;
  const isGain  = grams > 0;
  const color   = isLoss ? '#059669' : isGain ? '#d97706' : '#6b7280';
  const bg      = isLoss ? '#dcfce7' : isGain ? '#fef3c7' : '#f3f4f6';
  const display = isGain ? `+${grams}g` : grams === 0 ? '0g' : `${grams}g`;
  return (
    <div style={{
      marginTop: 4, fontSize: 10, fontWeight: 800,
      color, background: bg, borderRadius: 20, padding: '2px 7px', lineHeight: 1.4,
    }}>{display}</div>
  );
};

// Initials avatar fallback
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

// Single member cell
const MemberCell = ({ member, isDayLeader, isLapLeader }) => {
  const { name, profileImage, role, systemRole, dailyGrams, dailyChange } = member;
  const ringColor = isDayLeader ? '#f59e0b' : isLapLeader ? '#2563eb' : '#e5e7eb';
  const ringWidth = isDayLeader || isLapLeader ? 3 : 1.5;
  const shadow = isDayLeader
    ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.35)'
    : isLapLeader
      ? '0 0 0 2px #2563eb, 0 4px 16px rgba(37,99,235,0.30)'
      : '0 2px 8px rgba(0,0,0,0.13)';

  return (
    <div style={{
      flex: '1 1 0', background: 'rgba(255,255,255,0.97)', borderRadius: 14,
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 4px 10px', boxSizing: 'border-box', boxShadow: shadow, overflow: 'visible',
    }}>
      <RoleBadge lapRole={role} systemRole={systemRole} />
      {isDayLeader && <CrownBadge />}
      {isLapLeader && !isDayLeader && <ShirtBadge />}

      <div style={{
        width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: '50%', overflow: 'hidden',
        border: `${ringWidth}px solid ${ringColor}`, background: '#e5e7eb', flexShrink: 0,
      }}>
        {profileImage
          ? <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} crossOrigin="anonymous" />
          : <InitialAvatar name={name} size={PHOTO_SIZE} />
        }
      </div>

      <div style={{
        marginTop: 5, fontSize: 10, fontWeight: 700, color: '#111827', textAlign: 'center',
        lineHeight: 1.35, width: '100%', padding: '0 4px', boxSizing: 'border-box',
        wordBreak: 'break-word', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{name}</div>

      <ResultPill dailyGrams={dailyGrams} dailyChange={dailyChange} />
    </div>
  );
};

// Empty slot placeholder
const EmptyCell = () => (
  <div style={{
    flex: '1 1 0', borderRadius: 14, minHeight: 120,
    background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(255,255,255,0.22)',
  }} />
);

// Main card component
const MarathonTeamCard = ({ card }) => {
  if (!card) return null;
  const {
    marathonName, teamName, lapSequence, lapNumber, dayNumber,
    participants = [], dayLeader, lapLeader, teamDailyTotalDisplay,
  } = card;

  const displayName = teamName || marathonName || 'Team';

  // Enforce slot order: captain=0, members=1-7, AC=8
  const captain = participants.filter(p => p.role === 'captain');
  const ac      = participants.filter(p => p.role === 'assistant_captain');
  const members = participants.filter(p => p.role !== 'captain' && p.role !== 'assistant_captain');
  const ordered = [...captain, ...members, ...ac];
  while (ordered.length < 9) ordered.push(null);
  const grid = [ordered.slice(0, 3), ordered.slice(3, 6), ordered.slice(6, 9)];

  const dayLeaderId = dayLeader?.userId;
  const lapLeaderId = lapLeader?.userId;

  return (
    <div style={{
      width: CARD_W, background: TEAM_BG, borderRadius: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)', boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.60)', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2 }}>
          Wellness Valley
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.25)', lineHeight: 1.05, marginBottom: 8 }}>
          MARATHON
        </div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.94)', color: '#0f766e', fontSize: 13, fontWeight: 800, borderRadius: 100, padding: '4px 18px', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', marginBottom: 6 }}>
          {displayName}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
          LAP {lapNumber} · DAY {dayNumber}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { text: 'C = Captain',     bg: '#059669' },
            { text: 'AC = Asst. Cap.', bg: '#0891b2' },
            { text: '👑 Day Leader',   bg: 'rgba(245,158,11,0.80)' },
            { text: '👕 Lap Leader',   bg: 'rgba(37,99,235,0.80)' },
            { text: '🔗 Member',       bg: 'rgba(217,119,6,0.75)' },
          ].map(({ text, bg }) => (
            <span key={text} style={{ fontSize: 8, fontWeight: 600, color: '#fff', background: bg, borderRadius: 5, padding: '2px 6px' }}>{text}</span>
          ))}
        </div>
      </div>

      {/* 3x3 grid */}
      <div style={{ padding: '0 14px 10px', overflow: 'visible' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 7, marginBottom: ri < 2 ? 7 : 0, alignItems: 'stretch' }}>
            {row.map((member, ci) =>
              member
                ? <MemberCell key={member.userId ?? `m-${ri}-${ci}`} member={member} isDayLeader={member.userId === dayLeaderId} isLapLeader={member.userId === lapLeaderId} />
                : <EmptyCell key={`empty-${ri}-${ci}`} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ background: 'rgba(0,0,0,0.32)', padding: '12px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName} · Lap {lapSequence ?? lapNumber}, Day {dayNumber}
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
          Daily Result{' '}
          <span style={{ color: card.teamDailyTotal != null && card.teamDailyTotal <= 0 ? '#34d399' : '#fbbf24' }}>
            {teamDailyTotalDisplay || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarathonTeamCard;
