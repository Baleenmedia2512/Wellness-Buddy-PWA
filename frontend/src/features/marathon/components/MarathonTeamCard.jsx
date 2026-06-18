/**
 * MarathonTeamCard.jsx
 *
 * Premium 3×3 team recognition card rendered off-screen for html2canvas.
 *
 * Design upgrades vs Telegram reference:
 *  - Deep teal gradient background with radial glow
 *  - Each member cell has elevation (shadow, rounded card)
 *  - Profile photo fills the cell richly
 *  - Score badge uses a pill design with sign-aware colour (loss=green, gain=amber)
 *  - Leader of the day is highlighted with a subtle crown overlay
 *  - Rich footer with total reduction
 *
 * Pure render — no hooks, no API calls.
 */
import React from 'react';

const CARD_W     = 400;
const CELL_SIZE  = 112;
const PHOTO_SIZE = 72;

const TEAM_BG = 'linear-gradient(160deg, #0f766e 0%, #0d9488 35%, #0891b2 100%)';
const TEAM_GLOW = 'radial-gradient(ellipse 80% 55% at 50% 20%, rgba(45,212,191,0.30) 0%, transparent 65%)';

// ── Small crown SVG for day/lap leader highlight ──────────────────────────────
const MiniCrown = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polygon points="2,12 3.5,7 5.5,9.5 7,5 8.5,9.5 10.5,7 12,12" fill="#fbbf24" stroke="white" strokeWidth="0.8" strokeLinejoin="round"/>
    <rect x="2" y="12" width="10" height="1.8" rx="0.9" fill="#fbbf24"/>
  </svg>
);

// ── Coach badge ────────────────────────────────────────────────────────────────
const CoachBadge = () => (
  <div style={{
    position: 'absolute', top: 5, left: 5,
    background: '#059669', color: '#fff',
    fontSize: 9, fontWeight: 800,
    borderRadius: 4, padding: '2px 5px',
    lineHeight: 1.4, letterSpacing: 0.5,
    zIndex: 2,
  }}>
    C
  </div>
);

// ── Score pill: green for loss (negative), amber for gain (positive), gray for zero/null ──
const ScorePill = ({ grams }) => {
  if (grams == null) {
    return (
      <div style={{
        position: 'absolute', top: 4, right: 4,
        background: 'rgba(107,114,128,0.85)', color: '#fff',
        fontSize: 9, fontWeight: 700, borderRadius: 8,
        padding: '2px 5px', zIndex: 2,
      }}>
        —
      </div>
    );
  }
  const isLoss  = grams < 0;
  const isGain  = grams > 0;
  const bg      = isLoss ? 'rgba(5,150,105,0.90)' : isGain ? 'rgba(217,119,6,0.90)' : 'rgba(107,114,128,0.85)';
  const display = grams > 0 ? `+${grams}` : String(grams);
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      background: bg, color: '#fff',
      fontSize: 9, fontWeight: 800, borderRadius: 8,
      padding: '2px 5px', zIndex: 2,
      letterSpacing: 0.3,
    }}>
      {display}
    </div>
  );
};

// ── Leader crown overlay ───────────────────────────────────────────────────────
const LeaderOverlay = () => (
  <div style={{
    position: 'absolute', bottom: 24, right: 5,
    zIndex: 3,
  }}>
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
  const { name, profileImage, role, dailyGrams } = member;
  const isCoach = role === 'coach';

  return (
    <div style={{
      width: CELL_SIZE, height: CELL_SIZE,
      background: 'rgba(255,255,255,0.95)',
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
      {isCoach   && <CoachBadge />}
      <ScorePill grams={dailyGrams} />
      {isLeader  && <LeaderOverlay />}

      {/* Profile photo */}
      <div style={{
        width: PHOTO_SIZE, height: PHOTO_SIZE,
        borderRadius: '50%',
        overflow: 'hidden',
        border: isLeader ? '2.5px solid #fbbf24' : '2px solid #e5e7eb',
        flexShrink: 0,
        background: '#e5e7eb',
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

      {/* Name — allows 2 lines for longer names */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#1f2937',
        textAlign: 'center',
        padding: '5px 4px 0',
        lineHeight: 1.25,
        maxWidth: CELL_SIZE - 8,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
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
 *     marathonName: string,
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

  const { marathonName, lapNumber, dayNumber, participants = [], dayLeader, teamDailyTotalDisplay } = card;

  // Pad to exactly 9 cells
  const cells = [...participants];
  while (cells.length < 9) cells.push(null);
  const grid = [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)];

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
    }}>

      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, background: TEAM_GLOW, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '28px 20px 16px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
          letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2,
        }}>
          Wellness Valley
        </div>
        <div style={{
          fontSize: 32, fontWeight: 900, color: '#ffffff',
          letterSpacing: 4, textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.20)',
        }}>
          MARATHON
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          <span style={{
            background: 'rgba(255,255,255,0.92)', color: '#0f766e',
            fontSize: 12, fontWeight: 800, borderRadius: 100, padding: '4px 14px',
            maxWidth: CARD_W - 80, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', display: 'inline-block',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}>
            {marathonName || 'Team Card'}
          </span>
          <span style={{
            background: 'rgba(0,0,0,0.35)', color: '#fff',
            fontSize: 12, fontWeight: 700, borderRadius: 100, padding: '4px 12px',
            whiteSpace: 'nowrap',
          }}>
            Lap {lapNumber}  ·  Day {dayNumber}
          </span>
        </div>
      </div>

      {/* 3×3 grid */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 16px 8px' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: ri < 2 ? 8 : 0,
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
        background: 'rgba(0,0,0,0.25)',
        margin: '12px 0 0',
        padding: '14px 20px',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
          marginBottom: 2,
        }}>
          {marathonName || 'Team'}  ·  Lap {lapNumber}, Day {dayNumber}
        </div>
        <div style={{
          fontSize: 20, fontWeight: 900, color: '#ffffff',
          letterSpacing: -0.5,
        }}>
          Daily result&nbsp;&nbsp;
          <span style={{
            color: card.teamDailyTotal <= 0 ? '#34d399' : '#fbbf24',
          }}>
            {teamDailyTotalDisplay || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarathonTeamCard;
