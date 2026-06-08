import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UnknownShareViewer from '../components/UnknownShareViewer.jsx';

const IMG = 'iVBORw0KGgo='; // dummy base64 body

describe('<UnknownShareViewer />', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UnknownShareViewer isOpen={false} imageBase64={IMG} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the image and hides Retry/Edit for a viewer who cannot mutate', () => {
    render(<UnknownShareViewer isOpen imageBase64={IMG} canMutate={false} />);
    expect(screen.getByTestId('unknown-share-image')).toBeTruthy();
    expect(screen.queryByTestId('unknown-share-retry')).toBeNull();
    expect(screen.queryByTestId('unknown-share-edit')).toBeNull();
  });

  it('shows Retry and Edit when canMutate is true', () => {
    render(<UnknownShareViewer isOpen imageBase64={IMG} canMutate />);
    expect(screen.getByTestId('unknown-share-retry')).toBeTruthy();
    expect(screen.getByTestId('unknown-share-edit')).toBeTruthy();
  });

  it('normalises a raw base64 string into a data URL', () => {
    render(<UnknownShareViewer isOpen imageBase64={IMG} canMutate />);
    const img = screen.getByTestId('unknown-share-image');
    expect(img.getAttribute('src')).toBe(`data:image/jpeg;base64,${IMG}`);
  });

  it('passes a full data URL through unchanged', () => {
    const dataUrl = `data:image/png;base64,${IMG}`;
    render(<UnknownShareViewer isOpen imageBase64={dataUrl} canMutate />);
    expect(screen.getByTestId('unknown-share-image').getAttribute('src')).toBe(dataUrl);
  });

  it('shows a placeholder when no image is provided', () => {
    render(<UnknownShareViewer isOpen imageBase64={null} canMutate />);
    expect(screen.getByTestId('unknown-share-image-missing')).toBeTruthy();
  });

  it('fires onRetry / onEdit / onClose callbacks', () => {
    const onRetry = jest.fn();
    const onEdit = jest.fn();
    const onClose = jest.fn();
    render(
      <UnknownShareViewer
        isOpen
        imageBase64={IMG}
        canMutate
        onRetry={onRetry}
        onEdit={onEdit}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('unknown-share-retry'));
    fireEvent.click(screen.getByTestId('unknown-share-edit'));
    fireEvent.click(screen.getByTestId('unknown-share-close'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the buttons and shows progress text while retrying', () => {
    render(<UnknownShareViewer isOpen imageBase64={IMG} canMutate retrying />);
    const retry = screen.getByTestId('unknown-share-retry');
    expect(retry.disabled).toBe(true);
    expect(retry.textContent).toMatch(/Retrying/);
  });

  it('renders an error message when provided', () => {
    render(<UnknownShareViewer isOpen imageBase64={IMG} canMutate error="Still couldn't recognise it" />);
    expect(screen.getByTestId('unknown-share-error').textContent).toMatch(/recognise/);
  });
});
