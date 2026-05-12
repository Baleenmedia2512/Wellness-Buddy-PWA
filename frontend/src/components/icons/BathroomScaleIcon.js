// src/components/icons/BathroomScaleIcon.js
import React from 'react';

/**
 * Bathroom weighing scale icon — uses PNG assets at
 * `frontend/public/scale.png` (green) and `frontend/public/red -scale.png` (red).
 *
 * Drop-in replacement for lucide's <Scale>. Pass `variant="red"` for the
 * red asset; defaults to green. `variant="gray"` desaturates the green one.
 */
const BathroomScaleIcon = ({
  className = '',
  alt = 'Weighing scale',
  variant = 'green',
  style,
  ...rest
}) => {
  const base = process.env.PUBLIC_URL || '';
  const src =
    variant === 'red' ? `${base}/red%20-scale.png` : `${base}/scale.png`;
  const filter = variant === 'gray' ? 'grayscale(1) opacity(0.55)' : undefined;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`object-contain inline-block select-none ${className}`}
      style={filter ? { filter, ...style } : style}
      {...rest}
    />
  );
};

export default BathroomScaleIcon;
