/**
 * Public share landing page — Marathon Recognition Cards.
 *
 * /share/marathon/<token>  is shared via WhatsApp by coaches.
 * Shown when the recipient doesn't have the app installed or opens on desktop.
 * Renders the stored card_data snapshot so it's always readable even after live data changes.
 */
import Head       from 'next/head';
import { findShareCard } from '../../../features/marathon/data/marathon.repo.js';
import { isShareValid }  from '../../../features/marathon/domain/marathon.rules.js';

const APP_PACKAGE   = 'com.wellnessvalley.app';
const APP_STORE_ID  = '6764327692';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
const APP_STORE_URL  = `https://apps.apple.com/in/app/wellness-valley/id${APP_STORE_ID}`;

const CARD_LABELS = {
  team:             'Marathon Team Card',
  day_leader:       'Marathon Day Leader',
  lap_leader:       'Marathon Lap Leader',
  community_leader: 'Marathon Community Leader',
};

export async function getServerSideProps({ params, req }) {
  const token   = (params?.token || '').toString();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const proto   = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host']  || req.headers.host || '';
  const baseUrl = `${proto}://${host}`;

  let shareCard  = null;
  let isExpired  = false;
  let cardLabel  = 'Marathon Card';
  let heroName   = null;
  let marathonName = null;

  if (UUID_RE.test(token)) {
    try {
      const row = await findShareCard(token);
      if (row) {
        isExpired    = !isShareValid(row.share_expires_at);
        shareCard    = row;
        cardLabel    = CARD_LABELS[row.card_type] || 'Marathon Card';
        marathonName = row.card_data?.marathonName || null;
        heroName     = row.card_data?.dayLeader?.name
                     || row.card_data?.lapLeader?.name
                     || null;
      }
    } catch {
      // non-fatal — fall back to generic page
    }
  }

  return {
    props: {
      token:        UUID_RE.test(token) ? token : null,
      baseUrl,
      cardLabel,
      heroName,
      marathonName,
      isExpired,
      cardType:     shareCard?.card_type || null,
      lapNumber:    shareCard?.lap_number || null,
      dayNumber:    shareCard?.day_number || null,
    },
  };
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const pageBg = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  border: '1px solid #bbf7d0',
  borderRadius: 20,
  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.08)',
  overflow: 'hidden',
};

const headerStyle = {
  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  color: '#fff',
  padding: '28px 20px 24px',
  textAlign: 'center',
};

const bodyStyle = {
  padding: '24px 20px',
  textAlign: 'center',
};

const btnStyle = {
  display: 'inline-block',
  padding: '14px 32px',
  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  color: '#fff',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 16,
  textDecoration: 'none',
  margin: '8px 4px',
  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
};

/* ── Component ───────────────────────────────────────────────────────────── */
export default function MarathonSharePage({
  token, baseUrl, cardLabel, heroName, marathonName, isExpired, cardType, lapNumber, dayNumber,
}) {
  if (!token) {
    return (
      <div style={pageBg}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🏃</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Wellness Valley</h1>
          </div>
          <div style={bodyStyle}>
            <p style={{ color: '#6b7280', fontSize: 16 }}>
              This link is invalid. Please ask your coach to share again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const intentUrl = `intent://share/marathon/${token}#Intent;scheme=wellnessvalley;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
  const lapDayLabel = lapNumber && dayNumber ? `Lap ${lapNumber}, Day ${dayNumber}` : '';
  const descText = heroName
    ? `${heroName} is leading the ${cardLabel}${lapDayLabel ? ` — ${lapDayLabel}` : ''}! Track your wellness journey on Wellness Valley.`
    : `${cardLabel}${marathonName ? ` · ${marathonName}` : ''}${lapDayLabel ? ` — ${lapDayLabel}` : ''}. Track your wellness journey on Wellness Valley.`;

  return (
    <>
      <Head>
        <title>{cardLabel} — Wellness Valley</title>
        <meta name="description"                     content={descText} />
        <meta property="og:title"                    content={`${cardLabel} — Wellness Valley`} />
        <meta property="og:description"              content={descText} />
        <meta property="og:image"                    content={`${baseUrl}/icons/icon-512.png`} />
        <meta property="og:url"                      content={`${baseUrl}/share/marathon/${token}`} />
        <meta property="og:type"                     content="website" />
        <meta name="twitter:card"                    content="summary_large_image" />
        <meta name="viewport"                        content="width=device-width, initial-scale=1" />
      </Head>

      <div style={pageBg}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏃‍♂️</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
              {cardLabel}
            </h1>
            {marathonName && (
              <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{marathonName}</p>
            )}
            {lapDayLabel && (
              <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.85 }}>{lapDayLabel}</p>
            )}
          </div>

          <div style={bodyStyle}>
            {isExpired ? (
              <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 20px' }}>
                This card has expired. Ask your coach to share the latest result.
              </p>
            ) : (
              <>
                {heroName && (
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                    🏆 {heroName}
                  </p>
                )}
                <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
                  Open the Wellness Valley app to see the full card and track your progress.
                </p>
              </>
            )}

            <a href={intentUrl} style={btnStyle}>
              Open in App (Android)
            </a>
            <a href={APP_STORE_URL} style={{ ...btnStyle, background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', boxShadow: '0 4px 12px rgba(29,78,216,0.3)' }}>
              Get on iOS
            </a>

            <p style={{ marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
              Wellness Valley — Build daily health habits with your coach.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
