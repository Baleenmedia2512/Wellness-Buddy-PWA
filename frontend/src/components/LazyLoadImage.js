// src/components/LazyLoadImage.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import LazyLoad from './LazyLoad';

/**
 * LazyLoadImage - Optimized image component with bidirectional lazy loading
 * 
 * Features:
 * - Loads images only when visible in viewport
 * - Re-triggers when scrolling back up
 * - Shimmer placeholder while loading
 * - Error handling with fallback
 */
const LazyLoadImage = ({
  src,
  alt = '',
  className = '',
  placeholder = null,
  fallbackSrc = null,
  onLoad = null,
  onError = null,
  rootMargin = '100px',
  threshold = 0.01,
  ...imageProps
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleImageError = (e) => {
    setImageError(true);
    if (onError) onError(e);
    
    // Try fallback if available
    if (fallbackSrc && e.target.src !== fallbackSrc) {
      e.target.src = fallbackSrc;
    }
  };

  // Custom placeholder for images
  const imagePlaceholder = placeholder || (
    <div 
      className="lazy-image-placeholder"
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999',
        fontSize: '14px'
      }}
    >
      Loading...
    </div>
  );

  return (
    <LazyLoad
      placeholder={imagePlaceholder}
      rootMargin={rootMargin}
      threshold={threshold}
      className="lazy-load-image-wrapper"
    >
      <img
        src={src}
        alt={alt}
        className={`lazy-image ${imageLoaded ? 'loaded' : 'loading'} ${className}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          opacity: imageLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        {...imageProps}
      />
      {imageError && !fallbackSrc && (
        <div className="image-error-fallback" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          color: '#999'
        }}>
          ❌ Failed to load
        </div>
      )}
    </LazyLoad>
  );
};

LazyLoadImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
  placeholder: PropTypes.node,
  fallbackSrc: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  rootMargin: PropTypes.string,
  threshold: PropTypes.number
};

export default LazyLoadImage;
