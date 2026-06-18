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
import React, { useEffect, useState } from 'react';
import { useMarathon }          from '../hooks/useMarathon.js';
import MarathonShareSheet       from './MarathonShareSheet.jsx';
import { createMarathon }       from '../services/marathon.api.js';

const CARD_TYPES = [
  { type: 'team',       label: '👥 Team Card',       desc: 'All members grid' },
  { type: 'day_leader', label: '🌟 Day Leader',       desc: "Today's top performer" },
  { type: 'lap_leader', label: '👑 Lap Leader',       desc: 'Best this lap' },
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
  label: { fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 600, color: '#111827',
    background: '#fff', outline: 'none', cursor: 'pointer',
  },
  cardTypeGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardTypeBtn: (active, loading) => ({
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px',
    borderRadius: 14,
    border: active ? '2px solid #059669' : '1.5px solid #e5e7eb',
    background: active ? '#ecfdf5' : '#fff',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    transition: 'all 0.15s',
    textAlign: 'left',
  }),
  cardTypeIcon: { fontSize: 26 },
  cardTypeInfo: { flex: 1 },
  cardTypeLabel: { fontSize: 15, fontWeight: 700, color: '#111827', display: 'block' },
  cardTypeDesc: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  shareArrow: { fontSize: 18, color: '#059669' },
  error: {
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#dc2626', marginTop: 12,
  },
  emptyState: {
    textAlign: 'center', padding: '32px 20px',
    background: '#f9fafb', borderRadius: 16,
    border: '1.5px dashed #e5e7eb',
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
    background: '#059669', animation: 'pulse 0.8s infinite',
    marginRight: 6,
  },
};

// ── Sub-component: quick-create form ──────────────────────────────────────
const QuickCreate = ({ coachId, participantUserIds = [], onCreated }) => {
  const [name, setName]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [err,  setErr]      = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return setErr('Please enter a marathon name');
    setBusy(true); setErr(null);
    try {
      const today = new Date().toISOString().substring(0, 10);
      await createMarathon({
        coachId,
        name:               name.trim(),
        totalLaps:          10,
        daysPerLap:         10,
        startedAt:          today,
        participantUserIds,
        role:               'coach',
      });
      onCreated();
    } catch (e) {
      setErr(e.message || 'Failed to create marathon');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Marathon name, e.g. Team BalajiLeenah 12"
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={handleCreate} disabled={busy} style={s.createBtn}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
      {err && <div style={s.error}>{err}</div>}
    </div>
  );
};

// ── Main dashboard ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   coachId: number,
 *   teamMemberIds?: number[]   — pre-populated participant list for quick-create
 * }} props
 */
const MarathonDashboard = ({ coachId, teamMemberIds = [] }) => {
  const {
    marathons, loadingList, listError, fetchMarathons,
    cardData, shareUrl, loadingCard, cardError, shareOpen,
    generateCard, closeShare,
  } = useMarathon({ coachId });

  const [selectedId,      setSelectedId]      = useState('');
  const [activeCardType,  setActiveCardType]  = useState(null);
  const [showCreate,      setShowCreate]      = useState(false);

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
          <div style={s.emptyIcon}>🏁</div>
          <div style={s.emptyText}>No active marathons. Create one to generate recognition cards.</div>
          <button style={s.createBtn} onClick={() => setShowCreate(v => !v)}>
            + New Marathon
          </button>
          {showCreate && (
            <QuickCreate
              coachId={coachId}
              participantUserIds={teamMemberIds}
              onCreated={handleCreated}
            />
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
