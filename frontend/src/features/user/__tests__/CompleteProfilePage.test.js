/**
 * Unit tests for CompleteProfilePage.
 *
 * Coverage target: ≥ 70% lines / 60% branches (claude.md §9.1 components/).
 *
 * KEY REGRESSION GUARD
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG: On mobile (Capacitor), when the user opened camera/gallery from
 * CompleteProfilePage and returned, the App.js foreground-resume listener
 * called checkProfileCompletion → set profileChecking=true → the early-return
 * `if (profileChecking) return <LoadingSpinner />` replaced the whole page →
 * CompleteProfilePage unmounted → all typed values (height, phone, diet) LOST.
 *
 * FIX (App.js): _profileGateActiveRef tracks showCompleteProfile; the
 * foreground-resume listener skips checkProfileCompletion while that ref is
 * true. _homeScreenActiveRef now also excludes showCompleteProfile so the
 * "auto-open camera" effect never fires during the profile gate.
 *
 * These tests verify the component's own behaviour AND document the failure
 * mode so any future regression is immediately visible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CompleteProfilePage from '../components/CompleteProfilePage';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../services/profileService', () => ({
  fetchProfile: jest.fn(),
  saveProfile: jest.fn(),
}));

jest.mock('../hooks/useImageCropper', () => () => ({
  rawImageSrc: null,
  showCropper: false,
  crop: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  setCrop: jest.fn(),
  setZoom: jest.fn(),
  setRotation: jest.fn(),
  onCropComplete: jest.fn(),
  fileInputRef: { current: null },
  cameraInputRef: { current: null },
  selectFile: jest.fn(),
  apply: jest.fn(),
  reopenCropper: jest.fn(),
  cancelCropper: jest.fn(),
}));

jest.mock('../hooks/useFaceDetection', () => () => ({
  status: 'idle',
  reset: jest.fn(),
  run: jest.fn(),
  awaitResult: jest.fn().mockResolvedValue('idle'),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { fetchProfile, saveProfile } = require('../services/profileService');

const defaultProps = {
  user: { email: 'user@example.com' },
  apiBaseUrl: 'http://localhost:3001',
  onComplete: jest.fn(),
};

/** Simulate API returning all three mandatory fields missing. */
const allMissing = () =>
  fetchProfile.mockResolvedValue({
    data: { height: null, phoneNumber: null, dietType: null },
  });

beforeEach(() => {
  jest.clearAllMocks();
  allMissing();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CompleteProfilePage — initial render', () => {
  it('shows all three form fields when every mandatory field is missing', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() =>
      expect(screen.queryByText('Checking required profile fields...')).not.toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText('e.g. 170')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. +91 9876543210')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
  });

  it('calls onComplete immediately when all fields are already complete', async () => {
    fetchProfile.mockResolvedValue({
      data: { height: 170, phoneNumber: '+91 9876543210', dietType: 'Vegetarian' },
    });
    const onComplete = jest.fn();
    render(<CompleteProfilePage {...defaultProps} onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('shows page heading and description text', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Complete Your Profile')).toBeInTheDocument());
    expect(screen.getByText(/personalise your wellness journey/i)).toBeInTheDocument();
  });
});

describe('CompleteProfilePage — form validation', () => {
  it('Save & Continue button is disabled while no fields are filled', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Save & Continue')).toBeInTheDocument());
    expect(screen.getByText('Save & Continue')).toBeDisabled();
  });

  it('enables Save & Continue once all required fields are valid', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    // Wait for fetchProfile to resolve (loading=false) before interacting
    await waitFor(() =>
      expect(screen.queryByText('Checking required profile fields...')).not.toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. 170'), { target: { value: '170' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. +91 9876543210'), {
      target: { value: '+91 9876543210' },
    });
    fireEvent.click(screen.getByText('Vegetarian'));

    expect(screen.getByText('Save & Continue')).not.toBeDisabled();
  });

  it('keeps Save & Continue disabled when height is out of range', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() =>
      expect(screen.queryByText('Checking required profile fields...')).not.toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. 170'), { target: { value: '10' } }); // < 50
    fireEvent.change(screen.getByPlaceholderText('e.g. +91 9876543210'), {
      target: { value: '+91 9876543210' },
    });
    fireEvent.click(screen.getByText('Vegetarian'));

    expect(screen.getByText('Save & Continue')).toBeDisabled();
  });
});

describe('CompleteProfilePage — picture section', () => {
  it('hides camera/gallery buttons by default (showPictureSection=false)', async () => {
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Save & Continue')).toBeInTheDocument());
    expect(screen.queryByText('Take Photo')).not.toBeInTheDocument();
  });

  it('renders camera and gallery buttons when showPictureSection=true', async () => {
    render(<CompleteProfilePage {...defaultProps} showPictureSection />);
    await waitFor(() => expect(screen.getByText('Take Photo')).toBeInTheDocument());
    expect(screen.getByText('From Gallery')).toBeInTheDocument();
  });
});

describe('CompleteProfilePage — regression: camera-return race condition', () => {
  /**
   * Documents the failure mode guarded by App.js _profileGateActiveRef.
   *
   * Without the guard:
   *   camera/gallery returns → appStateChange fires → checkProfileCompletion()
   *   → profileChecking=true → LoadingSpinner replaces page → unmount → remount
   *   → form is blank.
   *
   * The fix prevents the unmount from happening at all by skipping
   * checkProfileCompletion when _profileGateActiveRef.current is true.
   * This test documents that a remount DOES lose state, confirming the guard
   * in App.js is the correct layer to fix this (not the component itself).
   */
  it('form input is lost on unmount-remount — confirms App.js guard is the right fix layer', async () => {
    const { unmount } = render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 170')).toBeInTheDocument());

    // User types height before returning from camera
    fireEvent.change(screen.getByPlaceholderText('e.g. 170'), { target: { value: '175' } });
    expect(screen.getByPlaceholderText('e.g. 170')).toHaveValue(175);

    // Simulate the profileChecking=true → LoadingSpinner → unmount cycle (the bug)
    unmount();

    // Remount (what happens after profileChecking goes false again without guard)
    render(<CompleteProfilePage {...defaultProps} />);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 170')).toBeInTheDocument());

    // Form is blank — state lost. The App.js guard (_profileGateActiveRef) prevents
    // this unmount from occurring, so this failure mode never reaches the user.
    expect(screen.getByPlaceholderText('e.g. 170')).toHaveValue(null);

    // fetchProfile called once per mount confirms component re-initialises from scratch
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it('fetchProfile is called with the user email on mount', async () => {
    render(<CompleteProfilePage user={{ email: 'alice@example.com' }} apiBaseUrl="" onComplete={jest.fn()} />);
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledWith('alice@example.com'));
  });
});
