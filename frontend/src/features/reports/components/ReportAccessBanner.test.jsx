/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ReportAccessBanner from './ReportAccessBanner';

function renderBanner(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ReportAccessBanner {...props} />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('ReportAccessBanner', () => {
  it('offers one free trial before it has started', () => {
    const view = renderBanner({ access: 'none', onStartTrial: () => {} });
    const button = view.container.querySelector('button[aria-label="Start free trial"]');
    expect(button).not.toBeNull();
    expect(button.textContent).toMatch(/Start free trial/);
    expect(view.container.textContent).toMatch(/14 days/);
    view.unmount();
  });

  it('accepts a shorter trial length for Events host tools', () => {
    const view = renderBanner({
      access: 'none',
      trialLengthDays: 7,
      onStartTrial: () => {},
    });
    expect(view.container.textContent).toMatch(/7 days/);
    expect(view.container.textContent).not.toMatch(/14 days/);
    view.unmount();
  });

  it('shows the days left during the trial', () => {
    const view = renderBanner({ access: 'trial', daysLeft: 14 });
    expect(view.container.textContent).toMatch(/14 days left/);
    expect(view.container.querySelector('button[aria-label="Go Premium"]')).toBeNull();
    view.unmount();
  });

  it('shows Please recharge after the trial or Premium ends', () => {
    const view = renderBanner({ access: 'ended', userId: '42', onPremiumCheck: async () => false });
    expect(view.container.textContent).toMatch(/Please recharge/);
    expect(view.container.querySelector('button[aria-label="Recharge Premium"]')).not.toBeNull();
    view.unmount();
  });

  it('shows nothing for a paid member', () => {
    const view = renderBanner({ access: 'premium' });
    expect(view.container.textContent).toBe('');
    view.unmount();
  });
});
