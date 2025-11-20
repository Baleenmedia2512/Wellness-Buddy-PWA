// src/components/LazyLoad.js
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * LazyLoad Component - Bidirectional Viewport Detection
 * 
 * Triggers visibility state when element enters/exits viewport from ANY direction.
 * Does NOT disconnect observer - allows repeated triggering on scroll up/down.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render when visible
 * @param {React.ReactNode} props.placeholder - Loading placeholder (optional)
 * @param {string} props.rootMargin - Observer root margin (default: "50px")
 * @param {number} props.threshold - Observer threshold (default: 0.01)
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onVisibilityChange - Callback when visibility changes
 */
const LazyLoad = ({
  children,
  placeholder = null,
  rootMargin = '50px',
  threshold = 0.01,
  className = '',
  onVisibilityChange = null,
  height = 'auto',
  minHeight = null
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Create IntersectionObserver
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // ✅ KEY FIX: Update visibility on EVERY intersection change
          // This allows bidirectional triggering (up and down)
          const visible = entry.isIntersecting;
          
          setIsVisible(visible);
          
          // Optional callback for parent components
          if (onVisibilityChange) {
            onVisibilityChange(visible);
          }

          // Debug logging (remove in production if needed)
          if (process.env.NODE_ENV === 'development') {
            console.log('LazyLoad visibility changed:', {
              visible,
              direction: entry.boundingClientRect.top > 0 ? 'from-top' : 'from-bottom',
              intersectionRatio: entry.intersectionRatio
            });
          }
        });
      },
      {
        root: null, // Use viewport as root
        rootMargin, // Load slightly before entering viewport
        threshold // Trigger when this % of element is visible
      }
    );

    // Start observing
    observerRef.current.observe(element);

    // ✅ CRITICAL: Cleanup on unmount (but NOT on visibility change)
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [rootMargin, threshold, onVisibilityChange]);

  // Container style to maintain layout stability
  const containerStyle = {
    minHeight: minHeight || (height !== 'auto' ? height : undefined),
    height: height !== 'auto' ? height : undefined,
  };

  return (
    <div 
      ref={elementRef} 
      className={`lazy-load-container ${className}`}
      style={containerStyle}
      data-visible={isVisible}
    >
      {isVisible ? children : (placeholder || <DefaultPlaceholder height={height} />)}
    </div>
  );
};

/**
 * Default Loading Placeholder
 */
const DefaultPlaceholder = ({ height }) => (
  <div 
    className="lazy-load-placeholder"
    style={{ 
      height: height !== 'auto' ? height : '100px',
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '8px'
    }}
  />
);

LazyLoad.propTypes = {
  children: PropTypes.node.isRequired,
  placeholder: PropTypes.node,
  rootMargin: PropTypes.string,
  threshold: PropTypes.number,
  className: PropTypes.string,
  onVisibilityChange: PropTypes.func,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  minHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default LazyLoad;
