/**
 * Which existing editor each mandatory field opens.
 * OTP kinds match the profile flows already used on Home Profile.
 */
export const FIELD_EDITORS = {
  name: { editor: 'profile-name', otp: null },
  gender: { editor: 'profile-gender', otp: null },
  height: { editor: 'HeightField', otp: 'height-change-otp' },
  diet: { editor: 'DietDropdown', otp: null },
  bodyFat: { editor: 'profile-body-fat', otp: null },
  email: { editor: 'ProfileEmailKycSection', otp: 'kyc-otp' },
  phone: { editor: 'profile-phone', otp: null },
  communityId: { editor: 'CommunityIdField', otp: 'sponsor-otp' },
  communityPosition: { editor: 'CommunityPositionField', otp: 'coach-otp' },
  physicalActivity: { editor: 'PhysicalActivityField', otp: null },
  bmr: { editor: 'profile-bmr', otp: null },
};

export function editorPlan(fieldKey) {
  return FIELD_EDITORS[fieldKey] || null;
}
