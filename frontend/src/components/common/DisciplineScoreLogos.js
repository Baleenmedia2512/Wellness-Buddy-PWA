// src/components/common/DisciplineScoreLogos.js
// Three distinct SVG logos for the Discipline Report stats strip:
//   SelfLogo      — single person (My Score)
//   DirectLogo    — leader + 2 direct reports (Direct Team)
//   FullTeamLogo  — 3-level pyramid tree  (Full Team)

import React from "react";

/**
 * SelfLogo — single person badge (blue)
 */
export const SelfLogo = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Self score"
  >
    {/* Head */}
    <circle cx="12" cy="7" r="3.5" fill="currentColor" />
    {/* Body / shoulders arc */}
    <path
      d="M4.5 20c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {/* Star accent top-right */}
    <path
      d="M18.5 3l.6 1.3 1.4.2-1 1 .24 1.4L18.5 6.3l-1.24.6.24-1.4-1-1 1.4-.2z"
      fill="currentColor"
    />
  </svg>
);

/**
 * DirectLogo — top node connected to 2 direct reports (green)
 */
export const DirectLogo = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Direct team score"
  >
    {/* Leader (top) */}
    <circle cx="12" cy="4.5" r="2.8" fill="currentColor" />
    {/* Vertical stem */}
    <line x1="12" y1="7.3" x2="12" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Horizontal bar */}
    <line x1="6.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Left drop */}
    <line x1="6.5" y1="10" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Right drop */}
    <line x1="17.5" y1="10" x2="17.5" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Left report */}
    <circle cx="6.5" cy="16" r="2.5" fill="currentColor" />
    {/* Right report */}
    <circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
  </svg>
);

/**
 * FullTeamLogo — 3-level organisation tree (purple)
 */
export const FullTeamLogo = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Full team score"
  >
    {/* Root (level 1) */}
    <circle cx="12" cy="3" r="2.2" fill="currentColor" />
    {/* Root stem */}
    <line x1="12" y1="5.2" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    {/* Level-2 horizontal bar */}
    <line x1="6" y1="7.5" x2="18" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    {/* Level-2 drops */}
    <line x1="6" y1="7.5" x2="6" y2="9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="18" y1="7.5" x2="18" y2="9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    {/* Level 2 nodes */}
    <circle cx="6" cy="12" r="1.9" fill="currentColor" />
    <circle cx="18" cy="12" r="1.9" fill="currentColor" />
    {/* Level-3 stems from left node */}
    <line x1="6" y1="13.9" x2="6" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="3" y1="15.5" x2="9" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="3" y1="15.5" x2="3" y2="17.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="9" y1="15.5" x2="9" y2="17.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    {/* Level-3 stems from right node */}
    <line x1="18" y1="13.9" x2="18" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="15" y1="15.5" x2="21" y2="15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="15" y1="15.5" x2="15" y2="17.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="21" y1="15.5" x2="21" y2="17.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    {/* Level 3 leaf nodes */}
    <circle cx="3"  cy="19" r="1.6" fill="currentColor" opacity="0.75" />
    <circle cx="9"  cy="19" r="1.6" fill="currentColor" opacity="0.75" />
    <circle cx="15" cy="19" r="1.6" fill="currentColor" opacity="0.75" />
    <circle cx="21" cy="19" r="1.6" fill="currentColor" opacity="0.75" />
  </svg>
);
