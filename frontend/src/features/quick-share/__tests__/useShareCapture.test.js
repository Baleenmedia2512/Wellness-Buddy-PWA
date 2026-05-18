/**
 * frontend/src/features/quick-share/__tests__/useShareCapture.test.js
 */
import { renderHook, act } from '@testing-library/react';
import { useShareCapture } from '../hooks/useShareCapture';

jest.mock('../../../shared/services/cameraService', () => ({
  __esModule: true,
  default: { takePhoto: jest.fn() },
}));

jest.mock('../../../shared/utils/shareUtils', () => ({
  shareImageDirectly: jest.fn(),
}));

jest.mock('../../../shared/utils/logger', () => ({
  debugLog: jest.fn(),
}));

import cameraService from '../../../shared/services/cameraService';
import { shareImageDirectly } from '../../../shared/utils/shareUtils';

const PHOTO = { success: true, src: 'data:image/jpeg;base64,abc' };

beforeEach(() => jest.clearAllMocks());

describe('useShareCapture - happy path', () => {
  it('calls takePhoto -> shareImageDirectly -> onDone', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    shareImageDirectly.mockResolvedValue();
    const onDone = jest.fn();
    const { result } = renderHook(() => useShareCapture({ onDone }));

    await act(async () => { await result.current.capture(); });

    expect(cameraService.takePhoto).toHaveBeenCalledTimes(1);
    expect(shareImageDirectly).toHaveBeenCalledWith(
      PHOTO.src, expect.objectContaining({ title: 'Wellness Valley' })
    );
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - user cancels camera', () => {
  it('calls onDone without sharing', async () => {
    cameraService.takePhoto.mockResolvedValue({ success: false });
    const onDone = jest.fn();
    const { result } = renderHook(() => useShareCapture({ onDone }));

    await act(async () => { await result.current.capture(); });

    expect(shareImageDirectly).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });
});

describe('useShareCapture - share fails', () => {
  it('sets status=error but still calls onDone', async () => {
    cameraService.takePhoto.mockResolvedValue(PHOTO);
    shareImageDirectly.mockRejectedValue(new Error('Share failed'));
    const onDone = jest.fn();
    const { result } = renderHook(() => useShareCapture({ onDone }));

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
    shareImageDirectly.mockResolvedValue();
    const { result } = renderHook(() => useShareCapture({ onDone: jest.fn() }));

    const first  = act(async () => { result.current.capture(); });
    const second = act(async () => { result.current.capture(); });
    resolvePhoto(PHOTO);
    await first; await second;

    expect(cameraService.takePhoto).toHaveBeenCalledTimes(1);
  });
});
