/**
 * BroadCast screen rules.
 *
 * Paid flow for this release:
 *   intro (how-to video) → payment screen
 *
 * Upload and Burst stay unavailable until a recharge is completed.
 * Charging is not connected on the payment screen yet.
 */

export const BROADCAST_VIEWS = Object.freeze({
  INTRO: 'intro',
  PAYMENT: 'payment',
});

export const BROADCAST_HOWTO_SCENES = Object.freeze([
  {
    id: 'intro',
    title: 'BroadCast',
    caption: 'A paid campaign that shares one picture with your contacts.',
  },
  {
    id: 'recharge',
    title: 'Make a payment',
    caption: 'Recharge once. That recharge runs one campaign.',
  },
  {
    id: 'upload',
    title: 'Upload a picture',
    caption: 'After the recharge is complete, you get the upload screen.',
  },
  {
    id: 'burst',
    title: 'Tap Burst',
    caption: 'Your picture is posted to your WhatsApp Status, and an Instagram ad runs for your contact numbers.',
  },
  {
    id: 'done',
    title: 'Campaign ends',
    caption: 'When it finishes, BroadCast stops. Recharge again to start a new campaign.',
  },
]);

/**
 * @param {string|null|undefined} view
 * @returns {'intro'|'payment'}
 */
export function resolveBroadcastView(view) {
  return view === BROADCAST_VIEWS.PAYMENT
    ? BROADCAST_VIEWS.PAYMENT
    : BROADCAST_VIEWS.INTRO;
}

/**
 * Upload and Burst are withheld while the member is on the intro or payment screen.
 * @param {boolean} rechargeActive
 * @returns {boolean}
 */
export function isBroadcastCampaignAvailable(rechargeActive) {
  return rechargeActive === true;
}
