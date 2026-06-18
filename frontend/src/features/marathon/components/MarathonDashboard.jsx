/**
 * MarathonDashboard.jsx
 *
 * Coach-facing dashboard for the Marathon Recognition Engine.
 * Shows the coach's active marathon(s) and provides one-tap card generation + sharing.
 *
 * Per frontend.md §14 — NO new App.js flags. This is a self-contained component
 * that can be mounted from any existing coach screen.
 *
 * Layout: marathon selector → card type buttons → auto-trigger share on tap
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useMarathon }    from '../hooks/useMarathon.js';
import MarathonShareSheet from './MarathonShareSheet.jsx';
import { createMarathon } from '../services/marathon.api.js';
import { getApiBaseUrl }  from '../../../config/api.config.js';

const CARD_TYPES = [
  { type: 'team',       label: '👥 Team Card',   desc: 'All members grid' },
  { type: 'day_leader', label: '🌟 Day Leader',   desc: "Today's top performer" },
  { type: 'lap_leader', label: '👑 Lap Leader',   desc: 'Best this lap' },
];

const ROLE_OPTIONS = [
  { value: 'member',            label: 'Member' },
  { value: 'assistant_captain', label: 'Asst. Captain' },
  { value: 'captain',           label: 'Captain' },
];

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  container: {
    padding: '16px 16px 32px',
    maxWidth: 440,
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  heading: {
    fontSize: 22, fontWeight: 800, color: '#111827',
    marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8,
  },
  subheading: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  section: { marginBottom: 24 },
  label: {
    fontSize: 12, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 600, color: '#111827',
    background: '#fff', outline: 'none', cursor: 'pointer',
  },
  cardTypeGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardTypeBtn: (active, loading) => ({
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', borderRadius: 14,
    border: active ? '2px solid #059669' : '1.5px solid #e5e7eb',
    background: active ? '#ecfdf5' : '#fff',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1, transition: 'all 0.15s', textAlign: 'left',
  }),
  cardTypeIcon: { fontSize: 26 },
  cardTypeInfo: { flex: 1 },
  cardTypeLabel: { fontSize: 15, fontWeight: 700, color: '#111827', display: 'block' },
  cardTypeDesc: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  shareArrow: { fontSize: 18, color: '#059669' },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 12,
  },
  emptyState: {
    textAlign: 'center', padding: '32px 20px',
    background: '#f9fafb', borderRadius: 16, border: '1.5px dashed #e5e7eb',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  createBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 10,
    background: 'linear-gradient(135deg,#059669,#10b981)',
    color: '#fff', fontSize: 14, fontWeight: 700,
    border: 'none', cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(5,150,105,0.25)',
  },
  loadingDot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: '#059669', marginRight: 6,
  },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  },
};

// ── Fetch coach's direct team members from the existing hierarchy API ──────
async function fetchCoachMembers(coachId) {
  const url = `${getApiBaseUrl()}/api/coach/team-hierarchy?coachId=${coachId}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to load team members');

  // Flatten the hierarchy to get direct members of this coach
  const members = [];
  const walk = (nodes) => {
    (nodes || []).forEach(node => {
      if (node.userId && node.role !== 'coach') {
        members.push({
          userId:   node.userId,
          name:     node.name || node.UserName || 'Member',
          photo:    node.ProfileImage || null,
          role:     node.role || 'user',
        });
      }
      if (node.members) walk(node.members);
      if (node.subCoaches) walk(node.subCoaches);
    });
  };
  walk(json.hierarchy || json.members || []);
  return members;
}

// ── Participant row in the picker ──────────────────────────────────────────
const ParticipantRow = ({ member, selected, lapRole, onToggle, onRoleChange }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: selected ? '1.5px solid #059669' : '1px solid #e5e7eb',
    background: selected ? '#f0fdf4' : '#fff',
    marginBottom: 6,
    cursor: 'pointer',
  }}
    onClick={() => onToggle(member.userId)}
  >
    {/* Avatar */}
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      overflow: 'hidden', border: '1.5px solid #e5e7eb', background: '#f3f4f6',
    }}>
      {member.photo ? (
        <img src={member.photo} alt={member.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,#059669,#0891b2)',
          fontSize: 14, fontWeight: 900, color: '#fff',
        }}>
          {String(member.name || '?').charAt(0).toUpperCase()}
        </div>
      )}
    </div>

    {/* Name */}
    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#111827' }}>
      {member.name}
    </div>

    {/* Role selector (only when selected) */}
    {selected && (
      <select
        value={lapRole}
        onClick={e => e.stopPropagation()}
        onChange={e => { e.stopPropagation(); onRoleChange(member.userId, e.target.value); }}
        style={{
          fontSize: 12, fontWeight: 700, borderRadius: 6,
          border: '1px solid #d1fae5', background: '#ecfdf5', color: '#065f46',
          padding: '4px 6px', cursor: 'pointer',
        }}
      >
        {ROLE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )}

    {/* Checkbox */}
    <div style={{
      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
      border: selected ? 'none' : '2px solid #d1d5db',
      background: selected ? '#059669' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
    </div>
  </div>
);

// ── Role validation summary ────────────────────────────────────────────────
function validateRoles(participants) {
  const captains   = participants.filter(p => p.role === 'captain');
  const assistants = participants.filter(p => p.role === 'assistant_captain');
  if (captains.length > 1)   return 'Only 1 captain allowed';
  if (assistants.length > 1) return 'Only 1 assistant captain allowed';
  return null;
}

// ── Multi-step create form ─────────────────────────────────────────────────
const CreateMarathonWizard = ({ coachId, onCreated, onCancel }) => {
  const [step,         setStep]         = useState(1); // 1=details, 2=members
  const [name,         setName]         = useState('');
  const [teamName,     setTeamName]     = useState('');
  const [startedAt,    setStartedAt]    = useState(new Date().toISOString().substring(0, 10));
  const [members,      setMembers]      = useState([]);
  const [loadingMbrs,  setLoadingMbrs]  = useState(false);
  const [membersErr,   setMembersErr]   = useState(null);
  // Map of userId → lap role for selected members
  const [roleMap,      setRoleMap]      = useState({});
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState(null);

  const selectedIds  = Object.keys(roleMap).map(Number);
  const participants = selectedIds.map(uid => ({
    userId: uid,
    role:   roleMap[uid] || 'member',
  }));
  const roleError = validateRoles(participants);

  // ── Step 1 → 2: load members ──────────────────────────────────────────────
  const goToStep2 = useCallback(async () => {
    if (!name.trim()) return setErr('Enter a LAP name');
    setErr(null);
    setLoadingMbrs(true);
    setMembersErr(null);
    try {
      const list = await fetchCoachMembers(coachId);
      setMembers(list);
      setStep(2);
    } catch (e) {
      setMembersErr(e.message || 'Could not load team members');
    } finally {
      setLoadingMbrs(false);
    }
  }, [coachId, name]);

  const toggleMember = (uid) => {
    setRoleMap(prev => {
      const next = { ...prev };
      if (next[uid] !== undefined) { delete next[uid]; }
      else { next[uid] = 'member'; }
      return next;
    });
  };

  const changeRole = (uid, role) => {
    setRoleMap(prev => ({ ...prev, [uid]: role }));
  };

  // ── Step 2 → submit ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!participants.length) return setErr('Select at least one participant');
    if (roleError) return setErr(roleError);
    setBusy(true); setErr(null);
    try {
      await createMarathon({
        coachId,
        name:         name.trim(),
        teamName:     teamName.trim() || null,
        totalLaps:    10,
        daysPerLap:   10,
        startedAt,
        participants,
        role: 'coach',
      });
      onCreated();
    } catch (e) {
      setErr(e.message || 'Failed to create marathon');
    } finally {
      setBusy(false);
    }
  };

  // ── Render step 1 ─────────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={{ marginTop: 16, textAlign: 'left' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
        New Marathon LAP
      </div>

      {/* LAP name */}
      <div style={{ marginBottom: 12 }}>
        <div style={s.label}>LAP Name *</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Team BalajiLeenah 12 - LAP 1"
          style={s.input}
        />
      </div>

      {/* Base team name (for auto-sequencing) */}
      <div style={{ marginBottom: 12 }}>
        <div style={s.label}>Base Team Name (optional)</div>
        <input
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          placeholder="e.g. Team BalajiLeenah  →  auto-numbered"
          style={s.input}
        />
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          If set, future LAPs auto-become "Team Name - LAP 2", "LAP 3", etc.
        </div>
      </div>

      {/* Start date */}
      <div style={{ marginBottom: 16 }}>
        <div style={s.label}>Start Date</div>
        <input
          type="date"
          value={startedAt}
          onChange={e => setStartedAt(e.target.value)}
          style={s.input}
        />
      </div>

      {err && <div style={s.error}>{err}</div>}
      {membersErr && <div style={s.error}>{membersErr}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '10px', borderRadius: 10,
          border: '1.5px solid #e5e7eb', background: '#fff',
          fontSize: 14, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button onClick={goToStep2} disabled={loadingMbrs} style={{ ...s.createBtn, flex: 2 }}>
          {loadingMbrs ? 'Loading members…' : 'Next: Pick Participants →'}
        </button>
      </div>
    </div>
  );

  // ── Render step 2 ─────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 16, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setStep(1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#059669', fontWeight: 700, padding: 0,
        }}>
          ← Back
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
          Select Participants
        </div>
        <span style={{
          marginLeft: 'auto', fontSize: 12, fontWeight: 700,
          color: selectedIds.length > 0 ? '#059669' : '#9ca3af',
        }}>
          {selectedIds.length} selected
        </span>
      </div>

      <div style={{
        fontSize: 11, color: '#6b7280', marginBottom: 10,
        background: '#f0fdf4', borderRadius: 8, padding: '8px 10px',
        border: '1px solid #d1fae5',
      }}>
        Tap a member to select. Change their role with the dropdown.
        Max 1 Captain · Max 1 Asst. Captain.
      </div>

      {/* Member list */}
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
        {members.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: 13 }}>
            No team members found. Add members to your team first.
          </div>
        ) : (
          members.map(m => (
            <ParticipantRow
              key={m.userId}
              member={m}
              selected={roleMap[m.userId] !== undefined}
              lapRole={roleMap[m.userId] || 'member'}
              onToggle={toggleMember}
              onRoleChange={changeRole}
            />
          ))
        )}
      </div>

      {err && <div style={s.error}>{err}</div>}

      <button
        onClick={handleCreate}
        disabled={busy || !selectedIds.length}
        style={{
          ...s.createBtn,
          width: '100%', justifyContent: 'center',
          opacity: (!selectedIds.length || busy) ? 0.6 : 1,
          cursor: (!selectedIds.length || busy) ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Creating…' : `Create LAP with ${selectedIds.length} participant${selectedIds.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
};

// ── Main dashboard ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   coachId: number,
 * }} props
 */
const MarathonDashboard = ({ coachId }) => {
  const {
    marathons, loadingList, listError, fetchMarathons,
    cardData, shareUrl, loadingCard, cardError, shareOpen,
    generateCard, closeShare,
  } = useMarathon({ coachId });

  const [selectedId,     setSelectedId]     = useState('');
  const [activeCardType, setActiveCardType] = useState(null);
  const [showCreate,     setShowCreate]     = useState(false);

  // Load on mount
  useEffect(() => {
    fetchMarathons('active');
  }, [fetchMarathons]);

  // Auto-select first marathon
  useEffect(() => {
    if (marathons.length > 0 && !selectedId) {
      setSelectedId(String(marathons[0].id));
    }
  }, [marathons, selectedId]);

  const handleCardTap = (cardType) => {
    if (loadingCard) return;
    setActiveCardType(cardType);
    generateCard({ marathonId: Number(selectedId), cardType });
  };

  const handleCreated = () => {
    setShowCreate(false);
    fetchMarathons('active');
  };

  return (
    <div style={s.container}>
      <div style={s.heading}>
        🏃 Marathon Cards
      </div>
      <div style={s.subheading}>Generate &amp; share recognition cards instantly</div>

      {listError && <div style={s.error}>{listError}</div>}

      {/* Marathon selector */}
      {marathons.length > 0 && (
        <div style={s.section}>
          <div style={s.label}>Marathon</div>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={s.select}
          >
            {marathons.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}  (Lap {m.total_laps} × {m.days_per_lap} days)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Empty state */}
      {!loadingList && marathons.length === 0 && (
        <div style={s.emptyState}>
          {!showCreate ? (
            <>
              <div style={s.emptyIcon}>🏁</div>
              <div style={s.emptyText}>No active marathons. Create one to generate recognition cards.</div>
              <button style={s.createBtn} onClick={() => setShowCreate(true)}>
                + New Marathon
              </button>
            </>
          ) : (
            <CreateMarathonWizard
              coachId={coachId}
              onCreated={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
          )}
        </div>
      )}

      {/* Also allow creating a new LAP when marathons exist */}
      {!loadingList && marathons.length > 0 && (
        <div style={s.section}>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1.5px dashed #d1fae5', background: '#f0fdf4',
                fontSize: 13, fontWeight: 700, color: '#059669', cursor: 'pointer',
              }}
            >
              + New LAP
            </button>
          ) : (
            <div style={{
              background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 16, padding: '4px 16px 16px',
            }}>
              <CreateMarathonWizard
                coachId={coachId}
                onCreated={handleCreated}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Card type buttons */}
      {selectedId && (
        <div style={s.section}>
          <div style={s.label}>Choose Card to Share</div>
          <div style={s.cardTypeGrid}>
            {CARD_TYPES.map(({ type, label, desc }) => {
              const isActive  = activeCardType === type;
              const isLoading = isActive && loadingCard;
              return (
                <button
                  key={type}
                  onClick={() => handleCardTap(type)}
                  disabled={loadingCard}
                  style={s.cardTypeBtn(isActive, loadingCard)}
                >
                  <span style={s.cardTypeIcon}>{label.split(' ')[0]}</span>
                  <span style={s.cardTypeInfo}>
                    <span style={s.cardTypeLabel}>{label.substring(2)}</span>
                    <span style={s.cardTypeDesc}>{desc}</span>
                  </span>
                  {isLoading
                    ? <span style={s.loadingDot} />
                    : <span style={s.shareArrow}>›</span>
                  }
                </button>
              );
            })}
          </div>
          {cardError && <div style={s.error}>{cardError}</div>}
        </div>
      )}

      {/* Invisible share orchestrator */}
      <MarathonShareSheet
        isOpen={shareOpen}
        onClose={closeShare}
        card={cardData}
        shareUrl={shareUrl}
      />
    </div>
  );
};

export default MarathonDashboard;
