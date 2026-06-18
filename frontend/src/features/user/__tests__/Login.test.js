/**
 * Unit tests for Login orchestrator component.
 *
 * Coverage target: ≥ 70% lines / 60% branches (claude.md §9.1 components/).
 *
 * Strategy:
 *  - Mock @capacitor/core (used transitively by LoginIntroPanel).
 *  - Mock authService to prevent real HTTP calls.
 *  - Mock image imports (CRA jest handles .png → empty string, but explicit
 *    mock avoids ENOENT errors in some setups).
 *  - Do NOT mock sub-components — the real components render fine in jsdom.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from '../components/Login';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

jest.mock('../services/authService', () => ({
  sendOtp: jest.fn().mockResolvedValue({ success: true }),
  verifyOtp: jest.fn().mockResolvedValue({ success: false, message: 'Invalid OTP' }),
}));

// Firebase Phone Auth has been removed - using MDT SMS OTP instead

// Stub TermsAndConditions / PrivacyPolicy so they don't add noise to the DOM
jest.mock('../../../shared/components/TermsAndConditions', () =>
  function TermsStub({ onClose }) {
    return <div data-testid="terms-modal"><button onClick={onClose}>Close</button></div>;
  }
);
jest.mock('../../../shared/components/PrivacyPolicy', () =>
  function PrivacyStub({ onClose }) {
    return <div data-testid="privacy-modal"><button onClick={onClose}>Close</button></div>;
  }
);

beforeEach(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    configurable: true,
  });
});

// ─── Initial render ───────────────────────────────────────────────────────────

describe('initial render', () => {
  it('shows LoginIntroPanel (email button visible) before any navigation', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.getByText('Continue with Email')).toBeInTheDocument();
  });

  it('does not show the email entry form on first render', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    // The email input is part of LoginEmailEntry which should not be mounted yet
    expect(screen.queryByPlaceholderText(/email/i)).not.toBeInTheDocument();
  });

  it('renders "Wellness Valley" heading', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.getByText('Wellness Valley')).toBeInTheDocument();
  });
});

// ─── Navigation — intro → email entry ────────────────────────────────────────

describe('email entry navigation', () => {
  it('shows email input after clicking "Continue with Email"', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    // LoginEmailEntry renders an email input
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('hides the intro panel after choosing email', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    fireEvent.click(screen.getByText('Continue with Email'));
    // LoginIntroPanel is no longer in the tree
    expect(screen.queryByText('Continue with Email')).not.toBeInTheDocument();
  });
});

// ─── Prop forwarding to LoginIntroPanel ───────────────────────────────────────

describe('prop forwarding', () => {
  it('forwards onSignIn to LoginIntroPanel — Google button appears', () => {
    render(<Login onSignIn={jest.fn()} onOtpVerified={jest.fn()} />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('no Google button when onSignIn is not passed', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.queryByText('Continue with Google')).not.toBeInTheDocument();
  });

  it('forwards loading=true — Google button shows "Signing in..."', () => {
    render(
      <Login onSignIn={jest.fn()} loading={true} onOtpVerified={jest.fn()} />
    );
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });

  it('forwards error prop — alert with error text is rendered', () => {
    render(
      <Login error="Auth failed" onOtpVerified={jest.fn()} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Auth failed');
  });
});

// ─── Legal links ─────────────────────────────────────────────────────────────

describe('legal links', () => {
  it('opens Terms modal when Terms link is clicked', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    fireEvent.click(screen.getByText('Terms'));
    expect(screen.getByTestId('terms-modal')).toBeInTheDocument();
  });

  it('opens Privacy Policy modal when Privacy Policy link is clicked', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(screen.getByTestId('privacy-modal')).toBeInTheDocument();
  });
});
