/**
 * Offline and hard failures cover the screen.
 * A measured slow link, or an API call that is simply taking a while,
 * shows a banner and leaves the app usable.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CapacitorHttp } from '@capacitor/core';
import { CloudOff, LoaderCircle, WifiOff } from 'lucide-react';
import { getApiBaseUrl } from '../../config/api.config.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import {
  dismissNetworkFailure,
  installNetworkMonitoring,
  subscribeNetworkNotice,
} from '../services/networkNotice.js';

function isApiRequest(url) {
  const value = String(url || '');
  if (!/^https?:/i.test(value)) return false;
  try {
    const base = getApiBaseUrl();
    if (base && value.startsWith(base)) return true;
  } catch {
    // Missing API config still matches /api/ paths below.
  }
  return value.includes('/api/');
}

const COPY = {
  offline: {
    title: 'You are offline',
    body: 'Wellness Valley needs an internet connection. This screen stays until you are back online.',
    hint: 'Waiting for connection',
  },
  degraded: {
    title: 'Your connection looks slow',
    body: 'You can keep using the app. Some screens may take longer to load.',
    hint: 'Slow connection',
  },
  waiting: {
    title: 'Taking longer than usual',
    body: 'The app is still working. You can keep this screen open.',
    hint: 'Please wait',
  },
  failure: {
    title: 'Can\'t connect right now',
    body: 'We couldn\'t finish that request. Check your connection, then try again.',
    hint: 'Connection problem',
  },
  server: {
    title: 'Something went wrong on our side',
    body: 'The server had a problem. Try again in a moment.',
    hint: 'Server problem',
  },
};

function StatusIcon({ kind, compact = false }) {
  const Icon = kind === 'offline' || kind === 'degraded' ? WifiOff : kind === 'waiting' ? LoaderCircle : CloudOff;
  const spinning = kind === 'waiting';
  return (
    <div
      aria-hidden="true"
      style={{
        width: compact ? 36 : 96,
        height: compact ? 36 : 96,
        borderRadius: compact ? 12 : 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(16,185,129,0.25)',
        boxShadow: compact ? 'none' : '0 16px 40px rgba(6,78,59,0.12)',
        marginBottom: compact ? 0 : 28,
      }}
    >
      <Icon
        size={compact ? 18 : 40}
        color="#047857"
        strokeWidth={1.75}
        style={spinning ? { animation: 'wv-net-spin 1s linear infinite' } : undefined}
      />
    </div>
  );
}

export default function NetworkStatusNotice() {
  const online = useOnlineStatus();
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let probeUrl = '';
    try {
      probeUrl = `${getApiBaseUrl()}/api/misc/server-time`;
    } catch {
      probeUrl = '';
    }
    installNetworkMonitoring({ isApiRequest, http: CapacitorHttp, probeUrl });
  }, []);

  useEffect(() => subscribeNetworkNotice(setNotice), []);

  const kind = !online ? 'offline' : (notice?.type || '');
  const copy = COPY[kind];
  if (!copy || typeof document === 'undefined') return null;

  if (kind === 'degraded' || kind === 'waiting') {
    return createPortal(
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 'max(12px, env(safe-area-inset-top, 0px))',
          left: 12,
          right: 12,
          zIndex: 10040,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 16,
          background: '#ffffff',
          border: '1px solid rgba(16,185,129,0.35)',
          boxShadow: '0 10px 28px rgba(6,78,59,0.12)',
          pointerEvents: 'none',
        }}
      >
        <style>{`@keyframes wv-net-spin { to { transform: rotate(360deg); } }`}</style>
        <StatusIcon kind={kind} compact />
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#064e3b' }}>{copy.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.4, color: '#64748b' }}>{copy.body}</p>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wv-network-title"
      aria-describedby="wv-network-body"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(32px, env(safe-area-inset-top, 0px)) 28px max(32px, env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #ecfdf5 0%, #f8fafc 55%, #ffffff 100%)',
      }}
    >
      <style>{`
        @keyframes wv-net-spin { to { transform: rotate(360deg); } }
        @keyframes wv-net-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <StatusIcon kind={kind} />

      <p
        style={{
          margin: '0 0 10px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#059669',
        }}
      >
        {copy.hint}
      </p>

      <h1
        id="wv-network-title"
        style={{
          margin: '0 0 12px',
          maxWidth: 320,
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.2,
          color: '#064e3b',
        }}
      >
        {copy.title}
      </h1>

      <p
        id="wv-network-body"
        style={{
          margin: 0,
          maxWidth: 320,
          fontSize: 16,
          lineHeight: 1.55,
          color: '#64748b',
        }}
      >
        {copy.body}
      </p>

      {kind === 'offline' ? (
        <div
          aria-hidden="true"
          style={{ display: 'flex', gap: 8, marginTop: 28 }}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#10b981',
                animation: 'wv-net-pulse 1.2s ease-in-out infinite',
                animationDelay: `${dot * 0.15}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => dismissNetworkFailure()}
          style={{
            marginTop: 32,
            width: '100%',
            maxWidth: 320,
            padding: '16px 20px',
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 24px rgba(5,150,105,0.28)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Try again
        </button>
      )}
    </div>,
    document.body,
  );
}
