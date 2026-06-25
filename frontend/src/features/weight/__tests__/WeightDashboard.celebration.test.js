/**
 * WeightDashboard.celebration.test.js — Integration tests for celebration feature.
 *
 * Tests that celebration triggers correctly when weight loss is detected.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WeightDashboard from '../WeightDashboard';

// Mock the hooks and components
jest.mock('../../hooks/useWeightDashboard', () => ({
  useWeightDashboard: jest.fn(),
}));

jest.mock('../WeightSummaryCards', () => ({
  __esModule: true,
  default: () => <div>Weight Summary</div>,
}));

jest.mock('../WeightChart', () => ({
  __esModule: true,
  default: () => <div>Weight Chart</div>,
}));

jest.mock('../WeightHistoryList', () => ({
  __esModule: true,
  default: () => <div>Weight History</div>,
}));

jest.mock('../WeightActions', () => ({
  WeightPanelToggle: () => <div>Panel Toggle</div>,
  WeightPanelDots: () => <div>Panel Dots</div>,
}));

jest.mock('../../../../shared/components/CelebrationConfetti', () => ({
  __esModule: true,
  default: ({ show, message, onComplete }) => (
    show ? (
      <div data-testid="celebration-confetti">
        <div>{message}</div>
        <button onClick={onComplete}>Complete</button>
      </div>
    ) : null
  ),
}));

const mockUseWeightDashboard = require('../../hooks/useWeightDashboard').useWeightDashboard;

describe('WeightDashboard - Celebration Feature', () => {
  const mockUser = { id: 'user123', email: 'test@example.com' };
  const mockApiBaseUrl = 'http://localhost:3000';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should not show celebration on initial load', () => {
    const mockWeightHistory = [
      { ID: 1, Weight: '75.5', CreatedAt: new Date().toISOString() },
      { ID: 2, Weight: '77.0', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: mockWeightHistory,
      globalStats: {},
      showModal: false,
    });

    render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
  });

  it('should show celebration when new weight entry shows weight loss', async () => {
    const initialHistory = [
      { ID: 1, Weight: '77.0', CreatedAt: new Date().toISOString() },
    ];

    const updatedHistory = [
      { ID: 2, Weight: '75.5', CreatedAt: new Date().toISOString() },
      { ID: 1, Weight: '77.0', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: initialHistory,
      globalStats: {},
      showModal: false,
    });

    const { rerender } = render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();

    // Simulate new weight entry with weight loss
    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: updatedHistory,
      globalStats: {},
      showModal: false,
    });

    rerender(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('celebration-confetti')).toBeInTheDocument();
    });

    expect(screen.getByText(/You lost 1.5 kg! Keep going!/)).toBeInTheDocument();
  });

  it('should not show celebration for weight gain', async () => {
    const initialHistory = [
      { ID: 1, Weight: '75.0', CreatedAt: new Date().toISOString() },
    ];

    const updatedHistory = [
      { ID: 2, Weight: '77.0', CreatedAt: new Date().toISOString() },
      { ID: 1, Weight: '75.0', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: initialHistory,
      globalStats: {},
      showModal: false,
    });

    const { rerender } = render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    // Simulate new weight entry with weight gain
    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: updatedHistory,
      globalStats: {},
      showModal: false,
    });

    rerender(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
    });
  });

  it('should not show celebration for minimal weight change (< 0.1 kg)', async () => {
    const initialHistory = [
      { ID: 1, Weight: '75.00', CreatedAt: new Date().toISOString() },
    ];

    const updatedHistory = [
      { ID: 2, Weight: '74.95', CreatedAt: new Date().toISOString() },
      { ID: 1, Weight: '75.00', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: initialHistory,
      globalStats: {},
      showModal: false,
    });

    const { rerender } = render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: updatedHistory,
      globalStats: {},
      showModal: false,
    });

    rerender(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
    });
  });

  it('should not show celebration twice for the same entry', async () => {
    const weightHistory = [
      { ID: 2, Weight: '75.5', CreatedAt: new Date().toISOString() },
      { ID: 1, Weight: '77.0', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    // Simulate that this entry was already celebrated
    localStorage.setItem('weight_celebrated_id', '2');

    mockUseWeightDashboard
      .mockReturnValueOnce({
        loading: false,
        weightHistory: [{ ID: 1, Weight: '77.0', CreatedAt: new Date().toISOString() }],
        globalStats: {},
        showModal: false,
      })
      .mockReturnValueOnce({
        loading: false,
        weightHistory,
        globalStats: {},
        showModal: false,
      });

    const { rerender } = render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    rerender(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
    });
  });

  it('should set localStorage key when celebration is shown', async () => {
    const initialHistory = [
      { ID: 1, Weight: '77.0', CreatedAt: new Date().toISOString() },
    ];

    const updatedHistory = [
      { ID: 2, Weight: '75.5', CreatedAt: new Date().toISOString() },
      { ID: 1, Weight: '77.0', CreatedAt: new Date(Date.now() - 86400000).toISOString() },
    ];

    mockUseWeightDashboard
      .mockReturnValueOnce({
        loading: false,
        weightHistory: initialHistory,
        globalStats: {},
        showModal: false,
      })
      .mockReturnValueOnce({
        loading: false,
        weightHistory: updatedHistory,
        globalStats: {},
        showModal: false,
      });

    const { rerender } = render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    rerender(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    await waitFor(() => {
      expect(localStorage.getItem('weight_celebrated_id')).toBe('2');
    });
  });

  it('should not show celebration when loading', () => {
    mockUseWeightDashboard.mockReturnValue({
      loading: true,
      weightHistory: [],
      globalStats: {},
      showModal: false,
    });

    render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
  });

  it('should not show celebration when no weight history', () => {
    mockUseWeightDashboard.mockReturnValue({
      loading: false,
      weightHistory: [],
      globalStats: {},
      showModal: false,
    });

    render(
      <WeightDashboard
        user={mockUser}
        apiBaseUrl={mockApiBaseUrl}
        hideHeader={false}
      />
    );

    expect(screen.queryByTestId('celebration-confetti')).not.toBeInTheDocument();
  });
});
