/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumBadge, { PremiumAvatarRing } from './PremiumBadge';
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

describe('PremiumAvatarRing', () => {
  it('sizes from the child — no h-full/w-full/aspect-square wrappers (iOS collapse)', () => {
    const view = render(
      <PremiumAvatarRing>
        <button type="button" className="h-9 w-9" data-testid="avatar-face">Y</button>
      </PremiumAvatarRing>,
    );
    const ring = view.container.querySelector('[data-testid="premium-avatar-ring"]');
    expect(ring).toBeTruthy();
    expect(ring.className).not.toMatch(/\baspect-square\b/);
    expect(ring.className).not.toMatch(/\bh-full\b/);
    expect(ring.className).not.toMatch(/\bw-full\b/);
    const inner = ring.firstElementChild;
    expect(inner.className).not.toMatch(/\baspect-square\b/);
    expect(inner.className).not.toMatch(/\bh-full\b/);
    expect(inner.className).not.toMatch(/\bw-full\b/);
    expect(view.container.querySelector('[data-testid="avatar-face"]')).toBeTruthy();
    view.unmount();
  });

  it('passes children through when disabled', () => {
    const view = render(
      <PremiumAvatarRing enabled={false}>
        <span data-testid="bare-avatar">A</span>
      </PremiumAvatarRing>,
    );
    expect(view.container.querySelector('[data-testid="premium-avatar-ring"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="bare-avatar"]')).toBeTruthy();
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
