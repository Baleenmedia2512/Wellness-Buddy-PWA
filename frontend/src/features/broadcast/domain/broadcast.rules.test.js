import {
  BROADCAST_HOWTO_SCENES,
  BROADCAST_VIEWS,
  isBroadcastCampaignAvailable,
  resolveBroadcastView,
} from './broadcast.rules';

describe('resolveBroadcastView', () => {
  it('opens the payment screen from the make-a-payment action', () => {
    expect(resolveBroadcastView(BROADCAST_VIEWS.PAYMENT)).toBe('payment');
  });

  it('stays on the intro screen for any other view', () => {
    expect(resolveBroadcastView(BROADCAST_VIEWS.INTRO)).toBe('intro');
    expect(resolveBroadcastView(undefined)).toBe('intro');
    expect(resolveBroadcastView('campaign')).toBe('intro');
  });
});

describe('isBroadcastCampaignAvailable', () => {
  it('keeps upload and Burst unavailable until recharge is complete', () => {
    expect(isBroadcastCampaignAvailable(false)).toBe(false);
    expect(isBroadcastCampaignAvailable(undefined)).toBe(false);
    expect(isBroadcastCampaignAvailable(true)).toBe(true);
  });
});

describe('BROADCAST_HOWTO_SCENES', () => {
  it('explains payment, upload, Burst, and a new recharge', () => {
    const text = BROADCAST_HOWTO_SCENES.map((scene) => `${scene.title} ${scene.caption}`).join(' ');
    expect(text).toMatch(/payment/i);
    expect(text).toMatch(/upload/i);
    expect(text).toMatch(/Burst/);
    expect(text).toMatch(/WhatsApp Status/);
    expect(text).toMatch(/Instagram/);
    expect(text).toMatch(/Recharge again/);
  });
});
