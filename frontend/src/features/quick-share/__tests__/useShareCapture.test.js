/**
 * frontend/src/features/quick-share/__tests__/useShareCapture.test.js
 */
import { renderHook, act } from '@testing-library/react';
import { useShareCapture } from '../hooks/useShareCapture';

jest.mock('../../../shared/services/cameraService', () => ({
  __esModule: true,
  default: { takePhoto: jest.fn() },
  cameraService: { takePhoto: jest.fn() },
}));

jest.mock('../../../shared/utils/shareUtils', () => ({
  shareImageDirectly: jest.fn(),
}));

jest.mock('../../../shared/utils/logger', () => ({
  debugLog: jest.fn(),
}));

jest.mock('../api/captures.client', () => ({
  createCapture: jest.fn(),
}));

import { cameraService } from '../../../shared/services/cameraService';
import { shareImageDirectly } from '../../../shared/utils/shareUtils';
import { createCapture } from '../api/captures.client';

const PHOTO = { success: true, src: 'data:image/jpeg;base64,abc' };
const VIEW_URL = 'https://api.example.com/s/00000000-0000-4000-8000-000000000000';

beforeEach(() => jest.clearAllMocks());

describe('useShareCapture - happy path (with userId)', () => {
  it('uploads then shares with the viewUrl embedded in the caption', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    createCapture.mockResolvedValue({ success: true, token: 't', viewUrl: VIEW_URL });
    shareImageDirectly.mockResolvedValue();
    const onDone = jest.fn();

    const { result } = renderHook(() => useShareCapture({ onDone, userId: 42 }));
    await act(async () => { await result.current.capture(); });

    expect(createCapture).toHaveBeenCalledWith({
      userId: '42', imageBase64: PHOTO.src,
    });
    expect(shareImageDirectly).toHaveBeenCalledWith(
      PHOTO.src,
      expect.objectContaining({
        title: 'Wellness Valley',
        text: expect.stringContaining(VIEW_URL),
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - upload fails', () => {
  it('still shares the image (without caption) and goes Home', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    createCapture.mockRejectedValue(new Error('Network down'));
    shareImageDirectly.mockResolvedValue();
    const onDone = jest.fn();

    const { result } = renderHook(() => useShareCapture({ onDone, userId: '42' }));
    await act(async () => { await result.current.capture(); });

    expect(shareImageDirectly).toHaveBeenCalledWith(
      PHOTO.src,
      expect.objectContaining({ text: '' }),
    );
    expect(result.current.errorMsg).toBe('Network down');
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - no userId', () => {
  it('skips upload entirely and shares without caption', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    shareImageDirectly.mockResolvedValue();

    const { result } = renderHook(() => useShareCapture({ onDone: jest.fn() }));
    await act(async () => { await result.current.capture(); });

    expect(createCapture).not.toHaveBeenCalled();
    expect(shareImageDirectly).toHaveBeenCalledWith(
      PHOTO.src,
      expect.objectContaining({ text: '' }),
    );
  });
});

describe('useShareCapture - user cancels camera', () => {
  it('calls onDone without uploading or sharing', async () => {
    cameraService.takePhoto.mockResolvedValue({ success: false });
    const onDone = jest.fn();
    const { result } = renderHook(() => useShareCapture({ onDone, userId: '1' }));

    await act(async () => { await result.current.capture(); });

    expect(createCapture).not.toHaveBeenCalled();
    expect(shareImageDirectly).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - share fails after successful upload', () => {
  it('sets status=error but still calls onDone', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    createCapture.mockResolvedValue({ viewUrl: VIEW_URL });
    shareImageDirectly.mockRejectedValue(new Error('Share failed'));
    const onDone = jest.fn();
    const { result } = renderHook(() => useShareCapture({ onDone, userId: '1' }));

    await act(async () => { await result.current.capture(); });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMsg).toBe('Share failed');
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - debounce double-tap', () => {
  it('ignores second tap while first is in flight', async () => {
    let resolvePhoto;
    cameraService.takePhoto.mockReturnValue(new Promise(r => { resolvePhoto = r; }));
    createCapture.mockResolvedValue({ viewUrl: VIEW_URL });
    shareImageDirectly.mockResolvedValue();
    const { result } = renderHook(() => useShareCapture({ onDone: jest.fn(), userId: '1' }));

    const first  = act(async () => { result.current.capture(); });
    const second = act(async () => { result.current.capture(); });
    resolvePhoto(PHOTO);
    await first; await second;

    expect(cameraService.takePhoto).toHaveBeenCalledTimes(1);
  });
});
