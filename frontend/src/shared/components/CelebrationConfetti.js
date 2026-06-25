/**
 * CelebrationConfetti.js — Full-screen celebration animation.
 *
 * Shows a dramatic full-screen celebration (like Subway Surfer high score)
 * when triggered (e.g., weight progress). Auto-dismisses after animation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Celebratory musical sequence (more notes for dramatic effect)
const playCelebrationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Victory fanfare: C5-E5-G5-C6 ascending
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      
      const now = audioContext.currentTime;
      const startTime = now + (index * 0.15);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.5);
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
    console.log('🎉 [CelebrationConfetti] useEffect triggered, show:', show, 'message:', message);
    if (!show) return;

    console.log('🎉 [CelebrationConfetti] SHOWING celebration! Playing sound and initializing confetti...');
    
    // Play celebration sound
    if (playSound) {
      playCelebrationSound();
    }

    // Initialize confetti particles (MORE for dramatic effect!)
    const particles = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#fbbf24', '#fb923c'];
    const particleCount = 100; // Double the confetti!

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
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer"
        onClick={onComplete}
        style={{ touchAction: 'auto' }}
      >
        {/* Dark overlay background - like Subway Surfer's score screen */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900"
        />

        {/* Confetti canvas - behind the content */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Main celebration content - zooms in dramatically */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotateZ: -10 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            rotateZ: 0,
            y: [0, -20, 0] // Bounce effect
          }}
          exit={{ scale: 0.8, opacity: 0, y: -100 }}
          transition={{
            type: 'spring',
            stiffness: 180,
            damping: 12,
            y: {
              repeat: 2,
              duration: 0.6,
              ease: 'easeInOut'
            }
          }}
          className="relative z-10 text-center px-6 max-w-md"
        >
          {/* Trophy/Star icon with glow */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ 
              scale: 1, 
              rotate: 0,
            }}
            transition={{
              delay: 0.2,
              type: 'spring',
              stiffness: 200,
              damping: 10,
            }}
            className="mb-6"
          >
            <div className="relative inline-block">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl opacity-60 animate-pulse" />
              {/* Trophy emoji */}
              <div className="relative text-8xl filter drop-shadow-2xl">
                🏆
              </div>
            </div>
          </motion.div>

          {/* "NEW RECORD" style heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 uppercase tracking-wider mb-2"
                style={{ 
                  textShadow: '0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 165, 0, 0.5)',
                  WebkitTextStroke: '2px rgba(255, 255, 255, 0.3)'
                }}>
              Amazing!
            </h2>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 rounded-full" />
          </motion.div>

          {/* Main message with glowing box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl px-8 py-6 border-4 border-yellow-400 relative overflow-hidden"
          >
            {/* Animated shine effect */}
            <motion.div
              animate={{
                x: ['-200%', '200%'],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: 'linear',
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{ width: '50%' }}
            />
            
            <p className="text-2xl font-bold text-gray-800 relative z-10">
              {message}
            </p>
          </motion.div>

          {/* Stars decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-4xl"
          >
            ⭐ ✨ ⭐
          </motion.div>

          {/* Tap to continue hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              delay: 2,
              repeat: Infinity,
              duration: 1.5,
              ease: 'easeInOut'
            }}
            className="mt-8 text-white/80 text-sm font-medium"
          >
            Tap to continue
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CelebrationConfetti;
