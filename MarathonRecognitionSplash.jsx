/**
 * MarathonRecognitionSplash.jsx
 *
 * Full-screen recognition splash â€” reuses MarathonLeaderCard with fullScreen={true}.
 * The card fills the screen; this component only adds:
 *   â€¢ progress dots (multiple marathons)
 *   â€¢ auto-advance timer
 *   â€¢ "Tap to continue" footer
 *
 * Props:
 *   recognitions  {Array}    â€” from useMarathon.pendingRecognition
 *   onComplete    {function} â€” called after all slides are dismissed
 *   onDismiss     {function} â€” kept for API compat
 */
import React, { useState, useEffect, useCallback } from 'react';
import MarathonLeaderCard from './MarathonLeaderCard.jsx';

function buildSlides(recognition) {
  const slides = [];
  if (!recognition) return slides;
  const { marathonName, lapNumber, dayNumber, dayLeader, lapLeader, communityLeader } = recognition;
  const base = { marathonName, lapNumber, dayNumber };

  if (dayLeader) {
    slides.push({
      cardType: 'day_leader', ...base,
      dayLeader: {
        ...dayLeader,
        dailyChangeDisplay: dayLeader.dailyChangeDisplay
          || (dayLeader.reductionKg ? `-${Number(dayLeader.reductionKg).toFixed(2)} KG` : 'â€”'),
      },
    });
  }
  if (lapLeader) {
    slides.push({
      cardType: 'lap_leader', ...base,
      lapLeader: {
        ...lapLeader,
        lapChangeDisplay: lapLeader.lapChangeDisplay
          || (lapLeader.reductionKg ? `-${Number(lapLeader.reductionKg).toFixed(2)} KG` : 'â€”'),
      },
    });
  }
  if (communityLeader) {
    slides.push({
      cardType: 'community_leader', ...base,
      lapLeader: {
        ...communityLeader,
        lapChangeDisplay: communityLeader.lapChangeDisplay
          || (communityLeader.reductionKg ? `-${Number(communityLeader.reductionKg).toFixed(2)} KG` : 'â€”'),
      },
    });
  }
  return slides;
}

const MarathonRecognitionSplash = ({ recognitions = [], onComplete }) => {
  const [recIdx,   setRecIdx]   = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);

  const currentRec   = recognitions[recIdx];
  const slides       = buildSlides(currentRec);
  const currentSlide = slides[slideIdx];
  const isLastSlide  = slideIdx >= slides.length - 1;
  const isLastRec    = recIdx  >= recognitions.length - 1;

  const advance = useCallback(() => {
    if (!isLastSlide) {
      setSlideIdx(s => s + 1);
    } else if (!isLastRec) {
      setRecIdx(r => r + 1);
      setSlideIdx(0);
    } else {
      onComplete && onComplete(
        recognitions.map(r => ({ marathonId: r.marathonId, resultDate: r.resultDate })),
      );
    }
  }, [isLastSlide, isLastRec, onComplete, recognitions]);

  // Auto-advance after 8 s. Guard: only when a slide is actually visible.
  useEffect(() => {
    if (!currentSlide) return;
    const timer = setTimeout(advance, 8000);
    return () => clearTimeout(timer);
  }, [advance, slideIdx, recIdx, currentSlide]);

  if (!recognitions.length || !currentRec || !currentSlide) return null;

  const totalSlides   = recognitions.reduce((s, r) => s + buildSlides(r).length, 0);
  const currentGlobal = recognitions
    .slice(0, recIdx)
    .reduce((s, r) => s + buildSlides(r).length, 0) + slideIdx;

  return (
    <div
      onClick={advance}
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        9999,
        display:       'flex',
        flexDirection: 'column',
        cursor:        'pointer',
        WebkitTapHighlightColor: 'transparent',
        paddingTop:    'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Progress dots â€” absolute-overlaid so they don't affect card layout */}
      {totalSlides > 1 && (
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 10px)',
          left: 0, right: 0,
          zIndex: 10000,
          display: 'flex', justifyContent: 'center', gap: 6,
          pointerEvents: 'none',
        }}>
          {Array.from({ length: totalSlides }, (_, i) => (
            <div key={i} style={{
              width:      i === currentGlobal ? 22 : 6,
              height:     6,
              borderRadius: 3,
              background: i === currentGlobal
                ? 'rgba(255,255,255,0.95)'
                : 'rgba(255,255,255,0.35)',
              transition: 'width 0.3s',
            }} />
          ))}
        </div>
      )}

      {/* The card fills all available space between safe-area edges */}
      <MarathonLeaderCard card={currentSlide} fullScreen={true} />

      {/* Tap to continue â€” anchored below the card's white sheet */}
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        paddingTop: 12, paddingBottom: 16,
        borderTop: '1px solid #f0f0f0',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#9ca3af',
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          Tap to continue
        </span>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>â€º</span>
      </div>
    </div>
  );
};

export default MarathonRecognitionSplash;
