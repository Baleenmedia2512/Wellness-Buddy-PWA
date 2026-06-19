/**
 * MarathonDashboard.jsx — Coach-facing Marathon Recognition dashboard.
 *
 * v4 enhancements:
 *  1. Fast participant loading via /api/marathon/participants (targeted BFS queries)
 *  2. Hierarchy-aware selection: downline + coach's upline chain only
 *  3. LAP details view on tap (3×3 grid with live data)
 *  4. Swipe-left to delete LAP (no icon, mobile-native gesture)
 *  5. Profile photos + role + teamId in participant picker
 *  6. 2nd+ LAP skips team name step — auto-fills from existing team
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMarathon }      from '../hooks/useMarathon.js';
import MarathonShareSheet   from './MarathonShareSheet.jsx';
import { createMarathon, deleteMarathon, getMarathonParticipants, getCardData } from '../services/marathon.api.js';

// ── Constants ──────────────────────────────────────────────────────────────
const CARD_TYPES = [
  { type: 'team',       emoji: '👥', label: 'Team Card',   desc: 'Full 9-member grid' },
  { type: 'day_leader', emoji: '🌟', label: 'Day Leader',  desc: "Today's top performer" },
  { type: 'lap_leader', emoji: '👑', label: 'Lap Leader',  desc: 'Best this lap' },
];

const ROLE_OPTIONS = [
  { value: 'member',            label: 'Member' },
  { value: 'assistant_captain', label: 'Asst. Captain' },
];

const LAP_SIZE = 8; // members selected by coach (+ 1 auto-captain = 9 total)

// ── Date formatter ────────────────────────────────────────────────────────────
function formatLapDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).substring(0, 10);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── App theme tokens (matches App.js / Tailwind palette) ──────────────────
const T = {
  green:      '#16a34a',
  greenLight: '#dcfce7',
  greenBg:    '#f0fdf4',
  greenBorder:'#bbf7d0',
  red:        '#dc2626',
  redBg:      '#fef2f2',
  redBorder:  '#fecaca',
  gray50:     '#f9fafb',
  gray100:    '#f3f4f6',
  gray200:    '#e5e7eb',
  gray400:    '#9ca3af',
  gray600:    '#4b5563',
  gray800:    '#1f2937',
  white:      '#ffffff',
  blue:       '#0891b2',
  blueBg:     '#e0f2fe',
  purple:     '#7c3aed',
  purpleBg:   '#ede9fe',
};

// ── Load participant candidates via new fast endpoint ─────────────────────
async function loadParticipantCandidates(coachId) {
  const res  = await getMarathonParticipants({ coachId, role: 'coach' });
  const list = Array.isArray(res.data) ? res.data : [];
  return list;
}
    .map(m => ({
      userId:  m.UserId,
      name:    m.UserName    || 'Member',
      photo:   m.ProfileImage || null,
      phone:   m.PhoneNumber  || '',  // for search
      teamId:  m.TeamId       || '',  // for search
    }));
}

// ── Role validation ─────────────────────────────────────────────────────────
function validateRoles(participants) {
  const assistants = participants.filter(p => p.role === 'assistant_captain');
  if (assistants.length > 1) return 'Only 1 Asst. Captain allowed';
  return null;
}

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ photo, name, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    overflow: 'hidden', border: `1.5px solid ${T.gray200}`, background: T.gray100,
  }}>
    {photo ? (
      <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${T.green}, #0891b2)`,
        fontSize: size * 0.38, fontWeight: 900, color: T.white,
      }}>
        {String(name || '?').charAt(0).toUpperCase()}
      </div>
    )}
  </div>
);

// ── Role badge chip ──────────────────────────────────────────────────────────
const RoleChip = ({ role, isUpline }) => {
  if (isUpline) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
        background: T.purpleBg, color: T.purple,
      }}>Upline</span>
    );
  }
  if (role === 'coach') {
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
        background: T.blueBg, color: T.blue,
      }}>Coach</span>
    );
  }
  return null;
};

// ── Participant row (picker) ────────────────────────────────────────────────
const ParticipantRow = ({ member, selected, lapRole, onToggle, onRoleChange, disabled }) => (
  <div
    onClick={() => !disabled && onToggle(member.userId)}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10, marginBottom: 6,
      border: `1.5px solid ${selected ? T.green : T.gray200}`,
      background: selected ? T.greenBg : T.white,
      cursor: disabled && !selected ? 'not-allowed' : 'pointer',
      opacity: disabled && !selected ? 0.45 : 1,
    }}
  >
    <Avatar photo={member.photo} name={member.name} size={40} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: T.gray800,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {member.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
        {member.teamId && (
          <span style={{ fontSize: 10, color: T.gray400 }}>#{member.teamId}</span>
        )}
        <RoleChip role={member.role} isUpline={member.isUpline} />
      </div>
    </div>
    {selected && (
      <select
        value={lapRole}
        onClick={e => e.stopPropagation()}
        onChange={e => { e.stopPropagation(); onRoleChange(member.userId, e.target.value); }}
        style={{
          fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '4px 6px',
          border: `1px solid ${T.greenBorder}`, background: T.greenLight,
          color: '#065f46', cursor: 'pointer', flexShrink: 0,
        }}
      >
        {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )}
    <div style={{
      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
      border: selected ? 'none' : `2px solid ${T.gray200}`,
      background: selected ? T.green : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {selected && <span style={{ color: T.white, fontSize: 12, fontWeight: 900 }}>✓</span>}
    </div>
  </div>
);

// ── Create wizard ────────────────────────────────────────────────────────────
/**
 * existingTeams: deduplicated array of team name strings from existing marathons.
 * If non-empty, 2nd+ LAP flow is used — skip team name input, show picker instead.
 */
const CreateMarathonWizard = ({ coachId, existingTeams = [], onCreated, onCancel }) => {
  const hasExistingTeams = existingTeams.length > 0;

  // step '1b': new team name entry
  // step '1c': pick existing team (shown first when teams exist)
  // step '2':  participant selection
  const [step,         setStep]         = useState(hasExistingTeams ? '1c' : '1b');
  const [teamName,     setTeamName]     = useState('');
  const [startedAt,    setStartedAt]    = useState(new Date().toISOString().substring(0, 10));
  const [members,      setMembers]      = useState([]);
  const [loadingMbrs,  setLoadingMbrs]  = useState(false);
  const [membersErr,   setMembersErr]   = useState(null);
  const [roleMap,      setRoleMap]      = useState({});
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState(null);
  const [memberSearch, setMemberSearch] = useState('');

  const selectedIds  = Object.keys(roleMap).map(Number);
  const participants = selectedIds.map(uid => ({ userId: uid, role: roleMap[uid] || 'member' }));
  const atMax        = selectedIds.length >= LAP_SIZE;
  const roleError    = validateRoles(participants);

  // Compute next lap sequence for a given team name
  const nextLapFor = (tn) => existingTeams.filter(t => t === tn).length + 1;
  const lapPreview = teamName.trim() ? `${teamName.trim()} - LAP ${nextLapFor(teamName.trim())}` : '';

  const loadMembers = useCallback(async () => {
    setLoadingMbrs(true); setMembersErr(null);
    try {
      const list = await loadParticipantCandidates(coachId);
      setMembers(list);
    } catch (e) {
      setMembersErr(e.message || 'Could not load team members');
    } finally {
      setLoadingMbrs(false);
    }
  }, [coachId]);

  const goToParticipants = useCallback(async (resolvedTeamName) => {
    if (!resolvedTeamName || !resolvedTeamName.trim()) return setErr('Team name is required');
    setTeamName(resolvedTeamName.trim());
    setErr(null);
    setLoadingMbrs(true); setMembersErr(null);
    try {
      const list = await loadParticipantCandidates(coachId);
      setMembers(list);
      setStep('2');
    } catch (e) {
      setMembersErr(e.message || 'Could not load team members');
    } finally {
      setLoadingMbrs(false);
    }
  }, [coachId]);

  const toggleMember = uid => {
    setRoleMap(prev => {
      const next = { ...prev };
      if (next[uid] !== undefined) delete next[uid];
      else if (Object.keys(next).length < LAP_SIZE) next[uid] = 'member';
      return next;
    });
  };

  const changeRole = (uid, role) => setRoleMap(prev => ({ ...prev, [uid]: role }));

  const handleCreate = async () => {
    if (selectedIds.length < LAP_SIZE) return setErr(`Select exactly ${LAP_SIZE} members (you + 8 = 9 total)`);
    if (selectedIds.length > LAP_SIZE) return setErr(`Too many — select exactly ${LAP_SIZE} members`);
    if (roleError) return setErr(roleError);
    setBusy(true); setErr(null);
    try {
      const tn     = teamName.trim();
      const result = await createMarathon({ coachId, name: tn, teamName: tn, totalLaps: 10, daysPerLap: 10, startedAt, participants, role: 'coach' });
      onCreated(result?.data?.marathonId || result?.data?.id || null);
    } catch (e) {
      setErr(e.message || 'Failed to create LAP');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 1b: New team name entry ──────────────────────────────────────────
  if (step === '1b') return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {hasExistingTeams && (
          <button onClick={() => setStep('1c')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.green, fontSize: 14, fontWeight: 700, padding: '0 8px 0 0',
          }}>←</button>
        )}
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.gray800 }}>
          New Team
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.gray600,
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Team Name *
        </label>
        <input
          value={teamName}
          onChange={e => { setTeamName(e.target.value); setErr(null); }}
          placeholder="e.g. Power Burners"
          autoFocus
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: `1.5px solid ${T.gray200}`, fontSize: 14,
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        {lapPreview && (
          <div style={{
            marginTop: 6, fontSize: 12, color: T.green, fontWeight: 600,
            background: T.greenBg, borderRadius: 6, padding: '6px 10px',
            border: `1px solid ${T.greenBorder}`,
          }}>
            LAP name will be: <strong>{lapPreview}</strong>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.gray600,
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Start Date
        </label>
        <input
          type="date"
          value={startedAt}
          onChange={e => setStartedAt(e.target.value)}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: `1.5px solid ${T.gray200}`, fontSize: 14,
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
      </div>

      {(err || membersErr) && (
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginBottom: 12 }}>
          {err || membersErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '12px', borderRadius: 10,
          border: `1.5px solid ${T.gray200}`, background: T.white,
          fontSize: 14, fontWeight: 600, color: T.gray600, cursor: 'pointer',
        }}>Cancel</button>
        <button
          onClick={() => goToParticipants(teamName)}
          disabled={loadingMbrs || !teamName.trim()}
          style={{
            flex: 2, padding: '12px', borderRadius: 10,
            background: T.green, color: T.white, fontSize: 14, fontWeight: 700,
            border: 'none', cursor: loadingMbrs || !teamName.trim() ? 'not-allowed' : 'pointer',
            opacity: !teamName.trim() ? 0.5 : 1,
          }}
        >
          {loadingMbrs ? 'Loading…' : 'Next: Pick 8 Members →'}
        </button>
      </div>
    </div>
  );

  // ── Step 1c: Existing team picker (2nd+ LAP) ──────────────────────────────
  if (step === '1c') return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.gray800, marginBottom: 4 }}>
        New LAP
      </div>
      <div style={{ fontSize: 12, color: T.gray400, marginBottom: 16 }}>
        Pick an existing team or create a new one.
      </div>

      {[...new Set(existingTeams)].map(tn => {
        const nextLap = nextLapFor(tn);
        return (
          <button
            key={tn}
            onClick={() => goToParticipants(tn)}
            disabled={loadingMbrs}
            style={{
              width: '100%', marginBottom: 8, padding: '12px 16px',
              borderRadius: 12, border: `1.5px solid ${T.greenBorder}`,
              background: T.greenBg, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: loadingMbrs ? 0.6 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.gray800 }}>{tn}</div>
              <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: 2 }}>
                → Will create: {tn} - LAP {nextLap}
              </div>
            </div>
            <span style={{ fontSize: 18, color: T.green }}>{loadingMbrs ? '⏳' : '›'}</span>
          </button>
        );
      })}

      <button
        onClick={() => setStep('1b')}
        style={{
          width: '100%', marginBottom: 8, padding: '12px 16px',
          borderRadius: 12, border: `1.5px dashed ${T.gray200}`,
          background: T.white, cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: T.gray600 }}>
          + Create a new team
        </div>
        <span style={{ fontSize: 18, color: T.gray400 }}>›</span>
      </button>

      {(err || membersErr) && (
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginTop: 8 }}>
          {err || membersErr}
        </div>
      )}

      <button onClick={onCancel} style={{
        width: '100%', marginTop: 4, padding: '11px', borderRadius: 10,
        border: `1.5px solid ${T.gray200}`, background: T.white,
        fontSize: 14, fontWeight: 600, color: T.gray600, cursor: 'pointer',
      }}>Cancel</button>
    </div>
  );

  // ── Step 2: Participant selection ─────────────────────────────────────────
  const remaining       = LAP_SIZE - selectedIds.length;
  const searchLower     = memberSearch.toLowerCase().trim();
  const filteredMembers = searchLower
    ? members.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        String(m.teamId || '').includes(searchLower) ||
        String(m.phone  || '').includes(searchLower)
      )
    : members;

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setStep(hasExistingTeams ? '1c' : '1b')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.green, fontSize: 14, fontWeight: 700, padding: '0 8px 0 0',
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.gray800 }}>Pick 8 Members</div>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>
            {teamName} - LAP {nextLapFor(teamName)}
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800,
          color: selectedIds.length === LAP_SIZE ? T.green : T.gray400,
          background: selectedIds.length === LAP_SIZE ? T.greenLight : T.gray100,
          borderRadius: 100, padding: '3px 10px',
        }}>
          {selectedIds.length}/{LAP_SIZE}
        </span>
      </div>

      <div style={{
        fontSize: 12, color: T.gray600, marginBottom: 10,
        background: T.greenBg, borderRadius: 8, padding: '8px 10px',
        border: `1px solid ${T.greenBorder}`, lineHeight: 1.4,
      }}>
        You are auto-added as <strong>Captain</strong>.
        {remaining > 0
          ? ` Select ${remaining} more member${remaining > 1 ? 's' : ''}.`
          : ' All 8 selected — ready to create!'}
        {' '}Optionally set one as <strong>Asst. Captain</strong>.
      </div>

      {members.length === 0 && !loadingMbrs ? (
        <div style={{ textAlign: 'center', color: T.gray400, padding: '20px 0', fontSize: 13 }}>
          No eligible participants found. Ensure your team has members.
        </div>
      ) : loadingMbrs ? (
        <div style={{ textAlign: 'center', color: T.gray400, padding: '20px 0', fontSize: 13 }}>
          Loading participants…
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: T.gray400, pointerEvents: 'none',
            }}>🔍</span>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search by name, mobile or team ID…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 30px 8px 30px', borderRadius: 8,
                border: `1.5px solid ${memberSearch ? T.green : T.gray200}`,
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
              }}
            />
            {memberSearch && (
              <button onClick={() => setMemberSearch('')} style={{
                position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.gray400, fontSize: 12, padding: '2px 3px',
              }}>✕</button>
            )}
          </div>

          {filteredMembers.length === 0 && memberSearch && (
            <div style={{ textAlign: 'center', color: T.gray400, fontSize: 12, padding: '8px 0' }}>
              No results for "{memberSearch}"
            </div>
          )}

          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
            {filteredMembers.map(m => (
              <ParticipantRow
                key={m.userId}
                member={m}
                selected={roleMap[m.userId] !== undefined}
                lapRole={roleMap[m.userId] || 'member'}
                onToggle={toggleMember}
                onRoleChange={changeRole}
                disabled={atMax && roleMap[m.userId] === undefined}
              />
            ))}
          </div>
        </>
      )}

      {err && (
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginBottom: 10 }}>
          {err}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={busy || selectedIds.length !== LAP_SIZE}
        style={{
          width: '100%', padding: '13px', borderRadius: 10,
          background: selectedIds.length === LAP_SIZE ? T.green : T.gray200,
          color: selectedIds.length === LAP_SIZE ? T.white : T.gray400,
          fontSize: 14, fontWeight: 700, border: 'none',
          cursor: selectedIds.length !== LAP_SIZE || busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Creating…' : `Create LAP (${selectedIds.length + 1} participants)`}
      </button>
    </div>
  );
};

// ── LAP list item — swipe-left to delete, tap to open details ─────────────
const LapListItem = ({ marathon, isSelected, onSelect, onOpenDetails, onDeleteSwipe, deleting }) => {
  const touchStartXRef = useRef(null);

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (delta < -60) {
      // swiped left ≥ 60px → trigger delete confirmation
      onDeleteSwipe(marathon.id);
    }
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: isSelected ? T.greenBg : T.white,
        border: `1.5px solid ${isSelected ? T.green : T.gray200}`,
        borderRadius: 12, marginBottom: 8,
        cursor: 'pointer',
        userSelect: 'none',
        opacity: deleting ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
      onClick={() => { onSelect(marathon.id); onOpenDetails(marathon.id); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isSelected ? T.green : T.gray100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, marginTop: 2,
      }}>
        🏃
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.gray800,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {marathon.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
          {marathon.lap_sequence && (
            <span style={{
              fontSize: 10, fontWeight: 800,
              color: isSelected ? T.green : T.gray600,
              background: isSelected ? T.greenLight : T.gray100,
              borderRadius: 4, padding: '1px 6px', lineHeight: 1.5,
            }}>LAP {marathon.lap_sequence}</span>
          )}
          <span style={{ fontSize: 11, color: T.gray400, lineHeight: 1.3 }}>
            {marathon.days_per_lap} days · {formatLapDate(marathon.started_at)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
        {isSelected && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.green,
            background: T.greenLight, borderRadius: 100, padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}>Active</span>
        )}
        {/* No delete icon — use swipe left to delete */}
        <span style={{ fontSize: 18, color: T.gray400 }}>›</span>
      </div>
    </div>
  );
};

// ── Delete confirmation bottom sheet ─────────────────────────────────────────
const DeleteConfirmModal = ({ onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom, 0)',
  }}
    onClick={onCancel}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0))',
        width: '100%', maxWidth: 480, boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>
        Delete this LAP?
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
        Tip: Swipe left on any LAP card to delete it.
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        This will cancel the marathon permanently and cannot be undone.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '12px', borderRadius: 10,
          border: '1.5px solid #e5e7eb', background: '#fff',
          fontSize: 14, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: '12px', borderRadius: 10,
          border: 'none', background: '#dc2626',
          fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
        }}>Delete LAP</button>
      </div>
    </div>
  </div>
);

// ── LAP Details Modal ─────────────────────────────────────────────────────────
const DISCIPLINE_STATUS_MAP = {
  eligible:  { icon: '🟢', label: 'Disciplined', color: '#059669' },
  missed:    { icon: '🔴', label: 'Missed',       color: '#dc2626' },
  no_upload: { icon: '⚪', label: 'No upload',    color: '#9ca3af' },
};

const ROLE_BADGE_MAP = {
  captain:           { label: 'C',  bg: '#059669', color: '#fff' },
  assistant_captain: { label: 'AC', bg: '#0891b2', color: '#fff' },
  member:            { label: null, bg: 'transparent', color: 'transparent' },
};

const DetailCell = ({ member }) => {
  const { name, profileImage, role, dailyGrams, disciplineStatus } = member;
  const ds = DISCIPLINE_STATUS_MAP[disciplineStatus] || DISCIPLINE_STATUS_MAP.no_upload;
  const rb = ROLE_BADGE_MAP[role]                    || ROLE_BADGE_MAP.member;
  const isLoss = dailyGrams != null && dailyGrams < 0;
  const isGain = dailyGrams != null && dailyGrams > 0;
  const gramsDisplay = dailyGrams == null ? '—'
    : isLoss ? `${(dailyGrams / 1000).toFixed(2)} kg`
    : isGain ? `+${(dailyGrams / 1000).toFixed(2)} kg`
    : '0 kg';

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
      padding: '8px 6px 10px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, position: 'relative',
    }}>
      {rb.label && (
        <div style={{
          position: 'absolute', top: 4, left: 4,
          background: rb.bg, color: rb.color,
          fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 4px',
        }}>{rb.label}</div>
      )}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        overflow: 'hidden', border: '2px solid #e5e7eb',
        background: '#f3f4f6', flexShrink: 0,
      }}>
        {profileImage ? (
          <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#059669,#0891b2)',
            fontSize: 20, fontWeight: 900, color: '#fff',
          }}>{String(name || '?').charAt(0).toUpperCase()}</div>
        )}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#111827', textAlign: 'center',
        width: '100%', padding: '0 4px', boxSizing: 'border-box',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
      <span style={{
        fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 6px',
        background: isLoss ? '#dcfce7' : isGain ? '#fef3c7' : '#f3f4f6',
        color:      isLoss ? '#15803d' : isGain ? '#92400e' : '#6b7280',
      }}>{gramsDisplay}</span>
      <div style={{ fontSize: 10, color: ds.color, fontWeight: 600 }}>
        {ds.icon} {ds.label}
      </div>
    </div>
  );
};

const LapDetailsModal = ({ marathonId, coachId: cId, marathonName, onClose }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    getCardData({ marathonId, cardType: 'team', coachId: cId })
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(e  => { if (!cancelled) setErr(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [marathonId, cId]);

  const participants = data?.participants || [];
  const slots = [...participants];
  while (slots.length < 9) slots.push(null);
  const grid = [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];

  const teamTotal   = data?.teamDailyTotalDisplay || '—';
  const isLossTotal = data?.teamDailyTotal != null && data.teamDailyTotal < 0;
  const isGainTotal = data?.teamDailyTotal != null && data.teamDailyTotal > 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#f9fafb', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480, boxSizing: 'border-box',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '0 0 calc(12px + env(safe-area-inset-bottom, 0))',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#0f766e,#0891b2)',
          padding: '14px 16px 12px', color: '#fff', margin: '0 12px 12px',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
            {data?.marathonName || marathonName}
          </div>
          {data && (
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              Lap {data.lapNumber}  ·  Day {data.dayNumber}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: T.gray400, fontSize: 14 }}>
            Loading participants…
          </div>
        )}
        {err && (
          <div style={{ margin: '0 12px', background: T.redBg, borderRadius: 12,
            padding: '10px 14px', fontSize: 13, color: T.red }}>
            {err}
          </div>
        )}
        {!loading && !err && (
          <div style={{ padding: '0 12px' }}>
            {grid.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: ri < 2 ? 8 : 0 }}>
                {row.map((m, ci) => (
                  m ? (
                    <div key={m.userId} style={{ flex: 1 }}>
                      <DetailCell member={m} />
                    </div>
                  ) : (
                    <div key={`e${ri}${ci}`} style={{
                      flex: 1, borderRadius: 14, border: '1px dashed #e5e7eb',
                      background: '#fafafa', minHeight: 120,
                    }} />
                  )
                ))}
              </div>
            ))}
            <div style={{
              marginTop: 12, background: '#fff', borderRadius: 12,
              border: '1px solid #f3f4f6',
              padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Team total today</span>
              <span style={{
                fontSize: 16, fontWeight: 900,
                color: isLossTotal ? '#059669' : isGainTotal ? '#d97706' : '#6b7280',
              }}>{teamTotal}</span>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            display: 'block', width: 'calc(100% - 24px)', margin: '12px 12px 0',
            padding: '12px', borderRadius: 10, border: 'none',
            background: T.gray100, fontSize: 14, fontWeight: 600,
            color: T.gray600, cursor: 'pointer',
          }}
        >Close</button>
      </div>
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const MarathonDashboard = ({ coachId }) => {
  const {
    marathons, loadingList, listError, fetchMarathons, removeMarathon,
    cardData, shareUrl, loadingCard, cardError, shareOpen,
    generateCard, closeShare,
  } = useMarathon({ coachId });

  const [selectedId,      setSelectedId]      = useState('');
  const [activeCardType,  setActiveCardType]  = useState(null);
  const [showCreate,      setShowCreate]      = useState(false);
  const [deletingId,      setDeletingId]      = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError,     setDeleteError]     = useState(null);
  const [lapSearch,       setLapSearch]       = useState('');
  const [detailsMarathonId, setDetailsMarathonId] = useState(null);

  useEffect(() => { fetchMarathons('active'); }, [fetchMarathons]);

  useEffect(() => {
    if (marathons.length > 0 && !selectedId) {
      setSelectedId(String(marathons[0].id));
    }
  }, [marathons, selectedId]);

  const handleCreated = (newMarathonId) => {
    setShowCreate(false);
    if (newMarathonId) setSelectedId(String(newMarathonId));
    fetchMarathons('active');
  };

  const handleDeleteConfirmed = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleteError(null);
    setDeletingId(id);
    removeMarathon(Number(id));
    if (String(selectedId) === String(id)) setSelectedId('');
    try {
      await deleteMarathon({ marathonId: id, coachId });
      await fetchMarathons('active');
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete LAP. Please try again.');
      await fetchMarathons('active');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCardTap = type => {
    if (loadingCard || !selectedId) return;
    setActiveCardType(type);
    generateCard({ marathonId: Number(selectedId), cardType: type });
  };

  const handleOpenDetails = (id) => {
    setDetailsMarathonId(id);
  };

  // existingTeams: deduplicated team names from current marathon list
  const existingTeams = [...new Set(marathons.map(m => m.team_name).filter(Boolean))];

  const filteredMarathons = lapSearch.trim()
    ? marathons.filter(m => m.name.toLowerCase().includes(lapSearch.toLowerCase().trim()))
    : marathons;

  const detailsMarathon = detailsMarathonId
    ? marathons.find(m => String(m.id) === String(detailsMarathonId))
    : null;

  return (
    <div style={{
      padding: 'max(12px, env(safe-area-inset-top, 12px)) max(16px, env(safe-area-inset-right, 16px)) calc(40px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 16px))',
      maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.gray800, margin: 0 }}>
          Marathon LAPs
        </h1>
        <p style={{ fontSize: 13, color: T.gray400, margin: '2px 0 0' }}>
          Tap a LAP to view details · swipe left to delete
        </p>
      </div>

      {deleteError && (
        <div style={{
          background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.red, fontSize: 16, fontWeight: 700, lineHeight: 1, padding: 0,
          }}>✕</button>
        </div>
      )}

      {listError && (
        <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginBottom: 12 }}>
          {listError}
        </div>
      )}

      {loadingList && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: T.gray400, fontSize: 14 }}>
          Loading…
        </div>
      )}

      {!loadingList && marathons.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gray400,
              textTransform: 'uppercase', letterSpacing: 1 }}>
              Your LAPs ({marathons.length})
            </div>
          </div>

          {marathons.length > 3 && (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 14, color: T.gray400, pointerEvents: 'none',
              }}>🔍</span>
              <input
                value={lapSearch}
                onChange={e => setLapSearch(e.target.value)}
                placeholder="Search LAPs…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 32px 9px 32px', borderRadius: 10,
                  border: `1.5px solid ${lapSearch ? T.green : T.gray200}`,
                  fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  background: T.white,
                }}
              />
              {lapSearch && (
                <button onClick={() => setLapSearch('')} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.gray400, fontSize: 14, padding: '2px 4px',
                }}>✕</button>
              )}
            </div>
          )}

          {filteredMarathons.length === 0 && lapSearch && (
            <div style={{ textAlign: 'center', color: T.gray400, fontSize: 13, padding: '12px 0' }}>
              No LAPs matching "{lapSearch}"
            </div>
          )}

          {filteredMarathons.map(m => (
            <LapListItem
              key={m.id}
              marathon={m}
              isSelected={String(selectedId) === String(m.id)}
              onSelect={id => setSelectedId(String(id))}
              onOpenDetails={handleOpenDetails}
              onDeleteSwipe={id => setConfirmDeleteId(id)}
              deleting={deletingId === m.id}
            />
          ))}
        </div>
      )}

      {!loadingList && !showCreate && marathons.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 20px',
          background: T.gray50, borderRadius: 16,
          border: `1.5px dashed ${T.gray200}`, marginBottom: 16,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏁</div>
          <div style={{ fontSize: 14, color: T.gray600, marginBottom: 16 }}>
            No active LAPs. Create your first one.
          </div>
        </div>
      )}

      {showCreate ? (
        <div style={{
          background: T.white, border: `1.5px solid ${T.gray200}`,
          borderRadius: 16, padding: '16px',
        }}>
          <CreateMarathonWizard
            coachId={coachId}
            existingTeams={existingTeams}
            onCreated={handleCreated}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: T.green, color: T.white,
            fontSize: 14, fontWeight: 700, border: 'none',
            cursor: 'pointer', marginBottom: 20,
            boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
          }}
        >
          + New LAP
        </button>
      )}

      {selectedId && !showCreate && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gray400,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Generate &amp; Share
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CARD_TYPES.map(({ type, emoji, label, desc }) => {
              const isActive  = activeCardType === type;
              const isLoading = isActive && loadingCard;
              return (
                <button
                  key={type}
                  onClick={() => handleCardTap(type)}
                  disabled={loadingCard}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                    border: `1.5px solid ${isActive ? T.green : T.gray200}`,
                    background: isActive ? T.greenBg : T.white,
                    cursor: loadingCard ? 'not-allowed' : 'pointer',
                    opacity: loadingCard && !isActive ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.gray800 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 12, color: T.gray400 }}>{desc}</span>
                  </span>
                  <span style={{ fontSize: 18, color: isLoading ? T.green : T.gray400 }}>
                    {isLoading ? '⏳' : '›'}
                  </span>
                </button>
              );
            })}
          </div>
          {cardError && (
            <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.red, marginTop: 10 }}>
              {cardError}
            </div>
          )}
        </div>
      )}

      <MarathonShareSheet isOpen={shareOpen} onClose={closeShare} card={cardData} shareUrl={shareUrl} />

      {confirmDeleteId && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {detailsMarathonId && (
        <LapDetailsModal
          marathonId={detailsMarathonId}
          coachId={coachId}
          marathonName={detailsMarathon?.name || ''}
          onClose={() => setDetailsMarathonId(null)}
        />
      )}
    </div>
  );
};

export default MarathonDashboard;
