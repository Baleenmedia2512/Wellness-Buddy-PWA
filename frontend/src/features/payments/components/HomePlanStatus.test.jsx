/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import HomePlanStatus from './HomePlanStatus';
import usePremiumStatus from '../hooks/usePremiumStatus';
import useReportAccess from '../../reports/hooks/useReportAccess';

jest.mock('../hooks/usePremiumStatus');
jest.mock('../../reports/hooks/useReportAccess');

const idleTrial = {
  access: 'none',
  daysLeft: null,
  expiresAtDisplay: null,
};

function renderStatus() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<HomePlanStatus userId={42} />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('HomePlanStatus', () => {
  it('shows the Premium membership card', () => {
    usePremiumStatus.mockReturnValue({
      premium: true,
      daysLeft: 18,
      expiresAtDisplay: '13 Dec 2026, 11:59 PM',
    });
    useReportAccess.mockReturnValue(idleTrial);
    const view = renderStatus();
    const card = view.container.querySelector('[data-testid="home-plan-status"]');
    const crown = view.container.querySelector('[data-testid="home-plan-crown"]');
    expect(crown).not.toBeNull();
    expect(crown.className).toMatch(/rounded-xl/);
    expect(crown.className).toMatch(/bg-gradient-to-br/);
    expect(crown.querySelector('svg')).not.toBeNull();
    expect(crown.querySelector('svg').getAttribute('class')).toMatch(/text-white/);
    expect(card.textContent).toMatch(/Premium Active/);
    expect(card.textContent).toMatch(/18 days left/);
    expect(card.textContent).toMatch(/13 Dec 2026, 11:59 PM \(IST\)/);
    expect(view.container.querySelector('[data-testid="home-plan-progress"]').getAttribute('aria-valuenow')).toBe('60');
    expect(view.container.querySelector('[data-testid="home-plan-status"]').getAttribute('data-urgent')).toBe('false');
    expect(useReportAccess).toHaveBeenLastCalledWith(null);
    view.unmount();
  });

  it('turns the card red when two days or fewer remain', () => {
    usePremiumStatus.mockReturnValue({
      premium: true,
      daysLeft: 2,
      expiresAtDisplay: '18 Nov 2026, 11:59 PM',
    });
    useReportAccess.mockReturnValue(idleTrial);
    const view = renderStatus();
    const card = view.container.querySelector('[data-testid="home-plan-status"]');
    expect(card.getAttribute('data-urgent')).toBe('true');
    expect(card.textContent).toMatch(/2 days left/);
    expect(view.container.querySelector('[data-testid="home-plan-days"] p').className).toMatch(/text-red-700/);
    expect(view.container.querySelector('[data-testid="home-plan-progress"]').className).toMatch(/bg-red-100/);
    view.unmount();
  });

  it('shows the free trial in the same card', () => {
    usePremiumStatus.mockReturnValue({
      premium: false,
      daysLeft: null,
      expiresAtDisplay: null,
    });
    useReportAccess.mockReturnValue({
      access: 'trial',
      daysLeft: 12,
      expiresAtDisplay: '28 Nov 2026, 12:00 AM',
    });
    const view = renderStatus();
    const card = view.container.querySelector('[data-testid="home-plan-status"]');
    expect(card.textContent).toMatch(/Free Trial Active/);
    expect(card.textContent).toMatch(/Trial Active/);
    expect(card.textContent).toMatch(/12 days left/);
    expect(card.textContent).toMatch(/28 Nov 2026, 12:00 AM \(IST\)/);
    expect(useReportAccess).toHaveBeenLastCalledWith(42);
    view.unmount();
  });

  it('renders nothing when there is no plan', () => {
    usePremiumStatus.mockReturnValue({
      premium: false,
      daysLeft: null,
      expiresAtDisplay: null,
    });
    useReportAccess.mockReturnValue(idleTrial);
    const view = renderStatus();
    expect(view.container.querySelector('[data-testid="home-plan-status"]')).toBeNull();
    view.unmount();
  });
});
