/**
 * MarathonLeaderCard.jsx
 *
 * Premium recognition card rendered off-screen for html2canvas export.
 * Used for: Day Leader, Lap Leader, Community Leader.
 *
 * Design decisions vs the Telegram reference:
 *  - Full-bleed hero photo with gradient overlay (vs small circle)
 *  - SVG crown / medal (vs emoji)
 *  - Celebration ray burst behind photo
 *  - Rich gradient backgrounds with radial depth glow
 *  - Glassmorphism info card
 *  - Large bold metric number with visual emphasis
 *  - Tier-differentiated color systems
 *
 * Pure render — no hooks, no API calls. Receives a `card` prop.
 */
import React from 'react';

// ── Color systems per card type ────────────────────────────────────────────
const THEMES = {
  day_leader: {
    bgGradient:   'linear-gradient(160deg, #f59e0b 0%, #d97706 40%, #b45309 100%)',
    glow:         'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(253,211,77,0.45) 0%, transparent 70%)',
    accentColor:  '#fbbf24',
    metricColor:  '#78350f',
    badgeColor:   '#fef3c7',
    badgeText:    '#92400e',
    titleText:    'MARATHON',
    subtitleText: 'DAY LEADER',
    reductionLabel: 'Weight loss for this day',
    reductionValue: (c) => c.dailyChangeDisplay || c.dailyChange,
    leaderKey:    'dayLeader',
    ribbonBg:     '#fbbf24',
    ribbonText:   '#78350f',
  },
  lap_leader: {
    bgGradient:   'linear-gradient(160deg, #059669 0%, #047857 40%, #064e3b 100%)',
    glow:         'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(52,211,153,0.40) 0%, transparent 70%)',
    accentColor:  '#34d399',
    metricColor:  '#064e3b',
    badgeColor:   '#d1fae5',
    badgeText:    '#065f46',
    titleText:    'MARATHON',
    subtitleText: 'LAP LEADER',
    reductionLabel: 'Weight loss for this lap',
    reductionValue: (c) => c.lapChangeDisplay || c.lapChange,
    leaderKey:    'lapLeader',
    ribbonBg:     '#34d399',
    ribbonText:   '#064e3b',
  },
  community_leader: {
    bgGradient:   'linear-gradient(160deg, #7c3aed 0%, #6d28d9 40%, #4c1d95 100%)',
    glow:         'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(167,139,250,0.40) 0%, transparent 70%)',
    accentColor:  '#a78bfa',
    metricColor:  '#2e1065',
    badgeColor:   '#ede9fe',
    badgeText:    '#4c1d95',
    titleText:    'MARATHON',
    subtitleText: 'COMMUNITY LEADER',
    reductionLabel: 'Total marathon reduction',
    reductionValue: (c) => c.lapChangeDisplay || c.lapChange,
    leaderKey:    'lapLeader',
    ribbonBg:     '#a78bfa',
    ribbonText:   '#2e1065',
  },
};

const CARD_W = 400;

// ── SVG crown (Lap / Community) ──────────────────────────────────────────────
const CrownSvg = ({ color = '#fbbf24', size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <polygon
      points="6,36 10,20 16,28 22,14 28,28 34,20 38,36"
      fill={color}
      stroke="white"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <rect x="6" y="36" width="32" height="5" rx="2.5" fill={color} stroke="white" strokeWidth="1.5"/>
    <circle cx="6"  cy="20" r="3.5" fill={color} stroke="white" strokeWidth="1.5"/>
    <circle cx="22" cy="14" r="3.5" fill={color} stroke="white" strokeWidth="1.5"/>
    <circle cx="38" cy="20" r="3.5" fill={color} stroke="white" strokeWidth="1.5"/>
  </svg>
);

// ── SVG medal (Day) ──────────────────────────────────────────────────────────
const MedalSvg = ({ color = '#fbbf24', size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <circle cx="22" cy="27" r="14" fill={color} stroke="white" strokeWidth="2.5"/>
    <polygon
      points="22,20 24,25 30,25 25,28 27,34 22,31 17,34 19,28 14,25 20,25"
      fill="white"
      opacity="0.9"
    />
    {/* Ribbon */}
    <polygon points="14,4 20,14 22,10 24,14 30,4 26,14 22,18 18,14" fill={color} opacity="0.85"/>
    <polygon points="20,4 22,9 24,4"  fill="white" opacity="0.6"/>
  </svg>
);

// ── Celebration ray burst ────────────────────────────────────────────────────
const RayBurst = ({ color = 'rgba(255,255,255,0.12)', size = 300 }) => {
  const rays = Array.from({ length: 16 }, (_, i) => i);
  const cx = size / 2, cy = size / 2, inner = size * 0.2, outer = size * 0.5;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {rays.map(i => {
        const angle = (i * 360) / 16;
        const rad   = (angle * Math.PI) / 180;
        const rad2  = ((angle + 11.25) * Math.PI) / 180;
        const x1    = cx + inner * Math.cos(rad);
        const y1    = cy + inner * Math.sin(rad);
        const x2    = cx + outer * Math.cos(rad);
        const y2    = cy + outer * Math.sin(rad);
        const x3    = cx + outer * Math.cos(rad2);
        const y3    = cy + outer * Math.sin(rad2);
        const x4    = cx + inner * Math.cos(rad2);
        const y4    = cy + inner * Math.sin(rad2);
        return (
          <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
            fill={color} />
        );
      })}
    </svg>
  );
};

// ── Placeholder avatar when ProfileImage is null ─────────────────────────────
const InitialAvatar = ({ name = '?', size = 160, bg = '#ffffff22', fg = '#fff' }) => {
  const initial = String(name).trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 900, color: fg,
      flexShrink: 0,
    }}>
      {initial}
    </div>
  );
};

// ── Main card component ───────────────────────────────────────────────────────

/**
 * @param {{
 *   card: {
 *     cardType: string,
 *     marathonName?: string,
 *     lapNumber: number,
 *     dayNumber: number,
 *     dayLeader?: object,
 *     lapLeader?: object,
 *   }
 *   fullScreen?: boolean  — when true, fills its container instead of using CARD_W
 * }} props
 */
const MarathonLeaderCard = ({ card, fullScreen = false }) => {
  if (!card) return null;

  const { cardType = 'day_leader', marathonName, lapNumber, dayNumber } = card;
  const theme  = THEMES[cardType] || THEMES.day_leader;
  const leader = card[theme.leaderKey];

  const reductionVal = leader ? (theme.reductionValue(leader) || '—') : null;

  // ── No-leader state: results not yet available ──────────────────────────
  if (!leader) {
    return (
      <div style={{
        width: CARD_W,
        minHeight: 580,
        background: theme.bgGradient,
        borderRadius: 28,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '40px 24px',
      }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: '#fff',
          textAlign: 'center', letterSpacing: 1,
        }}>
          Results Pending
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(255,255,255,0.75)',
          textAlign: 'center', lineHeight: 1.5, maxWidth: 280,
        }}>
          {card.marathonName || 'Wellness Valley Marathon'}
        </div>
        {card.lapNumber && card.dayNumber && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 100, padding: '6px 18px',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>
            Lap {card.lapNumber} · Day {card.dayNumber}
          </div>
        )}
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.55)',
          textAlign: 'center', marginTop: 8,
        }}>
          Results are available after the discipline window closes
        </div>
      </div>
    );
  }

  const photoSize = fullScreen ? 190 : 176;

  return (
    <div style={{
      ...(fullScreen
        ? { width: '100%', flex: 1, borderRadius: 0, display: 'flex', flexDirection: 'column' }
        : { width: CARD_W, minHeight: 580, borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }
      ),
      background: theme.bgGradient,
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif',
      position: 'relative',
    }}>

      {/* ── Background glow ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.glow,
        pointerEvents: 'none',
      }} />

      {/* ── Title section ── */}
      <div style={{
        position: 'relative',
        paddingTop: fullScreen ? 14 : 36,
        textAlign: 'center',
        zIndex: 2,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
          letterSpacing: 4, textTransform: 'uppercase', marginBottom: 2,
        }}>
          {theme.titleText}
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, color: '#ffffff',
          letterSpacing: 3, textTransform: 'uppercase',
          textShadow: '0 2px 12px rgba(0,0,0,0.25)',
          lineHeight: 1.1,
        }}>
          {theme.subtitleText}
        </div>
      </div>

      {/* ── Hero photo section ── */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        marginTop: 28,
        zIndex: 2,
      }}>
        {/* Ray burst behind photo */}
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)' }}>
          <RayBurst color="rgba(255,255,255,0.10)" size={fullScreen ? 340 : 280} />
        </div>

        {/* Photo container */}
        <div style={{ position: 'relative', zIndex: 3 }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute', inset: -8,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.accentColor}60 0%, transparent 70%)`,
          }} />

          {/* White border ring */}
          <div style={{
            width: photoSize, height: photoSize,
            borderRadius: '50%',
            border: '5px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            position: 'relative',
            background: '#e5e7eb',
          }}>
            {leader?.profileImage ? (
              <img
                src={leader.profileImage}
                alt={leader.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                crossOrigin="anonymous"
              />
            ) : (
              <InitialAvatar name={leader?.name} size={photoSize - 10} bg={theme.accentColor + '66'} fg="#fff" />
            )}
          </div>
        </div>
      </div>

      {/* ── Info card ── */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        ...(fullScreen
          ? { flex: 1, margin: '16px 16px 0', borderRadius: '22px 22px 0 0', padding: '22px 24px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }
          : { margin: '24px 20px 24px', borderRadius: 20, padding: '22px 24px 24px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }
        ),
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
      }}>

        {/* Name */}
        <div style={{
          fontSize: 28, fontWeight: 900,
          color: '#111827',
          textAlign: 'center',
          letterSpacing: -0.5,
          marginBottom: 4,
        }}>
          {leader?.name || '—'}
        </div>

        {/* Team name */}
        <div style={{
          fontSize: 14, fontWeight: 600, color: '#6b7280',
          textAlign: 'center', marginBottom: 6,
        }}>
          {card.marathonName || 'Wellness Valley Marathon'}
        </div>

        {/* Lap + Day badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <span style={{
            background: theme.badgeColor,
            color: theme.badgeText,
            fontSize: 13, fontWeight: 700,
            borderRadius: 100, padding: '4px 14px',
            letterSpacing: 0.3,
          }}>
            Lap {lapNumber}  ·  Day {dayNumber}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f3f4f6', marginBottom: 18 }} />

        {/* Reduction metric — flex:1 in fullScreen so it fills remaining height */}
        <div style={{ textAlign: 'center', ...(fullScreen ? { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } : {}) }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6,
          }}>
            {theme.reductionLabel}
          </div>
          <div style={{
            fontSize: fullScreen ? 52 : 42, fontWeight: 900,
            color: theme.metricColor,
            letterSpacing: -1,
            lineHeight: 1,
          }}>
            {reductionVal || '—'}
          </div>
        </div>

        {/* Watermark lives inside the white sheet in fullScreen mode */}
        {fullScreen && (
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#d1d5db',
            letterSpacing: 2.5, textTransform: 'uppercase',
            paddingBottom: 14, paddingTop: 10,
          }}>
            Wellness Valley
          </div>
        )}
      </div>

      {/* ── Footer watermark (share-card mode only) ── */}
      {!fullScreen && (
        <div style={{
          position: 'relative', zIndex: 2,
          textAlign: 'center',
          paddingBottom: 20,
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>
          Wellness Valley
        </div>
      )}
    </div>
  );
};

export default MarathonLeaderCard;
