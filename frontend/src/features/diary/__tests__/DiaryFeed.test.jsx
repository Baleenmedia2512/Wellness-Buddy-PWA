/**
 * frontend/src/features/diary/__tests__/DiaryFeed.test.jsx
 *
 * Component tests for `DiaryFeed`. Mocks `useDiary` at the module
 * boundary so each test controls loading / error / data states
 * directly and the suite stays fast.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../hooks/useDiary', () => ({
  useDiary: jest.fn(),
}));

import DiaryFeed from '../components/DiaryFeed';
import { useDiary } from '../hooks/useDiary';

const baseProps = {
  ownerUserId: '42',
  viewerUserId: '42',
  date: '2026-06-05',
};

const fixture = {
  date: '2026-06-05',
  ownerUserId: '42',
  isSelf: true,
  includesUnknown: false,
  entries: [
    {
      kind: 'food',
      capturedAt: '2026-06-05T10:00:00+05:30',
      capture: { id: 1001 },
      payload: { id: 1, totals: { calories: 320 } },
    },
    {
      kind: 'weight',
      capturedAt: '2026-06-05T12:00:00+05:30',
      capture: null,
      payload: { id: 2, weight: 72.5, bmi: 24.1 },
    },
    {
      kind: 'education',
      capturedAt: '2026-06-05T08:00:00+05:30',
      capture: null,
      payload: { id: 3, platform: 'wellness-uni', topic: 'Module 4' },
    },
    {
      kind: 'watch',
      capturedAt: '2026-06-05T15:00:00+05:30',
      capture: null,
      payload: { id: 4, topic: 'Calories Burned: 245 kcal', kcal: 245 },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DiaryFeed — render states', () => {
  it('renders the skeleton while loading', () => {
    useDiary.mockReturnValueOnce({ loading: true, error: null, data: null, refresh: jest.fn() });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByTestId('diary-feed-skeleton')).toBeInTheDocument();
  });

  it('renders the empty state when entries is empty', () => {
    useDiary.mockReturnValueOnce({
      loading: false, error: null, refresh: jest.fn(),
      data: { ...fixture, entries: [] },
    });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByTestId('diary-feed-empty')).toBeInTheDocument();
    expect(screen.getByText(/No entries yet for this day/i)).toBeInTheDocument();
  });

  it('renders a generic error + Retry button for non-auth failures', () => {
    const refresh = jest.fn();
    useDiary.mockReturnValueOnce({
      loading: false,
      error: { status: 500, message: 'server boom' },
      data: null,
      refresh,
    });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByTestId('diary-feed-error')).toBeInTheDocument();
    expect(screen.getByText(/Could not load the diary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders an auth-aware error and hides Retry for 403', () => {
    useDiary.mockReturnValueOnce({
      loading: false,
      error: { status: 403, message: 'forbidden' },
      data: null,
      refresh: jest.fn(),
    });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByText(/don't have access to this diary/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('DiaryFeed — entry dispatch', () => {
  it('renders the right row per kind', () => {
    useDiary.mockReturnValueOnce({
      loading: false, error: null, refresh: jest.fn(), data: fixture,
    });
    render(<DiaryFeed {...baseProps} />);

    expect(screen.getByTestId('diary-row-food')).toBeInTheDocument();
    expect(screen.getByTestId('diary-row-weight')).toBeInTheDocument();
    expect(screen.getByTestId('diary-row-education')).toBeInTheDocument();
    expect(screen.getByTestId('diary-row-watch')).toBeInTheDocument();
  });

  it('falls back to OtherRow for an unrecognised kind', () => {
    useDiary.mockReturnValueOnce({
      loading: false, error: null, refresh: jest.fn(),
      data: {
        ...fixture,
        entries: [{
          kind: 'mystery',
          capturedAt: '2026-06-05T18:00:00+05:30',
          capture: { id: 99, type: 'mystery' },
          payload: { id: 99 },
        }],
      },
    });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByTestId('diary-row-unknown')).toBeInTheDocument();
  });

  it('forwards onEntryOpen as the row click handler', () => {
    const onEntryOpen = jest.fn();
    useDiary.mockReturnValueOnce({
      loading: false, error: null, refresh: jest.fn(), data: fixture,
    });
    render(<DiaryFeed {...baseProps} onEntryOpen={onEntryOpen} />);

    fireEvent.click(screen.getByTestId('diary-row-food'));
    expect(onEntryOpen).toHaveBeenCalledTimes(1);
    expect(onEntryOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'food' }));
  });

  it('renders the "Refreshing…" indicator when loading=true and data already present', () => {
    useDiary.mockReturnValueOnce({
      loading: true, error: null, refresh: jest.fn(), data: fixture,
    });
    render(<DiaryFeed {...baseProps} />);
    expect(screen.getByText(/Refreshing/i)).toBeInTheDocument();
    // Entries still visible during refresh.
    expect(screen.getByTestId('diary-row-food')).toBeInTheDocument();
  });
});
