import { canConfigureMandatoryFields, registeredAdminFields, validateAdminRuleDraft } from '../adminRuleDraft';

const nameField = { fieldKey: 'name', label: 'Name', editorMinAppVersion: '3.5.0' };
const positionField = { fieldKey: 'communityPosition', label: 'Community Position', editorMinAppVersion: '3.5.6' };

function draft(overrides = {}) {
  return {
    required: true,
    audience: 'both',
    graceType: 'days',
    graceLimit: 3,
    minAppVersion: '3.5.0',
    remindEveryDays: 3,
    notifyEnabled: true,
    positionScope: 'all',
    positionCodes: [],
    ...overrides,
  };
}

describe('mandatory fields admin access', () => {
  it('allows admin and developer only', () => {
    expect(canConfigureMandatoryFields('admin')).toBe(true);
    expect(canConfigureMandatoryFields('developer')).toBe(true);
    expect(canConfigureMandatoryFields('user')).toBe(false);
    expect(canConfigureMandatoryFields('coach')).toBe(false);
    expect(canConfigureMandatoryFields('upline')).toBe(false);
    expect(canConfigureMandatoryFields(null)).toBe(false);
  });
});

describe('registered admin fields', () => {
  it('keeps registry rows and drops column-like or unlabeled rows', () => {
    const rows = registeredAdminFields([
      { fieldKey: 'name', label: 'Name' },
      { fieldKey: 'Email', label: 'Raw column' },
      { fieldKey: 'phone', label: 'Phone' },
      { fieldKey: 'team_table.Height' },
      { label: 'Missing key' },
      null,
    ]);
    expect(rows.map((row) => row.fieldKey)).toEqual(['name', 'phone']);
  });
});

describe('validateAdminRuleDraft', () => {
  it('accepts days grace, audience, reminder interval, and a required flag', () => {
    const result = validateAdminRuleDraft(draft({ audience: 'member', graceType: 'days', graceLimit: 0, remindEveryDays: 0 }), nameField);
    expect(result.ok).toBe(true);
    expect(result.rule).toMatchObject({
      required: true,
      audience: 'member',
      graceType: 'days',
      graceLimit: 0,
      remindEveryDays: 0,
      notifyEnabled: true,
    });
  });

  it('accepts skips grace for coaches', () => {
    const result = validateAdminRuleDraft(draft({ audience: 'coach', graceType: 'skips', graceLimit: 2 }), nameField);
    expect(result.ok).toBe(true);
    expect(result.rule.graceType).toBe('skips');
    expect(result.rule.graceLimit).toBe(2);
    expect(result.rule.audience).toBe('coach');
  });

  it('rejects a version below the editor floor', () => {
    const result = validateAdminRuleDraft(draft({ minAppVersion: '3.5.5' }), positionField);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/3\.5\.6/);
  });

  it('requires at least one community position code when scope is specific', () => {
    const missing = validateAdminRuleDraft(draft({ minAppVersion: '3.5.6', positionScope: 'specific', positionCodes: [' ', ''] }), positionField);
    expect(missing.ok).toBe(false);
    const saved = validateAdminRuleDraft(draft({
      minAppVersion: '3.5.6',
      positionScope: 'specific',
      positionCodes: ['pc', 'GET TEAM', 'pc'],
    }), positionField);
    expect(saved.ok).toBe(true);
    expect(saved.rule.positionCodes).toEqual(['PC', 'GET TEAM']);
    expect(saved.rule.positionScope).toBe('specific');
  });

  it('rejects bad audience, grace, and reminder values', () => {
    expect(validateAdminRuleDraft(draft({ audience: 'admin' }), nameField).ok).toBe(false);
    expect(validateAdminRuleDraft(draft({ graceType: 'hours' }), nameField).ok).toBe(false);
    expect(validateAdminRuleDraft(draft({ graceLimit: -1 }), nameField).ok).toBe(false);
    expect(validateAdminRuleDraft(draft({ graceLimit: 1.5 }), nameField).ok).toBe(false);
    expect(validateAdminRuleDraft(draft({ remindEveryDays: -2 }), nameField).ok).toBe(false);
  });

  it('does not invent database columns in the saved rule', () => {
    const result = validateAdminRuleDraft(draft(), nameField);
    expect(Object.keys(result.rule).sort()).toEqual([
      'audience',
      'graceLimit',
      'graceType',
      'minAppVersion',
      'notifyEnabled',
      'positionCodes',
      'positionScope',
      'remindEveryDays',
      'required',
    ]);
  });
});
