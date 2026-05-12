// src/components/icons/BathroomScaleIcon.js
import React from 'react';

/**
 * Bathroom weighing scale icon — uses the PNG asset at
 * `frontend/public/scale.png` (Flaticon, by Freepik).
 *
 * Drop-in replacement for lucide's <Scale> wherever a weighing scale
 * is intended. Accepts the same `className` prop pattern, e.g.
 *   <BathroomScaleIcon className="w-6 h-6" />
 *
 * Note: this is a raster image, so `text-*` colour utility classes
 * no longer tint it (PNG colours come from the asset itself).
 */
const BathroomScaleIcon = ({ className = '', alt = 'Weighing scale', ...rest }) => (
  <img
    src={`${process.env.PUBLIC_URL || ''}/scale.png`}
    alt={alt}
    draggable={false}
    className={`object-contain inline-block select-none ${className}`}
    {...rest}
  />
);

export default BathroomScaleIcon;
