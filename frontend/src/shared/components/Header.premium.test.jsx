/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Header from './Header';
import usePremiumStatus from '../../features/payments/hooks/usePremiumStatus';

jest.mock('../../features/payments/hooks/usePremiumStatus');
jest.mock('../../features/user/services/user.api', () => ({
  getProfile: jest.fn(() => Promise.resolve({ success: false })),
}));

function renderHeader(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Header user={{ id: 42, email: 'a@b.com' }} {...props} />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('Header premium crown', () => {
  it('shows the crown on the avatar for a Premium member', () => {
    usePremiumStatus.mockReturnValue({ premium: true, refresh: jest.fn() });
    const view = renderHeader();
    const tag = view.container.querySelector('[data-testid="premium-header-tag"]');
    expect(tag).not.toBeNull();
    expect(tag.textContent).toMatch(/Premium/);
    expect(view.container.querySelector('[data-testid="premium-crown"]')).not.toBeNull();
    view.unmount();
  });

  it('leaves the avatar unchanged for everyone else', () => {
    usePremiumStatus.mockReturnValue({ premium: false, refresh: jest.fn() });
    const view = renderHeader();
    expect(view.container.querySelector('[data-testid="premium-crown"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="premium-header-tag"]')).toBeNull();
    expect(view.container.querySelector('button[aria-label="My Profile"]')).not.toBeNull();
    view.unmount();
  });

  it('does not check Premium for the tab-only header', () => {
    usePremiumStatus.mockReturnValue({ premium: false, refresh: jest.fn() });
    const view = renderHeader({ navOnly: true });
    expect(usePremiumStatus).toHaveBeenLastCalledWith(null);
    view.unmount();
  });
});
