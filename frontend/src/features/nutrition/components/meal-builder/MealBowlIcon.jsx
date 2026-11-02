/**
 * Meal bowl icon with simple food shapes + circular + badge.
 * Nutrition-app branding — not cart / leaf / basket.
 */
import React from 'react';

const MealBowlIcon = ({ size = 28, className = '', showPlus = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    {/* Bowl */}
    <path
      d="M6 18c0 9 6.5 14 14 14s14-5 14-14H6z"
      fill="#16a34a"
      opacity="0.9"
    />
    <ellipse cx="20" cy="18" rx="14" ry="4" fill="#22c55e" />
    {/* Simple food shapes in bowl */}
    <circle cx="14" cy="17" r="2.2" fill="#fef3c7" />
    <circle cx="20" cy="15.5" r="2.4" fill="#fecaca" />
    <ellipse cx="26" cy="17" rx="2.6" ry="2" fill="#fed7aa" />
    {/* Steam / rim highlight */}
    <path d="M8 18h24" stroke="#15803d" strokeWidth="1" opacity="0.35" />
    {showPlus && (
      <>
        <circle cx="31" cy="9" r="7" fill="#ffffff" />
        <circle cx="31" cy="9" r="6" fill="#16a34a" />
        <path
          d="M31 6v6M28 9h6"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
);

export default MealBowlIcon;
