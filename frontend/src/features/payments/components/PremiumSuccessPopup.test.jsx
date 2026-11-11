/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumSuccessPopup, { PREMIUM_SUCCESS_VISIBLE_MS } from './PremiumSuccessPopup';
import PremiumSuccessHost from './PremiumSuccessHost';
import {
  clearPremiumSuccessPending,
  markPremiumSuccessPending,
} from '../services/premiumSuccess';

function render(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    root,
    rerender(next) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('PremiumSuccessPopup', () => {
  it('shows only the Premium message, then closes after 5 seconds', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const view = render(<PremiumSuccessPopup onClose={onClose} />);
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    expect(document.body.textContent).toMatch(/You are now a Premium Member/);
    expect(document.body.querySelector('button')).toBeNull();
    expect(document.body.querySelector('[data-testid="premium-party-blaster"]')).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(PREMIUM_SUCCESS_VISIBLE_MS - 1);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    jest.useRealTimers();
  });
});

describe('PremiumSuccessHost', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPremiumSuccessPending();
  });

  it('shows the popup after this member\'s payment is confirmed', () => {
    markPremiumSuccessPending(42);
    const view = render(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).toMatch(/You are now a Premium Member/);
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    view.unmount();
  });

  it('stays hidden until a payment is confirmed', () => {
    const view = render(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Premium Member/);
    view.unmount();
  });

  it('does not show another member\'s payment', () => {
    markPremiumSuccessPending(7);
    const view = render(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Premium Member/);
    view.unmount();
  });

  it('closes after 5 seconds and does not come back on the next visit', () => {
    jest.useFakeTimers();
    markPremiumSuccessPending(42);
    const view = render(<PremiumSuccessHost userId={42} />);
    act(() => {
      jest.advanceTimersByTime(PREMIUM_SUCCESS_VISIBLE_MS);
    });
    expect(document.body.textContent).not.toMatch(/Premium Member/);
    view.rerender(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Premium Member/);
    view.unmount();
    jest.useRealTimers();
  });

  it('opens when payment is confirmed while the member is already in the app', () => {
    const view = render(<PremiumSuccessHost userId={42} />);
    act(() => {
      markPremiumSuccessPending(42);
    });
    expect(document.body.textContent).toMatch(/You are now a Premium Member/);
    view.unmount();
  });
});
