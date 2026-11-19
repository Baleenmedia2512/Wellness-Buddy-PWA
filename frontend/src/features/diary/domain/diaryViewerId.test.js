import { diaryViewerIdAfterAccountLookup } from './diaryViewerId';

describe('diaryViewerIdAfterAccountLookup', () => {
  it('uses the account id when the session id is stale', () => {
    expect(diaryViewerIdAfterAccountLookup('3396', { success: true, userId: 339 })).toBe('339');
  });

  it('keeps the session id when lookup does not find an account', () => {
    expect(diaryViewerIdAfterAccountLookup('3396', { success: false })).toBe('3396');
    expect(diaryViewerIdAfterAccountLookup(339, null)).toBe('339');
  });
});
