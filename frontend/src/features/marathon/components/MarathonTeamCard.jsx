/**
 * MarathonTeamCard.jsx — Premium fitness-challenge recognition poster.
 * v6: Recognition-first redesign.
 *     - No legend (badges on photos are self-explanatory)
 *     - Weight result is the dominant per-member element (more visible than name)
 *     - Day Leader = gold ring/glow/pill + 👑; Lap Leader = blue ring/glow/pill + 👕
 *     - Role badges only: C / AC / 🔗 (direct) / ⭐ (deep downline)
 *     - Big "TEAM DAILY RESULT" hero footer
 *     - Compact, photo-forward cells (less white space, larger photos)
 * Pure render — no hooks, no API calls.
 */
import React from "react";

const CARD_W = 480;
const PHOTO_SIZE = 78;
const TEAM_BG =
  "linear-gradient(160deg, #064e3b 0%, #0f766e 38%, #0e7490 72%, #0891b2 100%)";

// ── Leader theming tokens ──────────────────────────────────────────────────
const GOLD = {
  ring: "#f59e0b",
  glow: "0 0 0 3px #fbbf24, 0 6px 20px rgba(245,158,11,0.55)",
  pillBg: "linear-gradient(135deg, #fbbf24, #f59e0b)",
  pillSh: "0 3px 10px rgba(245,158,11,0.6)",
};
const BLUE = {
  ring: "#2563eb",
  glow: "0 0 0 3px #3b82f6, 0 6px 20px rgba(37,99,235,0.50)",
  pillBg: "linear-gradient(135deg, #3b82f6, #2563eb)",
  pillSh: "0 3px 10px rgba(37,99,235,0.5)",
};

// Corner emoji badge (👑 day leader / 👕 lap leader)
const LeaderBadge = ({ emoji, bg, shadow }) => (
  <div
    style={{
      position: "absolute",
      top: -7,
      right: -7,
      zIndex: 12,
      background: bg,
      borderRadius: "50%",
      width: 26,
      height: 26,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: shadow,
      fontSize: 15,
      lineHeight: 1,
      border: "2px solid #fff",
    }}
  >
    {emoji}
  </div>
);

// Role badge — top-left; every participant gets one. Small + elegant.
// Role badge: C (captain) | AC (assistant captain) | ⭐ (AC's direct-report member) | nothing.
// Never uses systemRole or hierarchyRole — uses isAssistantCaptainDownline flag from backend.
const RoleBadge = ({ lapRole, isAssistantCaptainDownline }) => {
  if (lapRole === 'captain') {
    return (
      <div style={{ position: 'absolute', top: -6, left: -6, zIndex: 12,
        background: '#059669', color: '#fff', minWidth: 18, height: 18,
        padding: '0 4px', boxSizing: 'border-box', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 900, borderRadius: 6, lineHeight: 1,
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: '1.5px solid #fff' }}>C</div>
    );
  }
  if (lapRole === 'assistant_captain') {
    return (
      <div style={{ position: 'absolute', top: -6, left: -6, zIndex: 12,
        background: '#0891b2', color: '#fff', minWidth: 18, height: 18,
        padding: '0 4px', boxSizing: 'border-box', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 900, borderRadius: 6, lineHeight: 1,
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)', border: '1.5px solid #fff' }}>AC</div>
    );
  }
  if (isAssistantCaptainDownline) {
    // Plain gold star — no background, no border, no shadow
    return (
      <div style={{ position: 'absolute', top: -6, left: -6, zIndex: 12,
        fontSize: 13, lineHeight: 1 }}>⭐</div>
    );
  }
  return null;
};

/**
 * Format an integer grams value for display.
 *   < 1000g  → "▼ 250g"  / "▲ 300g"  / "▬ 0g"
 *   ≥ 1000g  → "▼ 1.25kg" / "▲ 1.50kg"
 *   null     → "--"
 */
function formatGrams(grams) {
  if (grams == null) return '--';
  if (grams === 0)   return '▬ 0g';
  const abs  = Math.abs(grams);
  const sign = grams < 0 ? '▼' : '▲';
  return abs >= 1000
    ? `${sign} ${(abs / 1000).toFixed(2)}kg`
    : `${sign} ${abs}g`;
}

// Weight result pill — the dominant per-member element.
// variant: 'day' (gold) | 'lap' (blue) | null (computed from grams)
const ResultPill = ({ dailyGrams, dailyChange, variant }) => {
  const grams =
    dailyGrams != null
      ? dailyGrams
      : dailyChange != null
      ? Math.round(dailyChange * 1000)
      : null;

  const display =
    grams == null
      ? "—"
      : grams > 0
      ? `+${grams}g`
      : grams === 0
      ? "0g"
      : `${grams}g`;

  let style;
  if (variant === "day") {
    style = { background: GOLD.pillBg, color: "#fff", boxShadow: GOLD.pillSh };
  } else if (variant === "lap") {
    style = { background: BLUE.pillBg, color: "#fff", boxShadow: BLUE.pillSh };
  } else if (grams == null) {
    style = { background: "#f3f4f6", color: "#9ca3af" };
  } else if (grams < 0) {
    style = { background: "#dcfce7", color: "#15803d" }; // reduced → green
  } else if (grams > 0) {
    style = { background: "#ffedd5", color: "#c2410c" }; // increased → orange
  } else {
    style = { background: "#f3f4f6", color: "#6b7280" }; // no change → gray
  }

  return (
    <div
      style={{
        marginTop: 7,
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: -0.3,
        borderRadius: 20,
        padding: "3px 11px",
        lineHeight: 1.25,
        ...style,
      }}
    >
      {display}
    </div>
  );
};

// Initials avatar fallback
const InitialAvatar = ({ name, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "linear-gradient(135deg, #0d9488, #0891b2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.4,
      fontWeight: 900,
      color: "#fff",
      flexShrink: 0,
    }}
  >
    {String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase()}
  </div>
);

// Single member cell — photo-forward, compact, result-first.
const MemberCell = ({ member, isDayLeader, isLapLeader }) => {
  const {
    name, profileImage, role, isAssistantCaptainDownline,
    dailyGrams, dailyChange, dayChange, lapGrams,
  } = member;

  // Defensive fallback chain:
  // 1. dailyGrams   — pre-computed integer grams (primary)
  // 2. dailyChange  — kg float alias for dayChange (backward-compat field)
  // 3. dayChange    — raw daily kg change (same value, defensive alias check)
  // 4. lapGrams     — change vs. enrollment baseline; used when prevClosingWeight
  //                   is null (Day 1 or missed yesterday) so the cell never shows "--"
  //                   for a member who has a valid weight today.
  const grams =
    dailyGrams != null
      ? Number(dailyGrams)
      : dailyChange != null
      ? Math.round(Number(dailyChange) * 1000)
      : dayChange != null
      ? Math.round(Number(dayChange) * 1000)
      : lapGrams != null
      ? Number(lapGrams)
      : null;

  const isLoss = grams != null && grams < 0;
  const isGain = grams != null && grams > 0;

  // formatGrams handles g↔kg conversion at the ±1000g boundary
  const weightText = formatGrams(grams);

  const weightColor =
  grams == null
      ? "#9ca3af"
      : isLoss
      ? "#16a34a"
      : isGain
      ? "#ea580c"
      : "#6b7280";

  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        borderRadius: 18,
        minHeight: 180,
        position: "relative",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
        boxShadow: isDayLeader
          ? "0 0 0 3px #fbbf24"
          : isLapLeader
          ? "0 0 0 3px #3b82f6"
          : "0 2px 8px rgba(0,0,0,.12)",
      }}
    >
      {/* Left Badge */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
        }}
      >
        <RoleBadge lapRole={role} isAssistantCaptainDownline={isAssistantCaptainDownline} />
      </div>

      {/* Right Badge */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          fontSize: 18,
        }}
      >
        {isDayLeader ? "👑" : isLapLeader ? "👕" : ""}
      </div>

      {/* Photo */}
      <div
        style={{
          marginTop: 8,
          width: 82,
          height: 82,
          borderRadius: "50%",
          overflow: "hidden",
          border: isDayLeader
            ? "4px solid #fbbf24"
            : isLapLeader
            ? "4px solid #3b82f6"
            : "2px solid #e5e7eb",
        }}
      >
        {profileImage ? (
          <img
            src={profileImage}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <InitialAvatar name={name} size={82} />
        )}
      </div>

      {/* Weight Result */}
      <div
        style={{
          marginTop: 12,
          fontSize: 20,
          fontWeight: 900,
          color: weightColor,
          lineHeight: 1,
        }}
      >
        {weightText}
      </div>

      {/* Name */}
      <div
        style={{
          marginTop: 10,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.2,
          height: 30,
          overflow: "hidden",
        }}
      >
        {name}
      </div>
    </div>
  );
};

// Empty slot placeholder
const EmptyCell = () => (
  <div
    style={{
      flex: "1 1 0",
      borderRadius: 14,
      minHeight: 132,
      background: "rgba(255,255,255,0.06)",
      border: "1px dashed rgba(255,255,255,0.20)",
    }}
  />
);

// Main card component
const MarathonTeamCard = ({ card }) => {
  if (!card) return null;
  const {
    marathonName,
    teamName,
    lapNumber,
    dayNumber,
    participants = [],
    dayLeader,
    lapLeader,
    teamDailyTotalDisplay,
    teamDailyTotal,
  } = card;

  const displayName = teamName || marathonName || "Team";

  // Enforce slot order: captain=0, members=1-7, AC=8
  const captain = participants.filter((p) => p.role === "captain");
  const ac = participants.filter((p) => p.role === "assistant_captain");
  const members = participants.filter(
    (p) => p.role !== "captain" && p.role !== "assistant_captain",
  );
  const ordered = [...captain, ...members, ...ac];
  while (ordered.length < 9) ordered.push(null);
  const grid = [ordered.slice(0, 3), ordered.slice(3, 6), ordered.slice(6, 9)];

  const isTeamLoss = teamDailyTotal != null && teamDailyTotal <= 0;

  return (
    <div
      style={{
        width: CARD_W,
        background: TEAM_BG,
        borderRadius: 26,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: "0 24px 70px rgba(0,0,0,0.40)",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Soft top highlight for depth */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 180,
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Header ── */}
      <div
        style={{
          position: "relative",
          padding: "20px 22px 14px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "rgba(255,255,255,0.66)",
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          Wellness Valley
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: 5,
            textTransform: "uppercase",
            textShadow: "0 3px 14px rgba(0,0,0,0.35)",
            lineHeight: 1.05,
            marginTop: 2,
          }}
        >
          MARATHON
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 10,
            background: "rgba(255,255,255,0.96)",
            color: "#0f766e",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: 0.3,
            borderRadius: 100,
            padding: "6px 22px",
            maxWidth: "92%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.22)",
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 800,
            color: "rgba(255,255,255,0.82)",
            letterSpacing: 1,
          }}
        >
          LAP {lapNumber} <span style={{ opacity: 0.5 }}>•</span> DAY{" "}
          {dayNumber}
        </div>
      </div>

      {/* ── 3x3 grid ── */}
      <div
        style={{
          position: "relative",
          padding: "4px 16px 12px",
          overflow: "visible",
        }}
      >
        {grid.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              gap: 9,
              marginBottom: ri < 2 ? 13 : 0,
              alignItems: "stretch",
            }}
          >
            {row.map((member, ci) =>
              member ? (
                <MemberCell
                  key={member.userId ?? `m-${ri}-${ci}`}
                  member={member}
                  isDayLeader={member.isDayLeader === true}
                  isLapLeader={member.isLapLeader === true}
                />
              ) : (
                <EmptyCell key={`empty-${ri}-${ci}`} />
              ),
            )}
          </div>
        ))}
      </div>

      {/* ── Hero footer: TEAM DAILY RESULT ── */}
      <div
        style={{
          position: "relative",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.45))",
          padding: "16px 20px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "rgba(255,255,255,0.70)",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Team Daily Result
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 46,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -1,
            color: isTeamLoss ? "#34d399" : "#fbbf24",
            textShadow: "0 3px 16px rgba(0,0,0,0.4)",
          }}
        >
          {teamDailyTotal != null
            ? formatGrams(Math.round(teamDailyTotal * 1000))
            : (teamDailyTotalDisplay || "—")}
        </div>
      </div>
    </div>
  );
};

export default MarathonTeamCard;
