/**
 * BcmContactsEnableModal.jsx
 *
 * Shown when Contacts permission is denied at BCM create/update save time.
 * Enable → request OS permission / open Settings.
 * Don't need → dismiss (ask again next BCM save unless "Don't ask me again").
 */
import React, { useState } from 'react';

export default function BcmContactsEnableModal({
  onEnable,
  onDismiss,
  enabling = false,
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bcm-contacts-enable-title"
      aria-describedby="bcm-contacts-enable-desc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 340,
          padding: '28px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }} aria-hidden>
          👤
        </div>

        <h2
          id="bcm-contacts-enable-title"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#111827',
            textAlign: 'center',
            margin: '0 0 10px',
            lineHeight: 1.35,
          }}
        >
          Save member to Contacts?
        </h2>

        <p
          id="bcm-contacts-enable-desc"
          style={{
            fontSize: 14,
            color: '#6b7280',
            textAlign: 'center',
            margin: '0 0 18px',
            lineHeight: 1.5,
          }}
        >
          Contacts access is off. Enable it to save this Body Parameters member
          to your phone contacts.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            marginBottom: 18,
            cursor: enabling ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <input
            type="checkbox"
            checked={dontAskAgain}
            disabled={enabling}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            style={{ width: 18, height: 18, flexShrink: 0, accentColor: '#16a34a' }}
          />
          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
            Don&apos;t ask me again
          </span>
        </label>

        <button
          type="button"
          onClick={() => onEnable()}
          disabled={enabling}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            background: enabling ? '#d1fae5' : '#16a34a',
            color: enabling ? '#065f46' : '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: enabling ? 'wait' : 'pointer',
            marginBottom: 10,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {enabling ? 'Enabling…' : 'Enable'}
        </button>

        <button
          type="button"
          onClick={() => onDismiss(dontAskAgain)}
          disabled={enabling}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: '1.5px solid #e5e7eb',
            background: 'transparent',
            color: '#6b7280',
            fontSize: 15,
            fontWeight: 600,
            cursor: enabling ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Don&apos;t need
        </button>
      </div>
    </div>
  );
}
