/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumBadge from './PremiumBadge';
import GoPremiumButton from './GoPremiumButton';

function render(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('PremiumBadge', () => {
  it('shows the Premium label', () => {
    const view = render(<PremiumBadge />);
    expect(view.container.textContent).toMatch(/Premium/);
    view.unmount();
  });
});

describe('GoPremiumButton for a member who already paid', () => {
  it('does not offer Go Premium again', () => {
    const view = render(<GoPremiumButton userId="42" isPremium />);
    expect(view.container.textContent).not.toMatch(/Go Premium/);
    view.unmount();
  });
});
