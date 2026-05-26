import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UnknownCaptureModal from '../components/UnknownCaptureModal.jsx';

describe('<UnknownCaptureModal />', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UnknownCaptureModal isOpen={false} onClose={() => {}} onPick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders three picker buttons when open', () => {
    render(<UnknownCaptureModal isOpen onClose={() => {}} onPick={() => {}} />);
    expect(screen.getByTestId('unknown-capture-pick-food')).toBeTruthy();
    expect(screen.getByTestId('unknown-capture-pick-weight')).toBeTruthy();
    expect(screen.getByTestId('unknown-capture-pick-education')).toBeTruthy();
  });

  it('calls onPick with the chosen type', () => {
    const onPick = jest.fn();
    render(<UnknownCaptureModal isOpen onClose={() => {}} onPick={onPick} />);
    fireEvent.click(screen.getByTestId('unknown-capture-pick-weight'));
    expect(onPick).toHaveBeenCalledWith('weight');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(<UnknownCaptureModal isOpen onClose={onClose} onPick={() => {}} />);
    fireEvent.click(screen.getByTestId('unknown-capture-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<UnknownCaptureModal isOpen onClose={onClose} onPick={() => {}} />);
    fireEvent.click(screen.getByTestId('unknown-capture-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
