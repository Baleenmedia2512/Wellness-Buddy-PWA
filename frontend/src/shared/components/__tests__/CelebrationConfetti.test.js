/**
 * CelebrationConfetti.test.js — Unit tests for celebration confetti component.
 *
 * Tests rendering, animation lifecycle, and sound playback.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CelebrationConfetti from '../CelebrationConfetti';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock Web Audio API
const mockAudioContext = {
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    frequency: { value: 0 },
    type: 'sine',
    start: jest.fn(),
    stop: jest.fn(),
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
    },
  })),
  destination: {},
  currentTime: 0,
};

global.AudioContext = jest.fn(() => mockAudioContext);
global.webkitAudioContext = jest.fn(() => mockAudioContext);

describe('CelebrationConfetti', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should not render when show is false', () => {
    const { container } = render(
      <CelebrationConfetti show={false} onComplete={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render confetti canvas when show is true', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} />
    );
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should display the default message', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} />
    );
    expect(screen.getByText('Amazing!')).toBeInTheDocument();
    expect(screen.getByText('🎉 Great Progress!')).toBeInTheDocument();
  });

  it('should display custom message when provided', () => {
    const customMessage = 'You lost 2.5 kg! Keep going! 💪';
    render(
      <CelebrationConfetti
        show={true}
        onComplete={jest.fn()}
        message={customMessage}
      />
    );
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('should call onComplete after 3 seconds', async () => {
    const onComplete = jest.fn();
    render(
      <CelebrationConfetti show={true} onComplete={onComplete} />
    );

    expect(onComplete).not.toHaveBeenCalled();

    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('should play celebration sound when playSound is true', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} playSound={true} />
    );

    expect(global.AudioContext).toHaveBeenCalled();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('should not play sound when playSound is false', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} playSound={false} />
    );

    expect(global.AudioContext).not.toHaveBeenCalled();
  });

  it('should initialize canvas with correct dimensions', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} />
    );
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toHaveAttribute('class');
    expect(canvas?.className).toContain('absolute');
  });

  it('should handle audio context creation failure gracefully', () => {
    // Mock AudioContext to throw error
    global.AudioContext = jest.fn(() => {
      throw new Error('AudioContext not supported');
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} playSound={true} />
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Audio context not supported:',
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });

  it('should render party emoji in the message card', () => {
    render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} />
    );
    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('should have pointer-events-none on overlay to not block interaction', () => {
    const { container } = render(
      <CelebrationConfetti show={true} onComplete={jest.fn()} />
    );
    const overlay = container.querySelector('.pointer-events-none');
    expect(overlay).toBeInTheDocument();
  });
});
