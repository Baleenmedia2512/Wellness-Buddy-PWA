import React, { useEffect, useState } from 'react';

/**
 * Renders a QR image for the booking payload (eventId:entryCode).
 * Optional `compact` trims chrome when embedded inside a larger pass card.
 * Existing callers that only pass eventName / entryCode / qrPayload stay unchanged.
 */
export default function RegistrationQrCard({ qrPayload, entryCode, eventName, compact = false }) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      if (!qrPayload) {
        setDataUrl('');
        return;
      }
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(String(qrPayload), {
          width: compact ? 220 : 240,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) {
          setDataUrl(url);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setDataUrl('');
          setError(err?.message || 'Could not draw QR code.');
        }
      }
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [qrPayload, compact]);

  if (compact) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white px-4 py-5 text-center shadow-[0_8px_24px_-18px_rgba(6,95,70,0.35)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-800">
          Scan to enter
        </p>
        {dataUrl ? (
          <div className="mx-auto mt-3.5 inline-flex rounded-lg border border-emerald-100 bg-white p-3 shadow-[0_10px_30px_-18px_rgba(15,31,24,0.28)]">
            <img
              src={dataUrl}
              alt={`Entry QR ${entryCode || ''}`.trim()}
              className="h-48 w-48 rounded-md bg-white"
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-600" role="status">
            {error || 'Preparing QR…'}
          </p>
        )}
        {entryCode ? (
          <p className="mt-3.5 text-base font-semibold tracking-wide text-emerald-950">
            {/^\d{4}$/.test(String(entryCode))
              ? String(entryCode).split('').join(' ')
              : String(entryCode)}
          </p>
        ) : null}
        <p className="mt-3 text-xs font-medium text-emerald-800">
          Show this QR at the entrance
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center shadow-sm">
      {eventName ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Event</p>
          <p className="mt-1 text-base font-bold text-gray-900">{eventName}</p>
        </>
      ) : null}
      {entryCode ? (
        <p className="mt-2 text-3xl font-bold tracking-[0.2em] text-emerald-900">{entryCode}</p>
      ) : null}
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Entry QR ${entryCode || ''}`.trim()}
          className="mx-auto mt-3 h-48 w-48 rounded-lg border border-gray-100 bg-white"
        />
      ) : (
        <p className="mt-3 text-sm text-gray-600" role="status">
          {error || 'Preparing QR…'}
        </p>
      )}
      {qrPayload ? (
        <p className="mt-2 break-all text-[11px] text-gray-500">{qrPayload}</p>
      ) : null}
    </div>
  );
}
