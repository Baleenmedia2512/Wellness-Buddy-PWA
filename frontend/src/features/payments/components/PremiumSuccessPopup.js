import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const BLASTER_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#fbbf24', '#22c55e'];

/**
 * Two party poppers, from the lower corners, for the success popup only.
 * The popup itself stays until Okay.
 */
function PartyBlaster() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const reduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const paint = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };
    let { width, height } = paint();

    const origins = [
      { x: width * 0.12, y: height * 0.78, direction: 1 },
      { x: width * 0.88, y: height * 0.78, direction: -1 },
    ];
    const pieces = [];
    origins.forEach((origin) => {
      for (let i = 0; i < 55; i += 1) {
        const upward = -Math.PI / 2;
        const spread = (Math.random() * 0.95) * (Math.PI / 3) * origin.direction;
        const angle = upward + spread;
        const speed = 9 + Math.random() * 8;
        pieces.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          spin: (Math.random() - 0.5) * 16,
          rotation: Math.random() * 360,
          color: BLASTER_COLORS[i % BLASTER_COLORS.length],
          w: 5 + Math.random() * 7,
          h: 8 + Math.random() * 10,
          opacity: 1,
          circle: Math.random() > 0.65,
        });
      }
    });

    let frame = 0;
    const started = performance.now();
    const tick = (now) => {
      ({ width, height } = paint());
      ctx.clearRect(0, 0, width, height);
      const fading = now - started > 1100;
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.22;
        piece.vx *= 0.992;
        piece.rotation += piece.spin;
        if (fading) piece.opacity -= 0.018;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate((piece.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, piece.opacity);
        ctx.fillStyle = piece.color;
        if (piece.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, piece.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        }
        ctx.restore();
      });
      if (now - started < 2600 && pieces.some((piece) => piece.opacity > 0)) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="premium-party-blaster"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}

/**
 * One-time popup after Cashfree payment is confirmed.
 * Closes only when the member taps Okay.
 */
export default function PremiumSuccessPopup({ onOkay }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onOkay?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOkay]);

  const popup = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-success-title"
    >
      <PartyBlaster />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
          <Check className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
        </div>
        <h2 id="premium-success-title" className="mt-5 text-xl font-bold text-gray-900">
          Payment Successful
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          You are now a Premium Member
        </p>
        <TouchFeedbackButton
          onClick={onOkay}
          ariaLabel="Okay"
          className="mt-6 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white"
        >
          Okay
        </TouchFeedbackButton>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return popup;
  return createPortal(popup, document.body);
}
