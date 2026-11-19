/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import GoPremiumButton from './GoPremiumButton';

function renderButton(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<GoPremiumButton userId="42" {...props} />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('GoPremiumButton', () => {
  it('shows a Go Premium chip for the profile header', () => {
    const view = renderButton();
    const button = view.container.querySelector('button[aria-label="Go Premium"]');
    expect(button).not.toBeNull();
    expect(button.textContent).toMatch(/Go Premium/);
    expect(button.getAttribute('title')).toMatch(/UPI, card, or net banking/);
    view.unmount();
  });

  it('hides when Page Access denies go-premium', () => {
    const view = renderButton({ allowedPages: { 'go-premium': false } });
    expect(view.container.querySelector('button[aria-label="Go Premium"]')).toBeNull();
    view.unmount();
  });

  it('shows when Page Access allows go-premium', () => {
    const view = renderButton({ allowedPages: { 'go-premium': true } });
    expect(view.container.querySelector('button[aria-label="Go Premium"]')).not.toBeNull();
    view.unmount();
  });
});
