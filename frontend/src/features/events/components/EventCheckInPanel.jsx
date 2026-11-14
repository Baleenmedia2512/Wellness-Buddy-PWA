import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Flag,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ScanLine,
  ShieldCheck,
  User,
} from 'lucide-react';
import verifiedSealBadge from '../../../assets/verified-seal-badge.png';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getUserId } from '../../../shared/services/getUserId.js';
import { buildUserAvatarUrl } from '../../user/services/avatarDisplayVersion.js';
import {
  checkInEventRegistration,
  eventSpeakerNames,
  listOpenEvents,
  reportEventCheckInMisuse,
} from '../services/events.api.js';

const SCAN_GAP_MS = 50;
const JSQR_MAX_WIDTH = 480;
const NO_VENUE_LABEL = 'No venue';

function checkInEventKey(event) {
  const name = String(event?.eventName || '').trim();
  const date = String(event?.eventDate || '').trim();
  return `${name}||${date}`;
}

function checkInEventLabel(event) {
  const name = String(event?.eventName || '').trim() || `Event #${event?.id || ''}`;
  const date = String(event?.eventDate || '').trim();
  return date ? `${name} · ${date}` : name;
}

function checkInCity(event) {
  return String(event?.city || event?.place || '').trim();
}

function checkInVenue(event) {
  return String(event?.venue || '').trim();
}

/** Device-local YYYY-MM-DD for check-in Event dropdown (today only). */
function localTodayYmd() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isCheckInEventToday(event) {
  const date = String(event?.eventDate || '').trim().slice(0, 10);
  return Boolean(date) && date === localTodayYmd();
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

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
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold leading-snug text-gray-900">{value || '—'}</p>
    </div>
  );
}

function VerifiedSealBadge() {
  return (
    <img
      src={verifiedSealBadge}
      alt=""
      aria-hidden="true"
      className="h-12 w-auto shrink-0 object-contain"
    />
  );
}

function GuestPassScreen({
  registration,
  photoUrl,
  verifying,
  verifyError,
  checkInType = 'entry',
  reporting = false,
  reportMessage = '',
  reportError = '',
  onBack,
  onVerified,
  onScanNext,
  onReport,
}) {
  const isFood = checkInType === 'food';
  const eventName = registration.event?.eventName || `Event #${registration.eventId}`;
  const hostName = eventSpeakerNames(registration.event).join(', ');
  const place = registration.event?.place || '—';
  const eventDate = registration.event?.eventDate || '—';
  const entryVerified = Boolean(registration.checkedInAt);
  const foodVerified = Boolean(registration.foodCheckedInAt);
  const checkedIn = isFood ? foodVerified : entryVerified;
  const checkInTime = formatCheckInTime(
    isFood ? registration.foodCheckedInAt : registration.checkedInAt,
  );
  const entryCheckInTime = formatCheckInTime(registration.checkedInAt);
  const participantCount = registration.participantCount || 1;
  const communityId = String(
    registration.communityId || registration.idNo || '',
  ).trim();

  const formatVerifierLabel = (verifier, fallbackUserId) => {
    const name = String(verifier?.name || '').trim();
    const cid = String(verifier?.communityId || '').trim();
    if (name && cid) return `${name} · ${cid}`;
    if (name) return name;
    if (cid) return cid;
    if (fallbackUserId) return `ID ${fallbackUserId}`;
    return '';
  };

  const activeVerifier = isFood
    ? (registration.foodCheckedInBy || registration.checkedInBy)
    : (registration.entryCheckedInBy || registration.checkedInBy);
  const verifierLabel = formatVerifierLabel(
    activeVerifier,
    isFood ? registration.foodCheckedInByUserId : registration.checkedInByUserId,
  );
  const entryVerifierLabel = formatVerifierLabel(
    registration.entryCheckedInBy || (!isFood ? registration.checkedInBy : null),
    registration.checkedInByUserId,
  );
  const idealWeightProgress = registration.idealWeightProgress;
  const idealWeightReached = idealWeightProgress?.status === 'reached';
  const idealWeightLabel = String(idealWeightProgress?.label || '').trim();
  const formatKg = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toFixed(1)} kg` : '';
  };
  const idealCurrentLabel = formatKg(idealWeightProgress?.currentKg);
  const idealTargetLabel = (() => {
    if (!idealWeightProgress) return '';
    if (idealWeightReached) {
      const min = formatKg(idealWeightProgress.idealMin);
      const max = formatKg(idealWeightProgress.idealMax);
      return min && max ? `${min.replace(' kg', '')}–${max}` : '';
    }
    if (idealWeightProgress.status === 'below') {
      return formatKg(idealWeightProgress.idealMin);
    }
    return formatKg(idealWeightProgress.idealMax);
  })();
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section
      aria-label="Guest entry pass"
      className="fixed inset-0 z-[80] overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 safe-top safe-bottom"
      role="status"
    >
      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-2.5 py-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
            {isFood ? 'Guest food pass' : 'Guest entry pass'}
          </p>
          <span className="w-14" aria-hidden="true" />
        </div>

        <div className="mt-2 shrink-0 rounded-2xl border border-white/20 bg-white/12 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/90">
            Event
          </p>
          <h2 className="mt-0.5 text-base font-bold leading-snug tracking-tight">
            {eventName}
          </h2>
          {hostName ? (
            <p className="mt-0.5 truncate text-xs text-white/90">
              <span className="text-white/65">Speaker</span>
              <span className="mx-1 text-white/40">·</span>
              <span className="font-semibold text-white">{hostName}</span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/15 pt-2 text-xs font-semibold text-white">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-white/75" aria-hidden="true" />
              <span className="truncate">{eventDate}</span>
            </span>
            <span className="text-white/35" aria-hidden="true">·</span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/75" aria-hidden="true" />
              <span className="truncate">{place}</span>
            </span>
          </div>
        </div>

        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl bg-white p-3.5 shadow-2xl">
          <div className="flex items-center gap-3.5">
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
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="truncate text-xl font-extrabold leading-tight text-gray-900">
                {registration.name || 'Guest'}
              </h3>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <User className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <span className="truncate">Community ID {communityId || '—'}</span>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <Phone className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <span className="truncate">{registration.phoneNumber || '—'}</span>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <Mail className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <span className="truncate">{registration.zoomEmail || '—'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
              Ticket number
            </p>
            <p className="text-xl font-bold tracking-wide text-emerald-950">
              {registration.entryCode || registration.ticketNo || '—'}
            </p>
          </div>

          {idealWeightLabel && idealCurrentLabel ? (
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                idealWeightReached
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[9px] font-bold uppercase tracking-wide ${
                    idealWeightReached ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  Ideal Weight
                </p>
                <p
                  className={`shrink-0 text-xs font-bold ${
                    idealWeightReached ? 'text-emerald-950' : 'text-amber-950'
                  }`}
                >
                  {idealWeightLabel}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 divide-x divide-gray-200 overflow-hidden rounded-lg bg-white/90">
                <div className="px-3 py-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                    Current
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{idealCurrentLabel}</p>
                </div>
                <div className="px-3 py-2 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                    Ideal
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {idealTargetLabel || '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <DetailCell label="Food type" value={registration.foodType} />
            <DetailCell label="Translation" value={registration.translation} />
            <DetailCell label="Attending city" value={registration.attendCity} />
            <DetailCell label="Participants" value={String(participantCount)} />
            {registration.teamIncharge?.name ? (
              <div className="col-span-2">
                <DetailCell label="Team incharge" value={registration.teamIncharge.name} />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {isFood && entryVerified ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/90 px-2.5 py-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Entry status
                </p>
                <p className="mt-0.5 text-xs font-bold text-emerald-950">Entry verified</p>
                {entryVerifierLabel ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">
                    Verified by {entryVerifierLabel}
                  </p>
                ) : null}
                {entryCheckInTime ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {entryCheckInTime}
                  </p>
                ) : null}
              </div>
            ) : null}

            {checkedIn ? (
              <div className="overflow-hidden rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <VerifiedSealBadge />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-sky-600">
                      {isFood ? 'Food status' : 'Entry status'}
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold leading-tight tracking-tight text-sky-950">
                      {isFood ? 'Food successfully verified' : 'Successfully verified'}
                    </p>
                    {verifierLabel ? (
                      <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-600">
                        <span className="text-sky-700">Verified by</span>
                        {' '}
                        {verifierLabel}
                      </p>
                    ) : null}
                    {checkInTime ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100/90 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {checkInTime}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : isFood && !entryVerified ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-center text-xs font-semibold leading-snug text-amber-950">
                Complete Entry check-in first. Food can be verified only after Entry is verified.
              </p>
            ) : (
              <p className="rounded-xl bg-amber-50 px-2.5 py-2 text-center text-xs font-semibold text-amber-900">
                {isFood ? 'Waiting for food verification' : 'Waiting for verification'}
              </p>
            )}

            {verifyError ? (
              <p
                className="rounded-xl border-2 border-red-600 bg-red-100 px-2.5 py-2 text-center text-xs font-bold text-red-800"
                role="alert"
              >
                {verifyError}
              </p>
            ) : null}

            {!isFood && reportError ? (
              <p
                className="rounded-xl border border-red-300 bg-red-50 px-2.5 py-1.5 text-center text-xs font-semibold text-red-800"
                role="alert"
              >
                {reportError}
              </p>
            ) : null}
            {!isFood && reportMessage ? (
              <p
                className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs font-semibold text-amber-950"
                role="status"
              >
                {reportMessage}
              </p>
            ) : null}

            {!checkedIn ? (
              <button
                type="button"
                disabled={verifying || reporting || (isFood && !entryVerified)}
                onClick={onVerified}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {verifying ? 'Verifying…' : 'Verified'}
              </button>
            ) : (
              <button
                type="button"
                disabled={reporting}
                onClick={onScanNext}
                className="w-full rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Scan next guest
              </button>
            )}

            {!isFood ? (
              <button
                type="button"
                disabled={reporting || verifying}
                onClick={onReport}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-900 disabled:opacity-60"
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                {reporting ? 'Reporting…' : 'Report'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function EventCheckInPanel({ user }) {
  const [viewerUserId, setViewerUserId] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventKey, setSelectedEventKey] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [eventId, setEventId] = useState('');
  const [checkInType, setCheckInType] = useState('entry');
  const [entryCode, setEntryCode] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [codeEntryOpen, setCodeEntryOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);
  const codeInputRef = useRef(null);
  const errorBannerRef = useRef(null);
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
          // Check-in only: Event dropdown shows today's events. Open-events API unchanged.
          const list = (Array.isArray(data.events) ? data.events : []).filter(isCheckInEventToday);
          setEvents(list);
          const first = list[0];
          if (first) {
            setSelectedEventKey(checkInEventKey(first));
            setSelectedCity(checkInCity(first));
            setSelectedVenue(checkInVenue(first));
            setEventId(String(first.id));
          } else {
            setSelectedEventKey('');
            setSelectedCity('');
            setSelectedVenue('');
            setEventId('');
          }
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

  // Keep every check-in error in view (wrong QR, no event, camera, etc.) — display only.
  useEffect(() => {
    if (!error) return undefined;
    const node = errorBannerRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return undefined;
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return undefined;
  }, [error]);

  const clearGuestResult = () => {
    setResult(null);
    setEntryCode('');
    setQrPayload('');
    setError('');
    setVerifyError('');
    setVerifying(false);
    setReporting(false);
    setReportError('');
    setReportMessage('');
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
    const qrMatch = /^(\d+):(.+)$/.exec(rawPayload);
    if (qrMatch && qrMatch[1] !== selectedEventId) {
      setResult(null);
      setError('This QR belongs to a different event.');
      return false;
    }
    const resolvedCode = qrMatch ? String(qrMatch[2] || '').trim() : String(code || '').trim();
    if (qrMatch) {
      setEntryCode(resolvedCode);
      setQrPayload(rawPayload);
    }
    setBusy(true);
    setError('');
    setVerifyError('');
    setReportError('');
    setReportMessage('');
    try {
      const data = await checkInEventRegistration({
        userId: viewerUserId,
        eventId: Number(selectedEventId),
        entryCode: resolvedCode || undefined,
        qrPayload: rawPayload || undefined,
        checkInType,
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
        checkInType,
        markCheckedIn: true,
      });
      setResult(data);
    } catch (err) {
      setVerifyError(err?.message || 'Could not verify check-in.');
    } finally {
      setVerifying(false);
    }
  };

  const reportMisuse = async () => {
    const registration = result?.registration;
    if (!viewerUserId || !registration || checkInType !== 'entry') return;
    setReporting(true);
    setReportError('');
    setReportMessage('');
    try {
      const data = await reportEventCheckInMisuse({
        userId: viewerUserId,
        eventId: registration.eventId,
        entryCode: registration.entryCode,
      });
      setReportMessage(data?.message || 'Report sent to guest and coach.');
    } catch (err) {
      setReportError(err?.message || 'Could not send report.');
    } finally {
      setReporting(false);
    }
  };

  useEffect(() => {
    lastRejectedPayloadRef.current = '';
  }, [eventId]);

  const eventOptions = useMemo(() => {
    const byKey = new Map();
    for (const event of events) {
      const key = checkInEventKey(event);
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        key,
        label: checkInEventLabel(event),
      });
    }
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const cityOptions = useMemo(() => {
    if (!selectedEventKey) return [];
    return uniqueSorted(
      events
        .filter((event) => checkInEventKey(event) === selectedEventKey)
        .map((event) => checkInCity(event)),
    );
  }, [events, selectedEventKey]);

  const venueOptions = useMemo(() => {
    if (!selectedEventKey || !selectedCity) return [];
    const venues = events
      .filter(
        (event) =>
          checkInEventKey(event) === selectedEventKey
          && checkInCity(event) === selectedCity,
      )
      .map((event) => checkInVenue(event));
    const named = uniqueSorted(venues.filter(Boolean));
    const hasBlank = venues.some((venue) => !venue);
    return hasBlank ? [...named, ''] : named;
  }, [events, selectedEventKey, selectedCity]);

  useEffect(() => {
    if (!selectedEventKey) {
      setEventId('');
      return;
    }
    const match = events.find(
      (event) =>
        checkInEventKey(event) === selectedEventKey
        && checkInCity(event) === selectedCity
        && checkInVenue(event) === selectedVenue,
    );
    setEventId(match?.id != null ? String(match.id) : '');
  }, [events, selectedEventKey, selectedCity, selectedVenue]);

  const onEventKeyChange = (nextKey) => {
    setSelectedEventKey(nextKey);
    const forEvent = events.filter((event) => checkInEventKey(event) === nextKey);
    const nextCity = checkInCity(forEvent[0]) || '';
    const forCity = forEvent.filter((event) => checkInCity(event) === nextCity);
    setSelectedCity(nextCity);
    setSelectedVenue(checkInVenue(forCity[0]) || '');
    clearGuestResult();
  };

  const onCityChange = (nextCity) => {
    setSelectedCity(nextCity);
    const forCity = events.filter(
      (event) =>
        checkInEventKey(event) === selectedEventKey
        && checkInCity(event) === nextCity,
    );
    setSelectedVenue(checkInVenue(forCity[0]) || '');
    clearGuestResult();
  };

  const onVenueChange = (nextVenue) => {
    setSelectedVenue(nextVenue);
    clearGuestResult();
  };

  useEffect(() => {
    if (!codeEntryOpen) return undefined;
    const id = window.setTimeout(() => codeInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [codeEntryOpen]);

  const openCodeEntry = () => {
    setCodeEntryOpen(true);
  };

  const onEntryCodeChange = (value) => {
    const next = String(value || '').replace(/:/g, '').slice(0, 80);
    setEntryCode(next);
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
        checkInType={checkInType}
        reporting={reporting}
        reportMessage={reportMessage}
        reportError={reportError}
        onBack={handleBackFromPass}
        onVerified={confirmVerified}
        onScanNext={handleScanNextGuest}
        onReport={reportMisuse}
      />
    );
  }

  const filterSelectClass =
    'mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm font-medium text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60';

  return (
    <section aria-label="Event check-in" className="space-y-2">
      <div className="flex rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setCheckInType('entry');
            clearGuestResult();
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
            checkInType === 'entry'
              ? 'bg-emerald-800 text-white'
              : 'bg-transparent text-emerald-900'
          }`}
        >
          Scan for Tag
        </button>
        <button
          type="button"
          onClick={() => {
            setCheckInType('food');
            clearGuestResult();
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
            checkInType === 'food'
              ? 'bg-emerald-800 text-white'
              : 'bg-transparent text-emerald-900'
          }`}
        >
          Scan for Food
        </button>
      </div>

      {error ? (
        <div
          ref={errorBannerRef}
          className="rounded-xl border-2 border-red-600 bg-red-100 px-3 py-2 text-sm font-bold leading-snug text-red-800 shadow-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-emerald-100 bg-white px-3 py-2 shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="checkin-event">
            Event
          </label>
          <select
            id="checkin-event"
            value={selectedEventKey}
            onChange={(e) => onEventKeyChange(e.target.value)}
            className={filterSelectClass}
          >
            {eventOptions.length === 0 ? (
              <option value="">No events today</option>
            ) : null}
            {eventOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="checkin-city">
              City
            </label>
            <select
              id="checkin-city"
              value={selectedCity}
              disabled={!selectedEventKey || cityOptions.length === 0}
              onChange={(e) => onCityChange(e.target.value)}
              className={filterSelectClass}
            >
              {cityOptions.length === 0 ? (
                <option value="">Select event first</option>
              ) : null}
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500" htmlFor="checkin-venue">
              Venue
            </label>
            <select
              id="checkin-venue"
              value={selectedVenue}
              disabled={!selectedCity || venueOptions.length === 0}
              onChange={(e) => onVenueChange(e.target.value)}
              className={filterSelectClass}
            >
              {venueOptions.length === 0 ? (
                <option value="">Select city first</option>
              ) : null}
              {venueOptions.map((venue) => (
                <option key={venue || '__none__'} value={venue}>
                  {venue || NO_VENUE_LABEL}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-lg">
        <div className="relative aspect-[4/3] max-h-[280px] w-full bg-black">
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

      {codeEntryOpen ? (
        <div className="rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">Ticket number</p>
              <p className="text-xs text-gray-500">Enter guest ticket number</p>
            </div>
          </div>

          <label className="sr-only" htmlFor="checkin-code">
            Ticket number
          </label>
          <input
            ref={codeInputRef}
            id="checkin-code"
            value={entryCode}
            onChange={(e) => onEntryCodeChange(e.target.value)}
            autoComplete="off"
            maxLength={80}
            className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base font-semibold tracking-wide text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            aria-label="Guest ticket number"
            placeholder="Ticket number"
          />

          <button
            type="button"
            disabled={busy || !String(entryCode || '').trim()}
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
