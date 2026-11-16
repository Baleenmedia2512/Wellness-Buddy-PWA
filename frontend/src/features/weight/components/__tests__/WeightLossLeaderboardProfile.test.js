import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WeightLossLeaderboard from '../WeightLossLeaderboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../../../shared/utils/visibilityAwareInterval.js', () => ({
  setVisibilityAwareInterval: () => () => {},
}));

jest.mock('../../../../shared/hooks/useAutoScrollStrip.js', () => ({
  useAutoScrollStrip: () => ({
    viewportRef: { current: null },
    trackRef: { current: null },
    interactionHandlers: {},
  }),
}));

jest.mock('../../../leaderboard/hooks/useRaceLeaderboardRealtime.js', () => ({
  useRaceLeaderboardRealtime: jest.fn(),
}));

jest.mock('../../../../shared/utils/logger.js', () => ({
  debugLog: jest.fn(),
}));

jest.mock('../../../leaderboard/components/LeaderboardAvatar.js', () => ({
  __esModule: true,
  default: ({ interactive }) => (
    <span data-testid="avatar-interactive">{String(interactive)}</span>
  ),
}));

jest.mock('../../../leaderboard/components/LeaderboardAvatarViewer.js', () => ({
  __esModule: true,
  default: ({ isOpen, onViewProfile }) => (
    isOpen
      ? <button type="button" onClick={onViewProfile}>View profile</button>
      : null
  ),
}));

jest.mock('../../../../shared/components/TeamMemberProfileModal', () => ({
  __esModule: true,
  default: ({ isOpen, memberUserId }) => (
    isOpen ? <div data-testid="member-profile">{memberUserId}</div> : null
  ),
}));

describe('WeightLossLeaderboard profile photo flow', () => {
  let container;
  let root;
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          rank: 1,
          userId: 42,
          userName: 'Member One',
          email: 'member@example.com',
          weightLoss: 0.5,
        }],
      }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  });

  it('opens the photo viewer and then that member profile from the right-side action', async () => {
    await act(async () => {
      root.render(
        <WeightLossLeaderboard
          variant="tile"
          apiBaseUrl="https://example.test"
          userId={1}
          email="viewer@example.com"
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="avatar-interactive"]')?.textContent)
      .toBe('false');

    const avatarButton = container.querySelector('button[aria-label="View Member One\'s photo"]');
    act(() => avatarButton.click());

    const viewProfileButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'View profile');
    expect(viewProfileButton).not.toBeUndefined();
    act(() => viewProfileButton.click());

    expect(container.querySelector('[data-testid="member-profile"]')?.textContent)
      .toBe('42');
  });

  it('toggles Last 10 days and requests days=10 from the weight leaderboard API', async () => {
    globalThis.fetch = jest.fn((url) => {
      const href = String(url);
      if (href.includes('days=10')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{
              rank: 1,
              userId: 7,
              userName: 'Ten Day Winner',
              email: 'tenday@example.com',
              weightLoss: 1.2,
            }],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            rank: 1,
            userId: 42,
            userName: 'Member One',
            email: 'member@example.com',
            weightLoss: 0.5,
          }],
        }),
      });
    });

    await act(async () => {
      root.render(
        <WeightLossLeaderboard
          variant="tile"
          apiBaseUrl="https://example.test"
          userId={1}
          email="viewer@example.com"
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Today vs Yesterday');
    const toggle = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Last 10 days'));
    expect(toggle).not.toBeUndefined();

    await act(async () => {
      toggle.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('days=10'),
      expect.any(Object),
    );
    expect(container.textContent).toContain('Last 10 days');
    expect(container.textContent).toContain('Ten Day Winner');
    expect(container.textContent).toContain('Show today');
  });
});

