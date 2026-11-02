/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import WalletButton from './WalletButton';

function renderButton() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<WalletButton userId="42" />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('WalletButton', () => {
  it('shows Wallet on the profile account list', () => {
    const view = renderButton();
    expect(view.container.textContent).toMatch(/Wallet/);
    expect(view.container.textContent).toMatch(/Wellness Valley person shares the OTP/);
    view.unmount();
  });
});
