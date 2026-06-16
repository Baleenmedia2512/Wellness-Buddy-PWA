import { render, waitFor } from '@testing-library/react';
import BodyParamsShareSheet from '../components/BodyParamsShareSheet.jsx';

const mockShareTextViaWhatsApp = jest.fn().mockResolvedValue(true);
const mockShareImageWithLink = jest.fn().mockResolvedValue(undefined);
const mockPrecaptureShareImage = jest.fn().mockResolvedValue('data:image/jpeg;base64,abc');

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => false) },
}));

jest.mock('../../../shared/utils/shareUtils.js', () => ({
  precaptureShareImage: (...args) => mockPrecaptureShareImage(...args),
  shareImageWithLink: (...args) => mockShareImageWithLink(...args),
  shareTextViaWhatsApp: (...args) => mockShareTextViaWhatsApp(...args),
}));

jest.mock('../components/BodyParamsCardPreview.jsx', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => (
    <div ref={ref} data-testid="mock-preview">{props.card?.name}</div>
  ));
});

const SAMPLE_CARD = {
  name: 'Alex',
  age: '30',
  gender: 'Male',
  heightCm: '170',
  weightKg: '70',
  bmi: '24',
  recordedDate: '2026-06-15',
};

describe('BodyParamsShareSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares text immediately on web without waiting for image capture', async () => {
    const onClose = jest.fn();

    render(
      <BodyParamsShareSheet
        isOpen
        onClose={onClose}
        card={SAMPLE_CARD}
        shareUrl="https://example.com/share/bpc/token"
        preCapCard={SAMPLE_CARD}
      />,
    );

    await waitFor(() => {
      expect(mockShareTextViaWhatsApp).toHaveBeenCalledTimes(1);
    });

    expect(mockPrecaptureShareImage).not.toHaveBeenCalled();
    expect(mockShareImageWithLink).not.toHaveBeenCalled();
    expect(mockShareTextViaWhatsApp).toHaveBeenCalledWith(
      expect.stringMatching(/Hey Alex! Install Wellness Valley app\. Click the link/),
    );
    expect(mockShareTextViaWhatsApp).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/share/bpc/token'),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
