/**
 * MarathonDashboard.jsx — Coach-facing Marathon Recognition dashboard.
 *
 * Fixes applied:
 *  1. Team name not re-asked on 2nd LAP (pre-filled from existing team names)
 *  2. Delete option per LAP — custom confirm modal (no window.confirm)
 *  3. After create: immediately shows LAP list with new lap auto-selected
 *  4. After save: list reloads with newest LAP at top
 *  5. Exactly 9 participants enforced (captain=coach auto + 8 members)
 *  6. Back button uses app theme (Tailwind, matches other screens in App.js)
 *  7. Mobile-responsive padding with safe-area insets
 *  8. Lap search / filter
 *  9. LapListItem aligned labels (LAP badge + formatted date)
 * 10. Previous active laps auto-completed on new lap creation (backend)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useMarathon }      from '../hooks/useMarathon.js';
import MarathonShareSheet   from './MarathonShareSheet.jsx';
import { createMarathon, deleteMarathon } from '../services/marathon.api.js';
import { getApiBaseUrl }    from '../../../config/api.config.js';

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
};

// ── Fetch team members ──────────────────────────────────────────────────────
async function fetchCoachMembers(coachId) {
  const url  = `${getApiBaseUrl()}/api/coach/team-hierarchy?coachId=${coachId}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to load team members');
  const flat = Array.isArray(json.allMembers) ? json.allMembers : [];
  return flat
    .filter(m => m.UserId && String(m.Role || '').toLowerCase() !== 'coach')
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
    <Avatar photo={member.photo} name={member.name} />
    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.gray800,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {member.name}
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
      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
      border: selected ? 'none' : `2px solid ${T.gray200}`,
      background: selected ? T.green : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {selected && <span style={{ color: T.white, fontSize: 12, fontWeight: 900 }}>✓</span>}
    </div>
  </div>
);

// ── Create wizard ────────────────────────────────────────────────────────────
const CreateMarathonWizard = ({ coachId, existingTeamNames = [], onCreated, onCancel }) => {
  const [step,         setStep]         = useState(1);
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
  const lapPreview   = teamName.trim()
    ? `${teamName.trim()} - LAP ${existingTeamNames.filter(n => n === teamName.trim()).length + 1}`
    : '';

  const goToStep2 = useCallback(async () => {
    if (!teamName.trim()) return setErr('Enter a Team Name');
    setErr(null); setLoadingMbrs(true); setMembersErr(null);
    try {
      const list = await fetchCoachMembers(coachId);
      setMembers(list);
      setStep(2);
    } catch (e) {
      setMembersErr(e.message || 'Could not load team members');
    } finally {
      setLoadingMbrs(false);
    }
  }, [coachId, teamName]);

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
      const tn = teamName.trim();
      const result = await createMarathon({ coachId, name: tn, teamName: tn, totalLaps: 10, daysPerLap: 10, startedAt, participants, role: 'coach' });
      // Pass new marathon ID so the dashboard can auto-select it
      onCreated(result?.data?.marathonId || result?.data?.id || null);
    } catch (e) {
      setErr(e.message || 'Failed to create LAP');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 1 ──
  if (step === 1) return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.gray800, marginBottom: 16 }}>
        New Marathon LAP
      </div>

      {/* Team name — with suggestions from existing LAPs */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.gray600,
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Team Name *
        </label>
        <input
          list="team-name-suggestions"
          value={teamName}
          onChange={e => { setTeamName(e.target.value); setErr(null); }}
          placeholder="e.g. Power Burners"
          autoFocus
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: `1.5px solid ${T.gray200}`, fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        {/* Browser datalist for quick re-selection of existing team names */}
        <datalist id="team-name-suggestions">
          {[...new Set(existingTeamNames)].map(n => <option key={n} value={n} />)}
        </datalist>
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

      {/* Start date */}
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
        }}>
          Cancel
        </button>
        <button onClick={goToStep2} disabled={loadingMbrs || !teamName.trim()} style={{
          flex: 2, padding: '12px', borderRadius: 10,
          background: T.green, color: T.white, fontSize: 14, fontWeight: 700,
          border: 'none', cursor: loadingMbrs || !teamName.trim() ? 'not-allowed' : 'pointer',
          opacity: !teamName.trim() ? 0.5 : 1,
        }}>
          {loadingMbrs ? 'Loading members…' : 'Next: Pick 8 Members →'}
        </button>
      </div>
    </div>
  );

  // ── Step 2 ──
  const remaining      = LAP_SIZE - selectedIds.length;
  const searchLower    = memberSearch.toLowerCase().trim();
  const filteredMembers = searchLower
    ? members.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        String(m.teamId  || '').includes(searchLower) ||
        String(m.phone   || '').includes(searchLower)
      )
    : members;

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Step 2 header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setStep(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.green, fontSize: 14, fontWeight: 700, padding: '0 8px 0 0',
        }}>
          ←
        </button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: T.gray800 }}>
          Pick 8 Members
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

      {/* Info strip */}
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

      {members.length === 0 ? (
        <div style={{ textAlign: 'center', color: T.gray400, padding: '20px 0', fontSize: 13 }}>
          No team members found. Add members to your team first.
        </div>
      ) : (
        <>
          {/* Participant search */}
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
                padding: '8px 28px 8px 28px', borderRadius: 8,
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
              No members matching "{memberSearch}"
            </div>
          )}

          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
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

// ── LAP list item ────────────────────────────────────────────────────────────
const LapListItem = ({ marathon, isSelected, onSelect, onDelete, deleting }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 14px',
    background: isSelected ? T.greenBg : T.white,
    border: `1.5px solid ${isSelected ? T.green : T.gray200}`,
    borderRadius: 12, marginBottom: 8,
    cursor: 'pointer',
  }}
    onClick={() => onSelect(marathon.id)}
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
      <button
        onClick={e => { e.stopPropagation(); onDelete(marathon.id); }}
        disabled={deleting}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: deleting ? T.gray400 : T.red, fontSize: 16, padding: '4px 6px',
          borderRadius: 6, lineHeight: 1,
        }}
        title="Delete LAP"
      >
        {deleting ? '…' : '🗑'}
      </button>
    </div>
  </div>
);

// ── Delete confirmation modal ─────────────────────────────────────────────────
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
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 6 }}>
        Delete this LAP?
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

  // Fetch active marathons on mount; pass explicit 'active' to avoid stale entries
  useEffect(() => { fetchMarathons('active'); }, [fetchMarathons]);

  useEffect(() => {
    if (marathons.length > 0 && !selectedId) {
      setSelectedId(String(marathons[0].id));
    }
  }, [marathons, selectedId]);

  // After wizard creates a lap, pre-select the new lap's ID then reload list
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

    // Optimistic: remove from list immediately for instant feedback
    removeMarathon(Number(id));
    if (String(selectedId) === String(id)) setSelectedId('');

    try {
      await deleteMarathon({ marathonId: id, coachId });
      // Await the refresh so we're certain the list is in sync
      await fetchMarathons('active');
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete LAP. Please try again.');
      // Restore list on failure so the user can see the lap is still there
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

  // All unique existing team_names (for datalist suggestions in wizard)
  const existingTeamNames = marathons.map(m => m.team_name).filter(Boolean);

  // Filtered lap list for search
  const filteredMarathons = lapSearch.trim()
    ? marathons.filter(m => m.name.toLowerCase().includes(lapSearch.toLowerCase().trim()))
    : marathons;

  return (
    <div style={{
      padding: 'max(12px, env(safe-area-inset-top, 12px)) max(16px, env(safe-area-inset-right, 16px)) calc(40px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 16px))',
      maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* Page title */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.gray800, margin: 0 }}>
          Marathon LAPs
        </h1>
        <p style={{ fontSize: 13, color: T.gray400, margin: '2px 0 0' }}>
          Select a LAP to generate &amp; share recognition cards
        </p>
      </div>

      {/* Delete error banner */}
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

      {/* Loading */}
      {loadingList && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: T.gray400, fontSize: 14 }}>
          Loading…
        </div>
      )}

      {/* LAP list */}
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

          {/* Search — shown only when there are enough laps to be useful */}
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
              onDelete={id => setConfirmDeleteId(id)}
              deleting={deletingId === m.id}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
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

      {/* Create form */}
      {showCreate ? (
        <div style={{
          background: T.white, border: `1.5px solid ${T.gray200}`,
          borderRadius: 16, padding: '16px',
        }}>
          <CreateMarathonWizard
            coachId={coachId}
            existingTeamNames={existingTeamNames}
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

      {/* Card generation — only shows when a LAP is selected */}
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

      {/* Delete confirmation bottom sheet */}
      {confirmDeleteId && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

export default MarathonDashboard;
