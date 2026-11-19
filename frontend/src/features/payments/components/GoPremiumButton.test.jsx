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
  it('shows Go Premium on the profile account list', () => {
    const view = renderButton();
    expect(view.container.textContent).toMatch(/Go Premium/);
    expect(view.container.textContent).toMatch(/UPI, card, or net banking/);
    view.unmount();
  });
});
