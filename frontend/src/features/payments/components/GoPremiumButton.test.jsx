/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import GoPremiumButton from './GoPremiumButton';

function renderButton() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<GoPremiumButton userId="42" />);
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
});
