/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import WalletButton from './WalletButton';

jest.mock('../hooks/useWallet', () => () => ({
  balance: 120,
  pendingRequest: null,
  loading: false,
  error: '',
  setBalance: jest.fn(),
  setPendingRequest: jest.fn(),
  setError: jest.fn(),
  refresh: jest.fn(),
}));

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

  it('shows an events card variant without changing the profile row copy', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<WalletButton userId="42" variant="events" />);
    });
    expect(container.textContent).toMatch(/Wallet/);
    expect(container.textContent).toMatch(/Recharge/);
    expect(container.textContent).not.toMatch(/Wellness Valley person shares the OTP/);
    act(() => root.unmount());
    container.remove();
  });
});
