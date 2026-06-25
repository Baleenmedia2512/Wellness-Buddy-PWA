/**
 * MarathonLeaderboard.jsx
 *
 * Ranked list component for Day / Lap / Community leaderboard.
 * Mobile-optimized, tab-switching between types.
 *
 * Receives `leaderboard` data from useMarathon hook.
 */
import React, { useState } from 'react';

const TABS = [
  { key: 'day',       label: '🌟 Day',   desc: "Today's reduction" },
  { key: 'lap',       label: '👑 Lap',   desc: 'Lap total' },
  { key: 'community', label: '🌍 Community', desc: 'Overall' },
];

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#c2883c'];
const RANK_LABELS = ['1st', '2nd', '3rd'];

const DisciplineDot = ({ status }) => {
  const color = status === 'eligible' ? '#059669'
              : status === 'missed'   ? '#dc2626'
              : '#9ca3af';
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, marginRight: 4, flexShrink: 0,
    }} />
  );
};

const LeaderRow = ({ entry }) => {
  const { rank, name, profileImage, role, disciplineStatus, changeDisplay } = entry;
  const isTop3    = rank <= 3;
  const rankColor = isTop3 ? RANK_COLORS[rank - 1] : '#9ca3af';

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            12,
      padding:        '12px 16px',
      borderBottom:   '1px solid #f3f4f6',
      background:     rank === 1 ? 'linear-gradient(90deg, #fffbeb 0%, #fff 100%)' : '#fff',
    }}>
      {/* Rank */}
      <div style={{
        width: 28, textAlign: 'center', flexShrink: 0,
        fontSize: isTop3 ? 15 : 13,
        fontWeight: 900,
        color: rankColor,
      }}>
        {isTop3 ? RANK_LABELS[rank - 1] : rank}
      </div>

      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        overflow: 'hidden', flexShrink: 0,
        border: rank === 1 ? '2px solid #f59e0b' : '1.5px solid #e5e7eb',
        background: '#f3f4f6',
      }}>
        {profileImage ? (
          <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#059669,#0891b2)',
            fontSize: 16, fontWeight: 900, color: '#fff',
          }}>
            {String(name || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#111827',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#6b7280' }}>
          <DisciplineDot status={disciplineStatus} />
          {disciplineStatus === 'eligible' ? 'Disciplined' : disciplineStatus === 'missed' ? 'Missed' : 'No upload'}
          {role !== 'member' && (
            <span style={{
              marginLeft: 6, background: '#dcfce7', color: '#065f46',
              fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px',
            }}>
              {role === 'captain' ? 'C' : 'AC'}
            </span>
          )}
        </div>
      </div>

      {/* Change */}
      <div style={{
        fontSize: 15, fontWeight: 900,
        color: changeDisplay?.startsWith('-') ? '#059669' : '#d97706',
        flexShrink: 0,
      }}>
        {changeDisplay}
      </div>
    </div>
  );
};

/**
 * @param {{
 *   marathonId:  number,
 *   marathonName: string,
 *   entries:     object[],   — from useMarathon.leaderboard
 *   loading:     boolean,
 *   error:       string|null,
 *   activeType:  string,
 *   onTabChange: (type: string) => void,
 * }} props
 */
const MarathonLeaderboard = ({ marathonName, entries = [], loading, error, activeType = 'day', onTabChange }) => (
  <div style={{
    background: '#fff',
    borderRadius: 20,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    maxWidth: 440,
    margin: '0 auto',
  }}>
    {/* Header */}
    <div style={{ padding: '16px 16px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 12 }}>
        🏆 {marathonName || 'Marathon Leaderboard'}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange && onTabChange(tab.key)}
            style={{
              flex: 1, padding: '8px 4px',
              border: 'none', borderBottom: activeType === tab.key ? '2.5px solid #059669' : '2.5px solid transparent',
              background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeType === tab.key ? 800 : 600,
              color: activeType === tab.key ? '#059669' : '#6b7280',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>

    {/* Content */}
    {loading ? (
      <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>Loading…</div>
    ) : error ? (
      <div style={{ padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>{error}</div>
    ) : !entries.length ? (
      <div style={{ textAlign: 'center', padding: '32px 20px', color: '#9ca3af' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🏅</div>
        <div style={{ fontSize: 13 }}>No eligible participants yet today.</div>
      </div>
    ) : (
      <div>
        {entries.map(entry => (
          <LeaderRow key={entry.userId} entry={entry} />
        ))}
      </div>
    )}
  </div>
);

export default MarathonLeaderboard;
