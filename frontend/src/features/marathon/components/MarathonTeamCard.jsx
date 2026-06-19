/**
 * MarathonTeamCard.jsx
 *
 * Premium 3×3 team recognition card (html2canvas export + screen preview).
 *
 * v4 improvements:
 *  - All 9 slots filled (captain pos-1, AC pos-9, members 2-8)
 *  - Role badges with solid backgrounds: C (Captain), AC (Asst. Captain)
 *  - System role badges with backgrounds: 🔗 (Coach), ⭐ (Upline)
 *  - Lap leader → 👕 T-shirt; Day leader → Crown
 *  - Per-participant weight result in kg (e.g. -0.40 kg, +0.30 kg)
 *  - Fixed-width container at exactly CARD_W px — html2canvas matches screen
 *  - Member names allow 2-line wrap — no hidden text
 *  - No overflow, proper padding and alignment
 *
 * Pure render — no hooks, no API calls.
 */
import React from 'react';

const CARD_W     = 400;
const CELL_SIZE  = 114;
const PHOTO_SIZE = 62;

const TEAM_BG   = 'linear-gradient(160deg, #0f766e 0%, #0d9488 35%, #0891b2 100%)';
const TEAM_GLOW = 'radial-gradient(ellipse 80% 55% at 50% 20%, rgba(45,212,191,0.28) 0%, transparent 65%)';

// ── Crown SVG (day leader) ────────────────────────────────────────────────────
const MiniCrown = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polygon points="2,12 3.5,7 5.5,9.5 7,5 8.5,9.5 10.5,7 12,12" fill="#fbbf24" stroke="white" strokeWidth="0.8" strokeLinejoin="round"/>
    <rect x="2" y="12" width="10" height="1.8" rx="0.9" fill="#fbbf24"/>
  </svg>
);

// ── T-shirt SVG (lap leader) ──────────────────────────────────────────────────
const TShirtIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M16 2l4 4-4 4v12H8V10L4 6l4-4 4 3 4-3z" fill="#60a5fa" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

// ── Role badge (top-left of cell) — ONE badge in priority order ──────────────
const RoleBadge = ({ lapRole, systemRole }) => {
  let label = null;
  let bg    = '#059669';

  if (lapRole === 'captain') {
    label = 'C'; bg = '#059669';
  } else if (lapRole === 'assistant_captain') {
    label = 'AC'; bg = '#0891b2';
  } else if (systemRole === 'upline') {
    label = '⭐'; bg = '#7c3aed';
  } else if (systemRole === 'coach') {
    label = '🔗'; bg = '#d97706';
  }

  if (!label) return null;
  return (
    <div style={{
      position: 'absolute', top: 4, left: 4,
      background: bg, color: '#fff',
      fontSize: 9, fontWeight: 800,
      borderRadius: 4, padding: '2px 5px',
      lineHeight: 1.4, letterSpacing: 0.3,
      zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
    }}>
      {label}
    </div>
  );
};

// ── Weight result pill: kg format ─────────────────────────────────────────────
const WeightPill = ({ dailyChange, dailyGrams }) => {
  const kg = dailyChange != null
    ? dailyChange
    : (dailyGrams != null ? dailyGrams / 1000 : null);

  if (kg == null) {
    return (
      <div style={{
        position: 'absolute', top: 4, right: 4,
        background: 'rgba(107,114,128,0.85)', color: '#fff',
        fontSize: 8, fontWeight: 700, borderRadius: 8,
        padding: '2px 5px', zIndex: 2,
      }}>—</div>
    );
  }
  const isLoss  = kg < 0;
  const isGain  = kg > 0;
  const bg      = isLoss ? 'rgba(5,150,105,0.90)' : isGain ? 'rgba(217,119,6,0.90)' : 'rgba(107,114,128,0.85)';
  const display = isGain ? `+${Math.abs(kg).toFixed(2)}` : isLoss ? `-${Math.abs(kg).toFixed(2)}` : '0.00';
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      background: bg, color: '#fff',
      fontSize: 8, fontWeight: 800, borderRadius: 8,
      padding: '2px 5px', zIndex: 2, letterSpacing: 0.2,
      whiteSpace: 'nowrap',
    }}>{display} kg</div>
  );
};

// ── Day-leader crown overlay ───────────────────────────────────────────────────
const DayLeaderOverlay = () => (
  <div style={{ position: 'absolute', bottom: 22, right: 5, zIndex: 3 }}>
    <MiniCrown />
  </div>
);

// ── Lap-leader T-shirt overlay ────────────────────────────────────────────────
const LapLeaderOverlay = () => (
  <div style={{ position: 'absolute', bottom: 22, right: 5, zIndex: 3 }}>
    <TShirtIcon />
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
const MemberCell = ({ member, isDayLeader, isLapLeader }) => {
  const { name, profileImage, role, systemRole, dailyGrams, dailyChange } = member;

  return (
    <div style={{
      width: CELL_SIZE, height: CELL_SIZE,
      background: 'rgba(255,255,255,0.97)',
      borderRadius: 12,
      position: 'relative',
      boxShadow: isDayLeader
        ? '0 0 0 2.5px #fbbf24, 0 4px 14px rgba(0,0,0,0.18)'
        : isLapLeader
          ? '0 0 0 2.5px #60a5fa, 0 4px 10px rgba(0,0,0,0.14)'
          : '0 2px 8px rgba(0,0,0,0.12)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 8,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <RoleBadge lapRole={role} systemRole={systemRole} />
      <WeightPill dailyChange={dailyChange} dailyGrams={dailyGrams} />
      {isDayLeader && <DayLeaderOverlay />}
      {isLapLeader && !isDayLeader && <LapLeaderOverlay />}

      {/* Profile photo */}
      <div style={{
        width: PHOTO_SIZE, height: PHOTO_SIZE,
        borderRadius: '50%', overflow: 'hidden',
        border: isDayLeader
          ? '2.5px solid #fbbf24'
          : isLapLeader
            ? '2.5px solid #60a5fa'
            : '2px solid #e5e7eb',
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

      {/* Name — 2-line clamp */}
      <div style={{
        fontSize: 9.5, fontWeight: 700, color: '#1f2937',
        textAlign: 'center',
        padding: '4px 5px 2px',
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

// ── Empty cell placeholder ─────────────────────────────────────────────────────
const EmptyCell = () => (
  <div style={{
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 12,
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
 *     lapLeader: object|null,
 *     teamDailyTotal: number,
 *     teamDailyTotalDisplay: string,
 *   }
 * }} props
 */
const MarathonTeamCard = ({ card }) => {
  if (!card) return null;

  const {
    marathonName, teamName, lapSequence, lapNumber, dayNumber,
    participants = [], dayLeader, lapLeader, teamDailyTotalDisplay,
  } = card;

  const displayName = teamName || marathonName || 'Team Card';

  // Ensure exactly 9 slots
  const slots = [...participants];
  while (slots.length < 9) slots.push(null);
  const grid = [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];

  const dayLeaderId = dayLeader?.userId;
  const lapLeaderId = lapLeader?.userId;

  return (
    <div style={{
      width: CARD_W,
      background: TEAM_BG,
      borderRadius: 24,
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
      position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      boxSizing: 'border-box',
    }}>

      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, background: TEAM_GLOW, pointerEvents: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '20px 16px 10px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
          letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2,
        }}>
          Wellness Valley
        </div>
        <div style={{
          fontSize: 26, fontWeight: 900, color: '#ffffff',
          letterSpacing: 3, textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.20)', lineHeight: 1.1,
        }}>
          MARATHON
        </div>

        {/* Team name + LAP/Day badges */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 6, marginTop: 8, flexWrap: 'nowrap',
        }}>
          <span style={{
            background: 'rgba(255,255,255,0.94)', color: '#0f766e',
            fontSize: 11, fontWeight: 800, borderRadius: 100,
            padding: '4px 12px',
            maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'inline-block', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            flexShrink: 1,
          }}>
            {displayName}
          </span>
          <span style={{
            background: 'rgba(0,0,0,0.30)', color: '#fff',
            fontSize: 11, fontWeight: 700, borderRadius: 100,
            padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Lap {lapNumber}  ·  Day {dayNumber}
          </span>
        </div>

        {/* Compact legend */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginTop: 7,
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'C = Captain',      bg: '#059669' },
            { label: 'AC = Asst. Cap.',  bg: '#0891b2' },
            { label: '👑 Day Leader',    bg: null },
            { label: '👕 Lap Leader',    bg: null },
          ].map(({ label, bg }) => (
            <span key={label} style={{
              fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.80)',
              background: bg || 'rgba(0,0,0,0.20)', borderRadius: 6,
              padding: '2px 6px',
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 3×3 grid ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 12px 8px' }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: ri < 2 ? 6 : 0,
          }}>
            {row.map((member, ci) => (
              member
                ? <MemberCell
                    key={member.userId}
                    member={member}
                    isDayLeader={member.userId === dayLeaderId}
                    isLapLeader={member.userId === lapLeaderId}
                  />
                : <EmptyCell key={`empty-${ri}-${ci}`} />
            ))}
          </div>
        ))}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        background: 'rgba(0,0,0,0.28)',
        margin: '8px 0 0',
        padding: '12px 16px 16px',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.80)',
          marginBottom: 3, letterSpacing: 0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}  ·  Lap {lapSequence ?? lapNumber}, Day {dayNumber}
        </div>
        <div style={{
          fontSize: 18, fontWeight: 900, color: '#ffffff',
          letterSpacing: -0.5,
        }}>
          Daily result&nbsp;&nbsp;
          <span style={{ color: card.teamDailyTotal != null && card.teamDailyTotal <= 0 ? '#34d399' : '#fbbf24' }}>
            {teamDailyTotalDisplay || '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MarathonTeamCard;
