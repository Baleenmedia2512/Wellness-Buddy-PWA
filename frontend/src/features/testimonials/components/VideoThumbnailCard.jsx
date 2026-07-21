/**
 * VideoThumbnailCard.jsx
 * Renders a video slot as a tappable thumbnail with a play-button overlay.
 *
 * Thumbnail is generated client-side by seeking a hidden <video> element to
 * frame 0 and drawing it onto a <canvas>. Falls back to a dark placeholder
 * with a Play icon when capture fails or the URL is unavailable.
 *
 * Tapping the thumbnail opens VideoPlayerModal (full-screen playback).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Play, Video, X } from 'lucide-react';

// ─── Full-screen player (reused from CoachTestimonialsPage pattern) ───────────

function VideoPlayerModal({ url, title, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {/* autoplay blocked — user will tap play */});
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-black flex flex-col"
      role="dialog"
      aria-label={`Playing ${title}`}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white text-sm font-semibold truncate flex-1">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          aria-label="Close video"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="flex-1 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          autoPlay
          className="max-h-full max-w-full object-contain rounded-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        />
      </div>
      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
    </div>
  );
}

// ─── Thumbnail generator ──────────────────────────────────────────────────────

/**
 * Capture the first displayable frame of a video as a data-URL.
 * Returns null when the operation fails (CORS, codec, permission).
 * @param {string} url
 * @returns {Promise<string|null>}
 */
function captureVideoThumbnail(url) {
  return new Promise((resolve) => {
    const video  = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    let done     = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      video.pause();
      video.src = '';
      video.load();
      resolve(result);
    };

    video.crossOrigin  = 'anonymous';
    video.muted        = true;
    video.playsInline  = true;
    video.preload      = 'metadata';

    video.addEventListener('loadeddata', () => {
      try {
        canvas.width  = video.videoWidth  || 320;
        canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.75));
      } catch {
        finish(null);
      }
    });

    video.addEventListener('error', () => finish(null));

    // Safety timeout — avoid hanging indefinitely
    setTimeout(() => finish(null), 6000);

    video.src = url;
    video.load();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {string}  props.url          - Signed video URL
 * @param {string}  props.label        - Accessible label, shown in player header
 * @param {string}  [props.accentColor]- Tailwind bg class for the play button (e.g. 'bg-green-600')
 * @param {string}  [props.className]  - Extra wrapper classes
 * @param {boolean} [props.compact]    - If true, renders as a small inline pill instead of a card
 * @param {string}  [props.localPreviewUrl] - Object URL for a locally-selected file (pre-upload)
 */
export default function VideoThumbnailCard({
  url,
  label,
  accentColor = 'bg-green-600',
  className = '',
  compact = false,
  localPreviewUrl = null,
}) {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [playing,   setPlaying]   = useState(false);

  const videoUrl = localPreviewUrl || url;

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setThumbnail(null);

    captureVideoThumbnail(videoUrl).then((dataUrl) => {
      if (!cancelled) {
        setThumbnail(dataUrl);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [videoUrl]);

  if (!videoUrl) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] text-gray-400 font-medium">
          <Video className="h-3 w-3 shrink-0" /> {label} · not uploaded
        </span>
      );
    }
    return null;
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm hover:shadow transition-all active:scale-95 ${className}`}
          style={{ width: 80, height: 56 }}
          aria-label={`Play ${label}`}
        >
          {thumbnail ? (
            <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-gray-800" />
          )}
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className={`w-6 h-6 rounded-full ${accentColor} flex items-center justify-center shadow`}>
              <Play className="h-3 w-3 text-white fill-white ml-0.5" />
            </div>
          </div>
        </button>
        {playing && <VideoPlayerModal url={videoUrl} title={label} onClose={() => setPlaying(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={`relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group ${className}`}
        style={{ aspectRatio: '16/9' }}
        aria-label={`Play ${label}`}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:brightness-75 transition-all"
          />
        )}
        {!thumbnail && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="h-8 w-8 text-white/40" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full ${accentColor} bg-opacity-90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* Label bar */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-[11px] font-semibold truncate">{label}</p>
        </div>
      </button>
      {playing && <VideoPlayerModal url={videoUrl} title={label} onClose={() => setPlaying(false)} />}
    </>
  );
}
