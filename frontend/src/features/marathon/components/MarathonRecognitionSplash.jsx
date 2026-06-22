/**
 * MarathonRecognitionSplash.jsx
 *
 * Full-screen splash sequence shown once per day after discipline window closes.
 * Shows in order: Day Leader → Lap Leader → Community Leader.
 *
 * Behavior:
 *   - If online: shown immediately when user opens app and pending recognition exists.
 *   - If offline: deferred to next login (controlled by parent via `recognitions` prop).
 *   - After all slides dismissed: calls `onComplete` (which triggers markRecognitionViewed).
 *
 * Props:
 *   recognitions  {Array}    — from useMarathon.pendingRecognition
 *   onComplete    {function} — called after user dismisses all slides
 *   onDismiss     {function} — called immediately if user taps "Skip"
 */
import React, { useState, useEffect, useCallback } from 'react';
import MarathonLeaderCard from './MarathonLeaderCard.jsx';

// Build the slides array from a recognition object
function buildSlides(recognition) {
  const slides = [];
  if (!recognition) return slides;
  const { marathonName, lapNumber, dayNumber, dayLeader, lapLeader, communityLeader } = recognition;
  const base = { marathonName, lapNumber, dayNumber };

  if (dayLeader) {
    slides.push({
      cardType: 'day_leader',
      ...base,
      dayLeader: { ...dayLeader, dailyChangeDisplay: dayLeader.dailyChangeDisplay || `${dayLeader.reductionKg ? `-${Number(dayLeader.reductionKg).toFixed(2)} KG` : '—'}` },
    });
  }
  if (lapLeader) {
    slides.push({
      cardType: 'lap_leader',
      ...base,
      lapLeader: { ...lapLeader, lapChangeDisplay: lapLeader.lapChangeDisplay || `${lapLeader.reductionKg ? `-${Number(lapLeader.reductionKg).toFixed(2)} KG` : '—'}` },
    });
  }
  if (communityLeader) {
    slides.push({
      cardType: 'community_leader',
      ...base,
      lapLeader: { ...communityLeader, lapChangeDisplay: communityLeader.lapChangeDisplay || `${communityLeader.reductionKg ? `-${Number(communityLeader.reductionKg).toFixed(2)} KG` : '—'}` },
    });
  }
  return slides;
}

const MarathonRecognitionSplash = ({ recognitions = [], onComplete, onDismiss }) => {
  const [recIdx,   setRecIdx]   = useState(0); // which recognition (marathon)
  const [slideIdx, setSlideIdx] = useState(0); // which slide within that recognition

  const currentRec    = recognitions[recIdx];
  const slides        = buildSlides(currentRec);
  const currentSlide  = slides[slideIdx];
  const isLastSlide   = slideIdx >= slides.length - 1;
  const isLastRec     = recIdx  >= recognitions.length - 1;

  const advance = useCallback(() => {
    if (!isLastSlide) {
      setSlideIdx(s => s + 1);
    } else if (!isLastRec) {
      setRecIdx(r => r + 1);
      setSlideIdx(0);
    } else {
      onComplete && onComplete(recognitions.map(r => ({ marathonId: r.marathonId, resultDate: r.resultDate })));
    }
  }, [isLastSlide, isLastRec, onComplete, recognitions]);

  // Auto-dismiss after 6 seconds if no interaction.
  // Guard: only start the timer when there is a visible slide — if currentSlide
  // is undefined (all leaders are null / no slides built) the component renders
  // null and we must NOT auto-dismiss, otherwise onComplete fires silently and
  // markRecognitionViewed writes a DB row the user never saw.
  useEffect(() => {
    if (!currentSlide) return;
    const timer = setTimeout(advance, 6000);
    return () => clearTimeout(timer);
  }, [advance, slideIdx, recIdx, currentSlide]);

  if (!recognitions.length || !currentRec || !currentSlide) return null;

  const totalSlides   = recognitions.reduce((s, r) => s + buildSlides(r).length, 0);
  const currentGlobal = recognitions.slice(0, recIdx).reduce((s, r) => s + buildSlides(r).length, 0) + slideIdx;

  return (
    <div
      onClick={advance}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        background:     'rgba(0,0,0,0.92)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '20px 16px 32px',
        cursor:         'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {Array.from({ length: totalSlides }, (_, i) => (
          <div key={i} style={{
            width: i === currentGlobal ? 20 : 6,
            height: 6, borderRadius: 3,
            background: i === currentGlobal ? '#fff' : 'rgba(255,255,255,0.3)',
            transition: 'width 0.3s',
          }} />
        ))}
      </div>

      {/* Card */}
      <div style={{ maxWidth: 400, width: '100%' }}>
        <MarathonLeaderCard card={currentSlide} />
      </div>

      {/* Tap hint */}
      <div style={{
        marginTop: 20, color: 'rgba(255,255,255,0.55)',
        fontSize: 12, fontWeight: 600, letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        Tap to continue
      </div>

      {/* Skip */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss && onDismiss(); }}
        style={{
          marginTop: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.40)', fontSize: 12, padding: '8px 16px',
        }}
      >
        Skip
      </button>
    </div>
  );
};

export default MarathonRecognitionSplash;
