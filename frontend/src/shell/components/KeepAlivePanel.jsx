/**
 * Keep-alive shell for main-nav modules.
 *
 * Saves / restores `.ios-scroll-body` scrollTop across hide/show so Diary
 * (and other overflow:auto panels) do not jump to the top on tab return —
 * even if a browser still resets scroll for visibility/absolute tricks.
 */
import React, { useLayoutEffect, useRef } from 'react';
import {
  keepAlivePanelStyle,
  keepAlivePanelHidden,
  isKeepAlivePanelActive,
} from '../domain/navKeepAlive';

export default function KeepAlivePanel({
  pageId,
  activeOverlayPage,
  className,
  children,
}) {
  const rootRef = useRef(null);
  const savedScrollTopRef = useRef(0);
  const wasActiveRef = useRef(isKeepAlivePanelActive(activeOverlayPage, pageId));
  const active = isKeepAlivePanelActive(activeOverlayPage, pageId);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scroller = root.querySelector('.ios-scroll-body');
    if (!scroller) {
      wasActiveRef.current = active;
      return;
    }

    if (wasActiveRef.current && !active) {
      savedScrollTopRef.current = scroller.scrollTop;
    } else if (!wasActiveRef.current && active) {
      const y = savedScrollTopRef.current;
      scroller.scrollTop = y;
      // Second frame: layout may settle after visibility flips.
      requestAnimationFrame(() => {
        if (rootRef.current?.querySelector('.ios-scroll-body')) {
          rootRef.current.querySelector('.ios-scroll-body').scrollTop = y;
        }
      });
    }
    wasActiveRef.current = active;
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={keepAlivePanelStyle(activeOverlayPage, pageId)}
      aria-hidden={keepAlivePanelHidden(activeOverlayPage, pageId)}
    >
      {children}
    </div>
  );
}
