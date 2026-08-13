import { resolveTeamSearchDisplayName, formatMemberSubtitle, filterMembers } from './teamSearchService';

describe('resolveTeamSearchDisplayName', () => {
  const user = {
    email: 'adhithya5518@example.com',
    phoneNumber: '+919876543210',
    username: 'adhithya5518',
    name: 'adhithya5518',
  };

  it('never falls back to email local-part while profile name is loading', () => {
    expect(resolveTeamSearchDisplayName('', user)).toBe('');
  });

  it('returns saved profile UserName when valid', () => {
    expect(resolveTeamSearchDisplayName('Adithya', user)).toBe('Adithya');
  });

  it('rejects saved name that matches email local-part', () => {
    expect(resolveTeamSearchDisplayName('adhithya5518', user)).toBe('');
  });

  it('accepts a valid auth userName when saved name is empty', () => {
    expect(resolveTeamSearchDisplayName('', {
      ...user,
      userName: 'Adithya K',
      username: 'adhithya5518',
    })).toBe('Adithya K');
  });
});

describe('formatMemberSubtitle', () => {
  it('joins email and community id with a pipe', () => {
    expect(formatMemberSubtitle('yasheer@gmail.com', 'WB12345'))
      .toBe('yasheer@gmail.com | WB12345');
  });

  it('shows only community id when email is missing', () => {
    expect(formatMemberSubtitle('', 'WB12345')).toBe('WB12345');
  });

  it('shows only email when community id is missing', () => {
    expect(formatMemberSubtitle('yasheer@gmail.com', null)).toBe('yasheer@gmail.com');
  });

  it('never returns a bare pipe', () => {
    expect(formatMemberSubtitle('  ', '  ')).toBe('');
  });
});

describe('filterMembers', () => {
  const members = [
    { userId: 1, userName: 'Mohamed Yasheer', email: 'yasheer@gmail.com', communityId: 'WB12345' },
  ];

  it('matches community id', () => {
    expect(filterMembers(members, 'wb12')).toHaveLength(1);
  });
});
