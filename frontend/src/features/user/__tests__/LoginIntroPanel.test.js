/**
 * Unit tests for LoginIntroPanel component.
 *
 * Coverage target: ≥ 70% lines / 60% branches (claude.md §9.1 components/).
 *
 * Mocks: @capacitor/core — Capacitor.isNativePlatform controlled per test.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginIntroPanel from '../components/login/LoginIntroPanel';

// ─── Mock Capacitor ───────────────────────────────────────────────────────────

const mockIsNativePlatform = jest.fn(() => false);

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNativePlatform(),
  },
}));

// Ensure navigator.userAgent resolves to a desktop UA by default
// (so the mobile popup notice is hidden)
const originalUserAgent = navigator.userAgent;

beforeEach(() => {
  mockIsNativePlatform.mockReturnValue(false);
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    configurable: true,
  });
  sessionStorage.clear();
});

afterAll(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: originalUserAgent,
    configurable: true,
  });
});

// ─── Google button ────────────────────────────────────────────────────────────

describe('Google sign-in button', () => {
  it('renders "Continue with Google" when onSignIn is provided', () => {
    render(<LoginIntroPanel onSignIn={jest.fn()} onChooseEmail={jest.fn()} />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('does not render Google button when onSignIn is not provided', () => {
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.queryByText('Continue with Google')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Continue with Google')).not.toBeInTheDocument();
  });

  it('clicking Google button sets sessionStorage and calls onSignIn', () => {
    const onSignIn = jest.fn();
    render(<LoginIntroPanel onSignIn={onSignIn} onChooseEmail={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Continue with Google'));
    expect(sessionStorage.getItem('freshGoogleSignIn')).toBe('true');
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows "Signing in..." text when loading=true', () => {
    render(
      <LoginIntroPanel onSignIn={jest.fn()} onChooseEmail={jest.fn()} loading={true} />
    );
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.queryByText('Continue with Google')).not.toBeInTheDocument();
  });

  it('disables the Google button when loading=true', () => {
    render(
      <LoginIntroPanel onSignIn={jest.fn()} onChooseEmail={jest.fn()} loading={true} />
    );
    expect(screen.getByLabelText('Continue with Google')).toBeDisabled();
  });

  it('does not call onSignIn when button is disabled (loading)', () => {
    const onSignIn = jest.fn();
    render(
      <LoginIntroPanel onSignIn={onSignIn} onChooseEmail={jest.fn()} loading={true} />
    );
    fireEvent.click(screen.getByLabelText('Continue with Google'));
    // Button is disabled — browser prevents click; onSignIn should not be called
    expect(onSignIn).not.toHaveBeenCalled();
  });
});

// ─── Email button ─────────────────────────────────────────────────────────────

describe('Continue with Email button', () => {
  it('renders "Continue with Email"', () => {
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.getByText('Continue with Email')).toBeInTheDocument();
  });

  it('calls onChooseEmail when clicked', () => {
    const onChooseEmail = jest.fn();
    render(<LoginIntroPanel onChooseEmail={onChooseEmail} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    expect(onChooseEmail).toHaveBeenCalledTimes(1);
  });
});

// ─── Error display ────────────────────────────────────────────────────────────

describe('error display', () => {
  it('renders error message with role="alert" when error is provided', () => {
    render(
      <LoginIntroPanel onChooseEmail={jest.fn()} error="Something went wrong" />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
  });

  it('does not render error element when error is empty', () => {
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── "or" divider ─────────────────────────────────────────────────────────────

describe('"or" divider', () => {
  it('renders the "or" text between buttons', () => {
    render(
      <LoginIntroPanel onSignIn={jest.fn()} onChooseEmail={jest.fn()} />
    );
    expect(screen.getByText('or')).toBeInTheDocument();
  });
});

// ─── Mobile popup notice ─────────────────────────────────────────────────────

describe('mobile popup notice', () => {
  it('is hidden on a non-mobile user agent (desktop)', () => {
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.queryByText(/enable popups/i)).not.toBeInTheDocument();
  });

  it('is hidden when Capacitor.isNativePlatform() returns true', () => {
    mockIsNativePlatform.mockReturnValue(true);
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      configurable: true,
    });
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.queryByText(/enable popups/i)).not.toBeInTheDocument();
  });

  it('is visible on mobile web (Android UA + isNativePlatform=false)', () => {
    mockIsNativePlatform.mockReturnValue(false);
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
      configurable: true,
    });
    render(<LoginIntroPanel onChooseEmail={jest.fn()} />);
    expect(screen.getByText(/enable popups/i)).toBeInTheDocument();
  });
});
