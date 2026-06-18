/**
 * Unit tests for Login orchestrator component.
 *
 * Coverage target: ≥ 70% lines / 60% branches (claude.md §9.1 components/).
 *
 * Strategy:
 *  - Mock @capacitor/core (used transitively by sub-components).
 *  - Mock authService to prevent real HTTP calls.
 *  - Do NOT mock sub-components — the real components render fine in jsdom.
 *
 * Behaviour after Swiggy-style UX update:
 *  - No intro panel step: email/phone entry shown immediately on first render.
 *  - OTP screen auto-verifies — no manual Verify button.
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
  it('shows the mobile/email entry form immediately (no intro panel step)', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    // LoginEmailEntry is mounted directly — no "Continue with Email" gating click needed
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not show a "Continue with Email" intro button', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.queryByText('Continue with Email')).not.toBeInTheDocument();
  });

  it('renders "Wellness Valley" heading', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.getByText('Wellness Valley')).toBeInTheDocument();
  });

  it('shows the "Mobile Number or Email" label', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.getByText('Mobile Number or Email')).toBeInTheDocument();
  });

  it('shows the "Send OTP" button initially', () => {
    render(<Login onOtpVerified={jest.fn()} />);
    expect(screen.getByRole('button', { name: /send otp/i })).toBeInTheDocument();
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
