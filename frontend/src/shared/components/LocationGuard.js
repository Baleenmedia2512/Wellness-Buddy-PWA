import React from 'react';

/**
 * LocationGuard
 *
 * Previously showed a location-off overlay for step counter tracking.
 * Step counter feature removed — now a transparent passthrough.
 *
 * Props:
 *   children  — content to render
 */
export default function LocationGuard({ children }) {
  return <>{children}</>;
}