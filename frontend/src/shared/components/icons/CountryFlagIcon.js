// SVG country flags for iOS WebView (emoji flags render as ? on iOS).
import React from 'react';

const SUPPORTED = new Set(['IN', 'US', 'GB', 'AE', 'AU', 'CA', 'SG', 'DE']);

const CountryFlagIcon = ({ code, className = 'w-5 h-4', alt }) => {
  const iso = String(code || '').toUpperCase();
  if (!SUPPORTED.has(iso)) return null;

  const base = process.env.PUBLIC_URL || '';
  const src = `${base}/flags/${iso.toLowerCase()}.svg`;

  return (
    <img
      src={src}
      alt={alt || `${iso} flag`}
      draggable={false}
      className={`object-cover rounded-sm inline-block select-none flex-shrink-0 ${className}`}
    />
  );
};

export default CountryFlagIcon;
