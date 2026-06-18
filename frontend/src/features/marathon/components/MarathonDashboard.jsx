/**
 * MarathonDashboard.jsx — Coach-facing Marathon Recognition dashboard.
 *
 * Fixes applied:
 *  1. Team name not re-asked on 2nd LAP (pre-filled from existing team names)
 *  2. Delete option per LAP
 *  3. After create: immediately shows LAP list
 *  4. After save: list reloads with newest LAP at top
 *  5. Exactly 9 participants enforced (captain=coach auto + 8 members)
 *  6. Back button uses app theme (Tailwind, matches other screens in App.js)
 *  7. Mobile-responsive padding using Tailwind tokens
 *  (8. Theme: app green #16a34a / green-600, bg-white, text-gray-800)
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
    .map(m => ({ userId: m.UserId, name: m.UserName || 'Member', photo: m.ProfileImage || null }));
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
  const [step,        setStep]        = useState(1);
  const [teamName,    setTeamName]    = useState('');
  const [startedAt,   setStartedAt]   = useState(new Date().toISOString().substring(0, 10));
  const [members,     setMembers]     = useState([]);
  const [loadingMbrs, setLoadingMbrs] = useState(false);
  const [membersErr,  setMembersErr]  = useState(null);
  const [roleMap,     setRoleMap]     = useState({});
  const [busy,        setBusy]        = useState(false);
  const [err,         setErr]         = useState(null);

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
      await createMarathon({ coachId, name: tn, teamName: tn, totalLaps: 10, daysPerLap: 10, startedAt, participants, role: 'coach' });
      onCreated();
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
  const remaining = LAP_SIZE - selectedIds.length;
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
        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
          {members.map(m => (
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
    display: 'flex', alignItems: 'center', gap: 10,
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
      fontSize: 16,
    }}>
      🏃
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.gray800,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {marathon.name}
      </div>
      <div style={{ fontSize: 11, color: T.gray400, marginTop: 1 }}>
        {marathon.days_per_lap} days/lap · Started {marathon.started_at}
      </div>
    </div>
    {isSelected && (
      <span style={{
        fontSize: 11, fontWeight: 700, color: T.green,
        background: T.greenLight, borderRadius: 100, padding: '3px 8px',
      }}>Active</span>
    )}
    <button
      onClick={e => { e.stopPropagation(); onDelete(marathon.id); }}
      disabled={deleting}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: T.gray400, fontSize: 18, padding: '4px 6px', borderRadius: 6,
        flexShrink: 0,
      }}
      title="Delete LAP"
    >
      {deleting ? '…' : '🗑'}
    </button>
  </div>
);

// ── Main dashboard ────────────────────────────────────────────────────────────
const MarathonDashboard = ({ coachId }) => {
  const {
    marathons, loadingList, listError, fetchMarathons,
    cardData, shareUrl, loadingCard, cardError, shareOpen,
    generateCard, closeShare,
  } = useMarathon({ coachId });

  const [selectedId,     setSelectedId]     = useState('');
  const [activeCardType, setActiveCardType] = useState(null);
  const [showCreate,     setShowCreate]     = useState(false);
  const [deletingId,     setDeletingId]     = useState(null);

  useEffect(() => { fetchMarathons('active'); }, [fetchMarathons]);

  useEffect(() => {
    if (marathons.length > 0 && !selectedId) {
      setSelectedId(String(marathons[0].id));
    }
  }, [marathons, selectedId]);

  const handleCreated = () => {
    setShowCreate(false);
    // Reload immediately — newest LAP will appear at top (ordered by created_at desc)
    fetchMarathons('active');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this LAP? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteMarathon({ marathonId: id, coachId });
      if (String(selectedId) === String(id)) setSelectedId('');
      await fetchMarathons('active');
    } catch (e) {
      alert(e.message || 'Failed to delete');
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

  return (
    <div style={{
      padding: '12px 16px 40px',
      maxWidth: 480, margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.gray800, margin: 0 }}>
          Marathon LAPs
        </h1>
        <p style={{ fontSize: 13, color: T.gray400, margin: '2px 0 0' }}>
          Select a LAP to generate &amp; share recognition cards
        </p>
      </div>

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
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gray400,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Your LAPs
          </div>
          {marathons.map(m => (
            <LapListItem
              key={m.id}
              marathon={m}
              isSelected={String(selectedId) === String(m.id)}
              onSelect={id => setSelectedId(String(id))}
              onDelete={handleDelete}
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
    </div>
  );
};

export default MarathonDashboard;
