/**
 * CelebrationConfetti.js — Celebration confetti animation.
 *
 * Shows a joyful party burst with confetti when triggered (e.g., weight progress).
 * Auto-dismisses after animation completes. Pure presentational component.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple celebration sound using Web Audio API
const playCelebrationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - happy major chord
    
    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      const now = audioContext.currentTime;
      const startTime = now + (index * 0.1);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.4);
    });
  } catch (error) {
    // Silently fail if audio context is not supported
    // eslint-disable-next-line no-console -- non-critical feature degradation
    console.warn('Audio context not supported:', error);
  }
};

const CelebrationConfetti = ({ show, onComplete, message = '🎉 Great Progress!', playSound = true }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [confettiParticles, setConfettiParticles] = useState([]);

  useEffect(() => {
    if (!show) return;

    // Play celebration sound
    if (playSound) {
      playCelebrationSound();
    }

    // Initialize confetti particles
    const particles = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: -20,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        shape: Math.random() > 0.5 ? 'circle' : 'square',
        opacity: 1,
      });
    }

    setConfettiParticles(particles);

    // Auto-complete after animation duration
    const timeout = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [show, onComplete]);

  useEffect(() => {
    if (!show || confettiParticles.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [...confettiParticles];
    let animationFrameId;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.map((p) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vy += 0.2; // gravity
        p.vx *= 0.99; // air resistance

        // Fade out as it falls
        if (p.y > canvas.height * 0.7) {
          p.opacity -= 0.02;
        }

        // Draw particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        ctx.restore();

        return p;
      }).filter(p => p.opacity > 0 && p.y < canvas.height + 50);

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();
    animationRef.current = animationFrameId;

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [show, confettiParticles]);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 pointer-events-none"
        style={{ touchAction: 'none' }}
      >
        {/* Confetti canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Celebration message */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 100 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -50 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
          }}
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl px-8 py-6 border-4 border-green-400">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                className="text-6xl mb-2"
              >
                🎉
              </motion.div>
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-green-600 mb-1"
              >
                Amazing!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-gray-700 font-medium"
              >
                {message}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CelebrationConfetti;
