/**
 * MarathonTeamCard.jsx
 *
 * Premium 3×3 team recognition card (html2canvas export + screen preview).
 *
 * v3 improvements:
 *  - All 9 slots filled (captain pos-1, AC pos-9, members 2-8)
 *  - Role badges: C (Captain), AC (Asst. Captain), 🔗 (Coach), ⭐ (Upline)
 *  - teamName + LAP X · Day Y header (no redundant marathon name)
 *  - Fixed-width container at exactly CARD_W px — html2canvas matches screen
 *  - Member names allow 2-line wrap — no hidden text
 *  - Score pill sign-aware colouring
 *  - No overflow anywhere
 *
 * Pure render — no hooks, no API calls.
 */
import React from 'react';

const CARD_W     = 400;
const CELL_SIZE  = 114;
const PHOTO_SIZE = 68;

const TEAM_BG   = 'linear-gradient(160deg, #0f766e 0%, #0d9488 35%, #0891b2 100%)';
const TEAM_GLOW = 'radial-gradient(ellipse 80% 55% at 50% 20%, rgba(45,212,191,0.28) 0%, transparent 65%)';

// ── Small crown SVG ────────────────────────────────────────────────────────────
const MiniCrown = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polygon points="2,12 3.5,7 5.5,9.5 7,5 8.5,9.5 10.5,7 12,12" fill="#fbbf24" stroke="white" strokeWidth="0.8" strokeLinejoin="round"/>
    <rect x="2" y="12" width="10" height="1.8" rx="0.9" fill="#fbbf24"/>
  </svg>
);

// ── Role badge (top-left of cell) ─────────────────────────────────────────────
// lapRole: 'captain' | 'assistant_captain' | 'member'
// systemRole: 'coach' | 'upline' | 'user' | null
const RoleBadge = ({ lapRole, systemRole }) => {
  let label = null;
  let bg    = '#059669';
  let isEmoji = false;

  if (lapRole === 'captain') {
    label = 'C'; bg = '#059669';
  } else if (lapRole === 'assistant_captain') {
    label = 'AC'; bg = '#0891b2';
  } else if (systemRole === 'upline') {
    label = '⭐'; bg = '#7c3aed'; isEmoji = true;
  } else if (systemRole === 'coach') {
    label = '🔗'; bg = '#d97706'; isEmoji = true;
  }

  if (!label) return null;
  return (
    <div style={{
      position: 'absolute', top: 4, left: 4,
      background: isEmoji ? 'transparent' : bg, color: '#fff',
      fontSize: isEmoji ? 11 : 9, fontWeight: 800,
      borderRadius: 4, padding: isEmoji ? '1px 2px' : '2px 5px',
      lineHeight: 1.4, letterSpacing: 0.5,
      zIndex: 2,
    }}>
      {label}
    </div>
  );
};

// ── Score pill: green for loss, amber for gain, gray for zero/null ─────────────
const ScorePill = ({ grams }) => {
  if (grams == null) {
    return (
      <div style={{
        position: 'absolute', top: 4, right: 4,
        background: 'rgba(107,114,128,0.80)', color: '#fff',
        fontSize: 9, fontWeight: 700, borderRadius: 8,
        padding: '2px 5px', zIndex: 2,
      }}>—</div>
    );
  }
  const isLoss  = grams < 0;
  const isGain  = grams > 0;
  const bg      = isLoss ? 'rgba(5,150,105,0.90)' : isGain ? 'rgba(217,119,6,0.90)' : 'rgba(107,114,128,0.80)';
  const display = grams > 0 ? `+${grams}` : String(grams);
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      background: bg, color: '#fff',
      fontSize: 9, fontWeight: 800, borderRadius: 8,
      padding: '2px 5px', zIndex: 2, letterSpacing: 0.3,
    }}>{display}</div>
  );
};

// ── Leader crown overlay ───────────────────────────────────────────────────────
const LeaderOverlay = () => (
  <div style={{ position: 'absolute', bottom: 26, right: 5, zIndex: 3 }}>
    <MiniCrown />
  </div>
);

// ── Placeholder avatar ─────────────────────────────────────────────────────────
const InitialAvatar = ({ name, size }) => {
  const initial = String(name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#0d9488,#0891b2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
    }}>
      {initial}
    </div>
  );
};

// ── Single member cell ─────────────────────────────────────────────────────────
const MemberCell = ({ member, isLeader }) => {
  const { name, profileImage, role, systemRole, dailyGrams } = member;

  return (
    <div style={{
      width: CELL_SIZE, height: CELL_SIZE,
      background: 'rgba(255,255,255,0.96)',
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
      boxShadow: isLeader
        ? '0 0 0 2.5px #fbbf24, 0 4px 14px rgba(0,0,0,0.18)'
        : '0 3px 10px rgba(0,0,0,0.14)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 10,
    }}>
      <RoleBadge lapRole={role} systemRole={systemRole} />
      <ScorePill grams={dailyGrams} />
      {isLeader && <LeaderOverlay />}

      {/* Profile photo */}
      <div style={{
        width: PHOTO_SIZE, height: PHOTO_SIZE,
        borderRadius: '50%', overflow: 'hidden',
        border: isLeader ? '2.5px solid #fbbf24' : '2px solid #e5e7eb',
        flexShrink: 0, background: '#e5e7eb',
      }}>
        {profileImage ? (
          <img
            src={profileImage}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            crossOrigin="anonymous"
          />
        ) : (
          <InitialAvatar name={name} size={PHOTO_SIZE} />
        )}
      </div>

      {/* Name — 2-line clamp, no overflow clipping */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#1f2937',
        textAlign: 'center',
        padding: '4px 4px 0',
        lineHeight: 1.25,
        width: '100%', boxSizing: 'border-box',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}>
        {name}
      </div>
    </div>
  );
};

// ── Empty cell placeholder (if fewer than 9 members) ──────────────────────────
const EmptyCell = () => (
  <div style={{
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.10)',
    border: '1px dashed rgba(255,255,255,0.20)',
  }} />
);

// ── Main card ──────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   card: {
 *     cardType: string,
 *     marathonName: string,
 *     teamName: string|null,
 *     lapSequence: number,
 *     lapNumber: number,
 *     dayNumber: number,
 *     participants: Array,
 *     dayLeader: object|null,
 *     teamDailyTotal: number,
 *     teamDailyTotalDisplay: string,
 *   }
 * }} props
 */
const MarathonTeamCard = ({ card }) => {
  if (!card) return null;

  const {
    marathonName, teamName, lapSequence, lapNumber, dayNumber,
    participants = [], dayLeader, teamDailyTotalDisplay,
  } = card;

  // Display name for header: prefer teamName, fall back to full marathonName
  const displayName = teamName || marathonName || 'Team Card';

  // Ensure exactly 9 slots
  const slots = [...participants];
  while (slots.length < 9) slots.push(null);
  const grid = [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];

  const leaderId = dayLeader?.userId;

  return (
    <div style={{
      width: CARD_W,
      background: TEAM_BG,
      borderRadius: 28,
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
      position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      /* explicit box-sizing so html2canvas measures it correctly */
      boxSizing: 'border-box',
    }}>

      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, background: TEAM_GLOW, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '24px 20px 14px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
          letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2,
        }}>
          Wellness Valley
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, color: '#ffffff',
          letterSpacing: 4, textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.20)', lineHeight: 1.1,
        }}>
          MARATHON
        </div>
        {/* Team name + LAP · Day badges */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'nowrap' }}>
          <span style={{
            background: 'rgba(255,255,255,0.92)', color: '#0f766e',
            fontSize: 12, fontWeight: 800, borderRadius: 100,
            padding: '4px 14px', maxWidth: 180,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'inline-block', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            flexShrink: 1,
          }}>
            {displayName}
          </span>
          <span style={{
            background: 'rgba(0,0,0,0.30)', color: '#fff',
            fontSize: 12, fontWeight: 700, borderRadius: 100,
            padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Lap {lapNumber}  ·  Day {dayNumber}
          </span>
        </div>
      </div>

      {/* 3×3 grid */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 14px 10px' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 7,
            marginBottom: ri < 2 ? 7 : 0,
          }}>
            {row.map((member, ci) => (
              member
                ? <MemberCell key={member.userId} member={member} isLeader={member.userId === leaderId} />
                : <EmptyCell key={`empty-${ri}-${ci}`} />
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 2,
        background: 'rgba(0,0,0,0.28)',
        margin: '10px 0 0',
        padding: '14px 20px 18px',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
          marginBottom: 3, letterSpacing: 0.2,
        }}>
          {displayName}  ·  Lap {lapSequence ?? lapNumber}, Day {dayNumber}
        </div>
        <div style={{
          fontSize: 20, fontWeight: 900, color: '#ffffff',
          letterSpacing: -0.5,
        }}>
          Daily result&nbsp;&nbsp;
          <span style={{ color: card.teamDailyTotal <= 0 ? '#34d399' : '#fbbf24' }}>
            {teamDailyTotalDisplay || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarathonTeamCard;
