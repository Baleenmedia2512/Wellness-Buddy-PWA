/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumSuccessPopup from './PremiumSuccessPopup';
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
  it('tells the member they are Premium and closes on Okay', () => {
    const onOkay = jest.fn();
    const view = render(<PremiumSuccessPopup onOkay={onOkay} />);
    expect(document.body.textContent).toMatch(/Payment Successful/);
    expect(document.body.textContent).toMatch(/You are now a Premium Member/);
    expect(document.body.querySelector('[data-testid="premium-party-blaster"]')).not.toBeNull();
    const okay = document.body.querySelector('button[aria-label="Okay"]');
    expect(okay).not.toBeNull();
    act(() => {
      okay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onOkay).toHaveBeenCalled();
    view.unmount();
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
    expect(document.body.textContent).toMatch(/Payment Successful/);
    view.unmount();
  });

  it('stays hidden until a payment is confirmed', () => {
    const view = render(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    view.unmount();
  });

  it('does not show another member\'s payment', () => {
    markPremiumSuccessPending(7);
    const view = render(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    view.unmount();
  });

  it('closes on Okay and does not come back on the next visit', () => {
    markPremiumSuccessPending(42);
    const view = render(<PremiumSuccessHost userId={42} />);
    const okay = document.body.querySelector('button[aria-label="Okay"]');
    act(() => {
      okay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    view.rerender(<PremiumSuccessHost userId={42} />);
    expect(document.body.textContent).not.toMatch(/Payment Successful/);
    view.unmount();
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
