import React, { useState, useRef, useEffect } from 'react';

/**
 * TouchFeedbackButton - Material Design touch feedback for mobile and web
 * 
 * Provides smooth touch feedback animation for buttons on all platforms.
 * Features:
 * - Ripple effect on tap/click
 * - Scale animation on press
 * - Opacity change for visual feedback
 * - Lightweight and reusable
 * - Works on mobile (Android/iOS) and web browsers
 * - Follows Material Design guidelines
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {Function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.ariaLabel - Accessibility label
 */
const TouchFeedbackButton = ({ 
  children, 
  onClick, 
  className = '', 
  ariaLabel,
  ...rest 
}) => {
  const [ripples, setRipples] = useState([]);
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef(null);

  // Cleanup ripples after animation completes
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples([]);
      }, 600); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  const createRipple = (event) => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    
    // Calculate ripple position
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate ripple size (diagonal of button for full coverage)
    const size = Math.max(rect.width, rect.height) * 2;

    const newRipple = {
      x,
      y,
      size,
      id: Date.now(),
    };

    setRipples([newRipple]);
  };

  const handleTouchStart = (e) => {
    // ACTION_DOWN - Start animation
    setIsPressed(true);
    
    // Get touch position for ripple
    const touch = e.touches[0];
    createRipple(touch);
    
    // Haptic feedback on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch (err) {
        // Ignore vibration errors
      }
    }
  };

  const handleTouchEnd = () => {
    // ACTION_UP - Reset animation
    setIsPressed(false);
  };

  const handleTouchCancel = () => {
    // ACTION_CANCEL - Reset animation
    setIsPressed(false);
  };

  const handleMouseDown = (e) => {
    setIsPressed(true);
    createRipple(e);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-all duration-150 ${className} ${
        isPressed ? 'scale-[0.92] brightness-95' : 'scale-100 brightness-100'
      }`}
      style={{
        transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      aria-label={ariaLabel}
      {...rest}
    >
      {/* Button content */}
      {children}
      
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
            animation: 'ripple-animation 600ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
      
      {/* Press overlay effect */}
      {isPressed && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            pointerEvents: 'none',
            animation: 'fade-in 150ms ease-out',
          }}
        />
      )}
      
      {/* Ripple animation keyframes */}
      <style>{`
        @keyframes ripple-animation {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </button>
  );
};

export default TouchFeedbackButton;
