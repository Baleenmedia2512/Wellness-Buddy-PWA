import {
  isNavKeepAlivePage,
  keepAlivePanelStyle,
  keepAlivePanelHidden,
  isKeepAlivePanelActive,
  NAV_KEEP_ALIVE_PAGES,
} from '../navKeepAlive.js';

describe('navKeepAlive', () => {
  it('marks main nav modules as keep-alive', () => {
    expect(isNavKeepAlivePage('dashboard')).toBe(true);
    expect(isNavKeepAlivePage('activity-report')).toBe(true);
    expect(isNavKeepAlivePage('enrollment')).toBe(true);
    expect(isNavKeepAlivePage('counselling')).toBe(true);
    expect(NAV_KEEP_ALIVE_PAGES).toContain('reports');
  });

  it('excludes exclusive overlays from keep-alive', () => {
    expect(isNavKeepAlivePage('profile')).toBe(false);
    expect(isNavKeepAlivePage('manual-entry')).toBe(false);
    expect(isNavKeepAlivePage('wellness-score')).toBe(false);
    expect(isNavKeepAlivePage('admin-config-setup')).toBe(false);
    expect(isNavKeepAlivePage('home')).toBe(false);
  });

  it('hides inactive panels without display:none (preserves scroll)', () => {
    const active = keepAlivePanelStyle('dashboard', 'dashboard');
    const hidden = keepAlivePanelStyle('activity-report', 'dashboard');
    expect(active.visibility).toBe('visible');
    expect(active.display).toBeUndefined();
    expect(hidden.visibility).toBe('hidden');
    expect(hidden.display).toBeUndefined();
    expect(hidden.position).toBe('absolute');
    expect(keepAlivePanelHidden('dashboard', 'dashboard')).toBe(false);
    expect(keepAlivePanelHidden('activity-report', 'dashboard')).toBe(true);
  });

  it('treats create-event and event-check-in as the same panel', () => {
    expect(isKeepAlivePanelActive('event-check-in', 'create-event')).toBe(true);
    expect(isKeepAlivePanelActive('create-event', 'create-event')).toBe(true);
    expect(isKeepAlivePanelActive('dashboard', 'create-event')).toBe(false);
  });
});
