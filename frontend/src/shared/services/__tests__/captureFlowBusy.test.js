/**
 * @jest-environment node
 */
import {
  setCaptureFlowBusy,
  isCaptureFlowBusy,
  subscribeCaptureFlowBusy,
  __resetCaptureFlowBusyForTests,
} from '../captureFlowBusy';

describe('captureFlowBusy', () => {
  beforeEach(() => {
    __resetCaptureFlowBusyForTests();
  });

  it('notifies subscribers when busy flips', () => {
    const seen = [];
    const unsubscribe = subscribeCaptureFlowBusy((busy) => seen.push(busy));

    setCaptureFlowBusy(true);
    setCaptureFlowBusy(true); // no-op duplicate
    setCaptureFlowBusy(false);

    expect(seen).toEqual([true, false]);
    unsubscribe();
    setCaptureFlowBusy(true);
    expect(seen).toEqual([true, false]);
  });

  it('exposes current busy state', () => {
    expect(isCaptureFlowBusy()).toBe(false);
    setCaptureFlowBusy(true);
    expect(isCaptureFlowBusy()).toBe(true);
  });
});
