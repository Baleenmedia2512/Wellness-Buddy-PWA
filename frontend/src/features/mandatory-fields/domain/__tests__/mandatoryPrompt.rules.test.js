import { editorPlan, FIELD_EDITORS } from '../fieldEditors';
import {
  canSkipField,
  failureLocksApp,
  graceStatusText,
  isBelowEditorVersion,
  reminderText,
  partitionOutstanding,
  rowsAfterVisitDismiss,
  rowsToShow,
  screenIsLocked,
  profileFormRequiredMarks,
  profileFormSubtitle,
  completeProfileNeedsScreen,
  holdTransformationPhotos,
  shouldEnableMandatoryGate,
  shouldReloadOnResume,
  skipAction,
  visitDismissAction,
} from '../mandatoryPrompt.rules';

const readyUser = {
  user: { id: 7 },
  isOtpVerified: true,
  isUserActive: true,
  showConsentGate: false,
  showOnboardingIdentity: false,
  showCompleteProfile: false,
  showOnboardingTransformationPhotos: false,
  showPhysicalActivitySetup: false,
  showSetupWizard: false,
  showValidateOTP: false,
  isInactiveReactivationFlow: false,
  profileChecking: false,
};

describe('mandatory gate timing', () => {
  it('waits for new-user onboarding screens', () => {
    expect(shouldEnableMandatoryGate({ ...readyUser, showCompleteProfile: true })).toBe(false);
    expect(shouldEnableMandatoryGate({ ...readyUser, showSetupWizard: true })).toBe(false);
    expect(shouldEnableMandatoryGate({ ...readyUser, showConsentGate: true })).toBe(false);
    expect(shouldEnableMandatoryGate({ ...readyUser, profileChecking: true })).toBe(false);
    expect(shouldEnableMandatoryGate({ ...readyUser, showValidateOTP: true })).toBe(false);
  });

  it('opens for an existing user after login once onboarding is clear', () => {
    expect(shouldEnableMandatoryGate(readyUser)).toBe(true);
  });

  it('asks for required profile fields before Left, Centre, and Right', () => {
    expect(shouldEnableMandatoryGate({ ...readyUser, showOnboardingTransformationPhotos: true })).toBe(true);
    expect(holdTransformationPhotos({ photosRequested: true, gateEnabled: true, mandatoryStatus: 'checking' })).toBe(true);
    expect(holdTransformationPhotos({ photosRequested: true, gateEnabled: true, mandatoryStatus: 'blocked' })).toBe(true);
    expect(holdTransformationPhotos({ photosRequested: true, gateEnabled: true, mandatoryStatus: 'clear' })).toBe(false);
    expect(holdTransformationPhotos({ photosRequested: true, gateEnabled: false, mandatoryStatus: 'blocked' })).toBe(false);
  });

  it('reloads on resume unless an editor is open', () => {
    expect(shouldReloadOnResume({ enabled: true, editing: null })).toBe(true);
    expect(shouldReloadOnResume({ enabled: true, editing: 'email' })).toBe(false);
    expect(shouldReloadOnResume({ enabled: false, editing: null })).toBe(false);
  });
});

describe('member prompt rows', () => {
  const grace = {
    fieldKey: 'diet',
    blocking: false,
    showPrompt: true,
    graceType: 'days',
    remaining: 2,
    remindEveryDays: 0,
  };
  const quiet = { ...grace, fieldKey: 'phone', showPrompt: false, remindEveryDays: 3 };
  const blocking = {
    fieldKey: 'name',
    blocking: true,
    showPrompt: true,
    graceType: 'skips',
    remaining: 0,
    remindEveryDays: 3,
  };

  it('shows only due grace fields when nothing is blocking', () => {
    const rows = rowsToShow({ blocked: false, fields: [grace, quiet] });
    expect(rows.map((row) => row.fieldKey)).toEqual(['diet']);
    expect(screenIsLocked({ blocked: false, fields: [grace, quiet] })).toBe(false);
  });

  it('puts zero-grace fields on the required list and grace fields on the skip list', () => {
    const split = partitionOutstanding([blocking, grace]);
    expect(split.requiredNow.map((row) => row.fieldKey)).toEqual(['name']);
    expect(split.grace.map((row) => row.fieldKey)).toEqual(['diet']);
  });

  it('shows every outstanding field together when one is blocking', () => {
    const evaluation = { blocked: true, fields: [blocking, grace, quiet] };
    expect(rowsToShow(evaluation).map((row) => row.fieldKey)).toEqual(['name', 'diet', 'phone']);
    expect(screenIsLocked(evaluation)).toBe(true);
  });

  it('hides skip on blocking fields and keeps it during grace', () => {
    expect(canSkipField(blocking)).toBe(false);
    expect(skipAction(blocking)).toMatchObject({ kind: 'blocked', marksComplete: false, extendsDaysGrace: false });
    expect(canSkipField(grace)).toBe(true);
    expect(skipAction(grace)).toMatchObject({ kind: 'skip', marksComplete: false, extendsDaysGrace: false });
  });

  it('continue dismisses a grace row for this visit and never a blocking row', () => {
    expect(visitDismissAction(grace)).toEqual({ kind: 'visit-dismiss', callsSkipApi: false });
    expect(visitDismissAction(blocking).kind).toBe('blocked');
    const left = rowsAfterVisitDismiss([blocking, grace], ['diet']);
    expect(left.map((row) => row.fieldKey)).toEqual(['name']);
  });

  it('unlocks when blocking fields are gone even if a grace field remains', () => {
    const evaluation = { blocked: false, fields: [grace] };
    expect(screenIsLocked(evaluation)).toBe(false);
    expect(rowsToShow(evaluation)).toHaveLength(1);
  });

  it('describes remaining days and skips', () => {
    expect(graceStatusText(grace)).toMatch(/2 days/);
    expect(graceStatusText({ ...grace, graceType: 'skips', remaining: 1 })).toMatch(/1 skip/);
    expect(graceStatusText({ ...grace, graceType: 'skips', remaining: 0, blocking: true })).toMatch(/Skip is not available/);
    expect(graceStatusText(blocking)).toMatch(/Skip is not available/);
    expect(reminderText({ remindEveryDays: 0 })).toMatch(/every visit/);
    expect(reminderText({ remindEveryDays: 3 })).toMatch(/3 days/);
  });
});

describe('version and failures', () => {
  it('refuses an editor the installed app cannot open', () => {
    expect(isBelowEditorVersion('3.5.5', '3.5.6')).toBe(true);
    expect(isBelowEditorVersion('3.5.6', '3.5.6')).toBe(false);
    expect(isBelowEditorVersion(null, '3.5.6')).toBe(true);
    expect(isBelowEditorVersion('3.5.0', '3.5.0')).toBe(false);
  });

  it('locks when the profile check fails, including a network error with no status', () => {
    expect(failureLocksApp({ status: 503, code: 'PROFILE_UNAVAILABLE' })).toBe(true);
    expect(failureLocksApp({ status: 500 })).toBe(true);
    expect(failureLocksApp({ status: null, message: 'Failed to fetch' })).toBe(true);
    expect(failureLocksApp(null)).toBe(false);
  });

  it('continue cannot hide a blocking field in a mixed list', () => {
    const blocking = { fieldKey: 'name', blocking: true, showPrompt: true };
    const grace = { fieldKey: 'diet', blocking: false, showPrompt: true, remindEveryDays: 0 };
    const evaluation = { blocked: true, fields: [blocking, grace] };
    expect(screenIsLocked(evaluation)).toBe(true);
    expect(visitDismissAction(blocking).kind).toBe('blocked');
    expect(visitDismissAction(grace).kind).toBe('visit-dismiss');
    expect(rowsAfterVisitDismiss(rowsToShow(evaluation), ['diet']).map((row) => row.fieldKey)).toEqual(['name']);
  });

  it('shows an interval of zero again after the visit dismiss is cleared', () => {
    const field = { fieldKey: 'phone', blocking: false, showPrompt: true, remindEveryDays: 0 };
    const evaluation = { blocked: false, fields: [field] };
    expect(rowsToShow(evaluation).map((row) => row.fieldKey)).toEqual(['phone']);
    expect(rowsAfterVisitDismiss(rowsToShow(evaluation), ['phone'])).toEqual([]);
    expect(rowsAfterVisitDismiss(rowsToShow(evaluation), [])).toEqual([field]);
  });
});

describe('complete profile required marks', () => {
  it('stars only fields the admin made blocking now', () => {
    const marks = profileFormRequiredMarks([
      { fieldKey: 'gender', blocking: false },
      { fieldKey: 'height', blocking: true },
      { fieldKey: 'email', blocking: true },
      { fieldKey: 'diet', blocking: true },
      { fieldKey: 'bodyFat', blocking: false },
    ]);
    expect(marks).toEqual({
      name: false,
      gender: false,
      height: true,
      diet: true,
      bodyFat: false,
    });
    expect(profileFormSubtitle(marks)).toBe('Height and diet — then transformation photos.');
  });

  it('requires nothing when every rule is off or still in grace', () => {
    const marks = profileFormRequiredMarks([
      { fieldKey: 'gender', blocking: false },
      { fieldKey: 'communityId', blocking: true },
    ]);
    expect(marks).toEqual({
      name: false,
      gender: false,
      height: false,
      diet: false,
      bodyFat: false,
    });
    expect(profileFormSubtitle(marks)).toBe('Add any details you want — then transformation photos.');
    expect(profileFormSubtitle(profileFormRequiredMarks([]))).toBe(
      'Add any details you want — then transformation photos.',
    );
    expect(profileFormSubtitle(profileFormRequiredMarks([
      { fieldKey: 'gender', blocking: true },
    ]))).toBe('Gender — then transformation photos.');
    expect(completeProfileNeedsScreen([])).toBe(false);
    expect(completeProfileNeedsScreen([
      { fieldKey: 'gender', blocking: false },
      { fieldKey: 'email', blocking: true },
    ])).toBe(false);
    expect(completeProfileNeedsScreen([
      { fieldKey: 'height', blocking: true },
    ])).toBe(true);
  });
});

describe('existing editors', () => {
  it('keeps OTP fields on their current editors', () => {
    expect(editorPlan('email')).toEqual({ editor: 'ProfileEmailKycSection', otp: 'kyc-otp' });
    expect(editorPlan('communityId')).toEqual({ editor: 'CommunityIdField', otp: 'sponsor-otp' });
    expect(editorPlan('communityPosition')).toEqual({ editor: 'CommunityPositionField', otp: 'coach-otp' });
    expect(editorPlan('height')).toEqual({ editor: 'HeightField', otp: 'height-change-otp' });
    expect(editorPlan('notAColumn')).toBeNull();
    expect(Object.keys(FIELD_EDITORS)).toEqual([
      'name',
      'gender',
      'height',
      'diet',
      'bodyFat',
      'email',
      'phone',
      'communityId',
      'communityPosition',
      'physicalActivity',
      'bmr',
    ]);
  });
});
