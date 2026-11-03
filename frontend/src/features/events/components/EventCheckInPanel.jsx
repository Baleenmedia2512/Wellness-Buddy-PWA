import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  MapPin,
  Phone,
  ScanLine,
  ShieldCheck,
  User,
} from 'lucide-react';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getUserId } from '../../../shared/services/getUserId.js';
import { buildUserAvatarUrl } from '../../user/services/avatarDisplayVersion.js';
import { checkInEventRegistration, listOpenEvents } from '../services/events.api.js';

const SCAN_GAP_MS = 50;
const JSQR_MAX_WIDTH = 480;

let barcodeDetectorReady = undefined;

async function getBarcodeDetector() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    barcodeDetectorReady = null;
    return null;
  }
  if (barcodeDetectorReady !== undefined) return barcodeDetectorReady;
  try {
    barcodeDetectorReady = new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    barcodeDetectorReady = null;
  }
  return barcodeDetectorReady;
}

function detectQrWithJsQR(video, canvas) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, JSQR_MAX_WIDTH / width);
  const targetW = Math.max(1, Math.floor(width * scale));
  const targetH = Math.max(1, Math.floor(height * scale));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return code?.data ? String(code.data) : null;
}

async function detectQrFromVideo(video, canvas) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;

  const detector = await getBarcodeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const raw = codes?.[0]?.rawValue;
      return raw ? String(raw) : null;
    } catch {
      /* fall through to jsQR */
    }
  }

  return detectQrWithJsQR(video, canvas);
}

async function openRearCamera() {
  const media = navigator.mediaDevices;
  const attempts = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
    {
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    },
    { video: true, audio: false },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      const stream = await media.getUserMedia(constraints);
      const track = stream.getVideoTracks()?.[0];
      if (track?.applyConstraints) {
        track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }],
        }).catch(() => {});
      }
      return stream;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Camera permission was denied.');
}

function formatCheckInTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailCell({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold leading-snug text-gray-900">{value || '—'}</p>
    </div>
  );
}

function GuestPassScreen({
  registration,
  photoUrl,
  verifying,
  verifyError,
  onBack,
  onVerified,
  onScanNext,
}) {
  const eventName = registration.event?.eventName || `Event #${registration.eventId}`;
  const hostName = registration.event?.hostName || '';
  const place = registration.event?.place || '—';
  const eventDate = registration.event?.eventDate || '—';
  const checkedIn = Boolean(registration.checkedInAt);
  const checkInTime = formatCheckInTime(registration.checkedInAt);
  const participantCount = registration.participantCount || 1;
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section
      aria-label="Guest entry pass"
      className="fixed inset-0 z-[80] overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 safe-top safe-bottom"
      role="status"
    >
      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-3 py-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-2xl bg-white/15 px-3 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
            Guest entry pass
          </p>
          <span className="w-16" aria-hidden="true" />
        </div>

        <div className="mt-3 shrink-0 overflow-hidden rounded-3xl border border-white/20 bg-white/12 text-white shadow-lg backdrop-blur-sm">
          <div className="border-b border-white/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
              Event
            </p>
            <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight sm:text-2xl">
              {eventName}
            </h2>
            {hostName ? (
              <p className="mt-1.5 text-sm text-white/90">
                <span className="text-white/65">Host</span>
                <span className="mx-1.5 text-white/40">·</span>
                <span className="font-semibold text-white">{hostName}</span>
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/15">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/60">Date</p>
                <p className="truncate text-sm font-semibold">{eventDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/60">Place</p>
                <p className="truncate text-sm font-semibold">{place}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white p-4 shadow-2xl">
          <div className="flex shrink-0 items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 opacity-70" aria-hidden="true" />
              {photoUrl && !photoFailed ? (
                <img
                  src={photoUrl}
                  alt={registration.name || 'Guest photo'}
                  className="relative h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <span className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-emerald-100 text-3xl font-bold text-emerald-900 shadow-lg">
                  {(registration.name || '?').slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-extrabold leading-tight text-gray-900">
                {registration.name || 'Guest'}
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-700">
                <User className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <span className="truncate">ID {registration.idNo || '—'} · {registration.level || '—'}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                <Phone className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <span className="truncate">{registration.phoneNumber || '—'}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 shrink-0 rounded-3xl bg-emerald-50 px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Entry code</p>
            <p className="mt-1 text-3xl font-bold tracking-[0.2em] text-emerald-950">
              {registration.entryCode || '—'}
            </p>
          </div>

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
            <DetailCell label="Food type" value={registration.foodType} />
            <DetailCell label="Translation" value={registration.translation} />
            <DetailCell label="PD attend city" value={registration.attendCity} />
            <DetailCell label="Your city" value={registration.yourCity} />
            <DetailCell label="Participants" value={String(participantCount)} />
            <DetailCell label="PD ticket no" value={registration.ticketNo} />
            {registration.teamIncharge?.name ? (
              <div className="col-span-2">
                <DetailCell label="Team incharge" value={registration.teamIncharge.name} />
              </div>
            ) : null}
          </div>

          <div className="mt-auto shrink-0 space-y-2 pt-3">
            {checkedIn ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Checked in
                </p>
                {checkInTime ? (
                  <p className="inline-flex items-center gap-1 text-xs text-emerald-800">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {checkInTime}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-2xl bg-amber-50 px-3 py-2.5 text-center text-sm font-semibold text-amber-900">
                Waiting for verification
              </p>
            )}

            {verifyError ? (
              <p
                className="rounded-2xl border-2 border-red-600 bg-red-100 px-3 py-2.5 text-center text-sm font-bold text-red-800"
                role="alert"
              >
                {verifyError}
              </p>
            ) : null}

            {!checkedIn ? (
              <button
                type="button"
                disabled={verifying}
                onClick={onVerified}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {verifying ? 'Verifying…' : 'Verified'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onScanNext}
                className="w-full rounded-2xl bg-emerald-800 px-4 py-3.5 text-sm font-bold text-white"
              >
                Scan next guest
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function EventCheckInPanel({ user }) {
  const [viewerUserId, setViewerUserId] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [codeEntryOpen, setCodeEntryOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);
  const codeInputRef = useRef(null);
  const lookingUpRef = useRef(false);
  const lastRejectedPayloadRef = useRef('');
  const runLookupRef = useRef(null);
  const scanLoopGenRef = useRef(0);

  const hasLiveCameraStream = () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0];
    return Boolean(track && track.readyState === 'live');
  };

  const stopScanLoop = () => {
    scanLoopGenRef.current += 1;
    if (scanTimerRef.current != null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  /** Keep stream warm between guests; only stop detect + hide preview. */
  const pauseScanningKeepStream = () => {
    stopScanLoop();
    lookingUpRef.current = false;
    lastRejectedPayloadRef.current = '';
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const stopCamera = () => {
    stopScanLoop();
    lookingUpRef.current = false;
    lastRejectedPayloadRef.current = '';
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const userId = await getUserId(user);
        if (cancelled) return;
        setViewerUserId(userId);
        if (!userId) return;
        const data = await listOpenEvents(userId);
        if (!cancelled) {
          const list = Array.isArray(data.events) ? data.events : [];
          setEvents(list);
          if (list[0]?.id) setEventId(String(list[0].id));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load events.');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => {
    stopCamera();
  }, []);

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.play().catch(() => {});
    return undefined;
  }, [cameraActive]);

  const clearGuestResult = () => {
    setResult(null);
    setEntryCode('');
    setQrPayload('');
    setError('');
    setVerifyError('');
    setVerifying(false);
  };

  const beginScanLoop = () => {
    if (!scanCanvasRef.current && typeof document !== 'undefined') {
      scanCanvasRef.current = document.createElement('canvas');
    }
    stopScanLoop();
    lookingUpRef.current = false;
    const loopGen = scanLoopGenRef.current;

    const runScanTick = async () => {
      if (loopGen !== scanLoopGenRef.current || !streamRef.current) return;

      if (!lookingUpRef.current && videoRef.current && scanCanvasRef.current) {
        try {
          const raw = await detectQrFromVideo(videoRef.current, scanCanvasRef.current);
          if (loopGen !== scanLoopGenRef.current || !streamRef.current) return;

          if (raw && raw !== lastRejectedPayloadRef.current) {
            // Single-flight: stop loop BEFORE API so one QR = one check-in.
            lookingUpRef.current = true;
            stopScanLoop();
            setQrPayload(raw);
            const ok = await runLookupRef.current?.({ payload: raw });
            if (ok) {
              lastRejectedPayloadRef.current = '';
              return;
            }
            lastRejectedPayloadRef.current = raw;
            lookingUpRef.current = false;
            if (hasLiveCameraStream()) {
              beginScanLoop();
            }
            return;
          }
        } catch {
          /* keep scanning */
        }
      }

      if (loopGen === scanLoopGenRef.current && streamRef.current) {
        scanTimerRef.current = window.setTimeout(runScanTick, SCAN_GAP_MS);
      }
    };

    scanTimerRef.current = window.setTimeout(runScanTick, 0);
  };

  const runLookup = async ({ code, payload }) => {
    if (!viewerUserId) {
      setError('Could not identify your account.');
      return false;
    }
    if (!eventId) {
      setError('Select an event first.');
      return false;
    }
    const selectedEventId = String(eventId);
    const rawPayload = String(payload || '').trim();
    const qrMatch = /^(\d+):(\d{4})$/.exec(rawPayload);
    if (qrMatch && qrMatch[1] !== selectedEventId) {
      setResult(null);
      setError('This QR belongs to a different event.');
      return false;
    }
    const resolvedCode = qrMatch ? qrMatch[2] : String(code || '').trim();
    if (qrMatch) {
      setEntryCode(qrMatch[2]);
      setQrPayload(rawPayload);
    }
    setBusy(true);
    setError('');
    setVerifyError('');
    try {
      const data = await checkInEventRegistration({
        userId: viewerUserId,
        eventId: Number(selectedEventId),
        entryCode: resolvedCode || undefined,
        qrPayload: rawPayload || undefined,
        markCheckedIn: false,
      });
      lastRejectedPayloadRef.current = '';
      pauseScanningKeepStream();
      setResult(data);
      return true;
    } catch (err) {
      setResult(null);
      setError(err?.message || 'Check-in failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  runLookupRef.current = runLookup;

  const confirmVerified = async () => {
    const registration = result?.registration;
    if (!viewerUserId || !registration) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const data = await checkInEventRegistration({
        userId: viewerUserId,
        eventId: registration.eventId,
        entryCode: registration.entryCode,
        markCheckedIn: true,
      });
      setResult(data);
    } catch (err) {
      setVerifyError(err?.message || 'Could not verify check-in.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    lastRejectedPayloadRef.current = '';
  }, [eventId]);

  useEffect(() => {
    if (!codeEntryOpen) return undefined;
    const id = window.setTimeout(() => codeInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [codeEntryOpen]);

  const openCodeEntry = () => {
    setCodeEntryOpen(true);
  };

  const onEntryCodeChange = (value) => {
    const next = String(value || '').replace(/\D/g, '').slice(0, 4);
    setEntryCode(next);
    if (next.length === 4 && !busy) {
      runLookupRef.current?.({ code: next });
    }
  };

  const startCameraScan = async () => {
    setError('');
    setCodeEntryOpen(false);
    lastRejectedPayloadRef.current = '';
    lookingUpRef.current = false;

    const armScanner = () => {
      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => {});
        }
        beginScanLoop();
      }, 80);
    };

    // Warm reuse: same live stream → instant next scan (no getUserMedia).
    if (hasLiveCameraStream()) {
      setCameraActive(true);
      armScanner();
      return;
    }

    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setError('Camera is not available on this device.');
      openCodeEntry();
      return;
    }
    try {
      stopScanLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const stream = await openRearCamera();
      streamRef.current = stream;
      setCameraActive(true);
      armScanner();
    } catch (err) {
      stopCamera();
      setError(err?.message || 'Camera permission was denied.');
      openCodeEntry();
    }
  };

  const handleScanNextGuest = () => {
    clearGuestResult();
    void startCameraScan();
  };

  const handleBackFromPass = () => {
    clearGuestResult();
    // Keep stream warm; user can Start scan instantly without reopening camera.
  };

  const registration = result?.registration;
  const photoUrl = registration?.registrantUserId
    ? buildUserAvatarUrl(getApiBaseUrl(), registration.registrantUserId, undefined, { inline: true })
    : null;

  if (registration) {
    return (
      <GuestPassScreen
        registration={registration}
        photoUrl={photoUrl}
        verifying={verifying}
        verifyError={verifyError}
        onBack={handleBackFromPass}
        onVerified={confirmVerified}
        onScanNext={handleScanNextGuest}
      />
    );
  }

  const codeDigits = Array.from({ length: 4 }, (_, i) => entryCode[i] || '');

  return (
    <section aria-label="Event check-in" className="space-y-3">
      <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="checkin-event">
          Event
        </label>
        <select
          id="checkin-event"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-base font-medium text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.eventName} · {event.eventDate}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-lg">
        <div className="relative aspect-[3/4] max-h-[420px] w-full bg-black">
          {cameraActive ? (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-900 to-slate-950 px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                <ScanLine className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="text-base font-semibold text-white">Scan guest QR</p>
              <button
                type="button"
                disabled={busy}
                onClick={startCameraScan}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 disabled:opacity-60"
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Start scan
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            <div className="relative h-48 w-48 max-w-[70%]">
              <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-white" />
              <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-white" />
              <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-white" />
              <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-white" />
            </div>
          </div>

          {cameraActive ? (
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow"
              >
                Close
              </button>
              <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white">
                Scanning…
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-3 bg-slate-950 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError('');
              openCodeEntry();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-emerald-800 shadow disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Enter code
          </button>
          {!cameraActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={startCameraScan}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Scan QR
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border-2 border-red-600 bg-red-100 px-4 py-3.5 text-sm font-bold leading-snug text-red-800 shadow-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {codeEntryOpen ? (
        <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">4-digit code</p>
              <p className="text-xs text-gray-500">Enter guest entry code</p>
            </div>
          </div>

          <label className="sr-only" htmlFor="checkin-code">
            4-digit code
          </label>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-3"
            onClick={() => codeInputRef.current?.focus()}
          >
            {codeDigits.map((digit, index) => (
              <span
                key={`digit-${index}`}
                className={`flex h-12 w-10 items-center justify-center border-b-2 text-xl font-bold tracking-widest ${
                  digit ? 'border-emerald-700 text-gray-900' : 'border-gray-300 text-transparent'
                }`}
              >
                {digit || '0'}
              </span>
            ))}
          </button>
          <input
            ref={codeInputRef}
            id="checkin-code"
            value={entryCode}
            onChange={(e) => onEntryCodeChange(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            className="sr-only"
            aria-label="4-digit entry code"
          />

          <button
            type="button"
            disabled={busy || entryCode.length !== 4}
            onClick={() => runLookup({ code: entryCode })}
            className="mt-4 w-full rounded-2xl bg-emerald-800 px-4 py-3.5 text-sm font-bold text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
