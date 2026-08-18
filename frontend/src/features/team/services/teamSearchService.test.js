import {
  resolveTeamSearchDisplayName,
  formatMemberSubtitle,
  filterMembers,
  subtitleCommunityId,
  withDirectCoachCommunityIds,
  toSelectedUser,
} from './teamSearchService';

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

describe('subtitleCommunityId', () => {
  it('returns the member own community id for a regular user', () => {
    expect(subtitleCommunityId({ communityId: '123679034w', role: 'user' }))
      .toBe('123679034w');
  });

  it('shows a downline coach own community id', () => {
    expect(subtitleCommunityId({ communityId: 'W112072823', role: 'coach' }))
      .toBe('W112072823');
  });

  it('hides community id on the searching coach Me row', () => {
    expect(subtitleCommunityId({ communityId: 'C0', role: 'coach', isSelf: true }))
      .toBeNull();
  });

  it('does not fall back to the direct coach community id', () => {
    expect(subtitleCommunityId({
      communityId: null,
      directCoachCommunityId: 'C0',
      role: 'user',
    })).toBeNull();
  });
});

describe('withDirectCoachCommunityIds', () => {
  it('shows root coach CID on direct downline; a2 CID on a2 children', () => {
    const members = withDirectCoachCommunityIds([
      { userId: 10, userName: 'You', email: 'you@x.com', communityId: 'C0', isSelf: true },
      { userId: 1, userName: 'a1', email: 'a1@x.com', communityId: null, coachId: 10 },
      { userId: 2, userName: 'a2', email: 'a2@x.com', communityId: 'A2CID', coachId: 10 },
      { userId: 21, userName: 'a2-child-1', email: 'c1@x.com', communityId: null, coachId: 2 },
      { userId: 22, userName: 'a2-child-2', email: 'c2@x.com', communityId: 'OWN', coachId: 2 },
      { userId: 3, userName: 'a3', email: 'a3@x.com', communityId: null, coachId: 10 },
    ]);

    const byId = Object.fromEntries(members.map((m) => [m.userId, m]));
    expect(byId[1].directCoachCommunityId).toBe('C0');
    expect(byId[2].directCoachCommunityId).toBe('C0');
    expect(byId[3].directCoachCommunityId).toBe('C0');
    expect(byId[21].directCoachCommunityId).toBe('A2CID');
    expect(byId[22].directCoachCommunityId).toBe('A2CID');
    expect(byId[10].directCoachCommunityId).toBeNull();
  });
});

describe('filterMembers', () => {
  const members = [
    {
      userId: 1,
      userName: 'Mohamed Yasheer',
      email: 'yasheer@gmail.com',
      communityId: 'WB12345',
      role: 'user',
      directCoachCommunityId: 'C0',
    },
    {
      userId: 2,
      userName: 'BALAJI',
      email: 'contactksbalaji@gmail.com',
      communityId: 'W112072823',
      role: 'coach',
    },
  ];

  it('matches a regular user own community id', () => {
    expect(filterMembers(members, 'wb12')).toHaveLength(1);
  });

  it('matches a downline coach own community id', () => {
    expect(filterMembers(members, 'W112072823')).toHaveLength(1);
  });

  it('does not match the direct coach community id', () => {
    expect(filterMembers(members, 'c0')).toHaveLength(0);
  });
});

describe('toSelectedUser', () => {
  it('copies owner timezone so diary clocks use Qatar / USA / India locally', () => {
    const selected = toSelectedUser({
      userId: 9,
      userName: 'Priya',
      email: 'priya@example.com',
      timezone: 'Asia/Qatar',
      role: 'user',
    });
    expect(selected.timezone).toBe('Asia/Qatar');
    expect(selected.timezoneIana).toBe('Asia/Qatar');
  });

  it('leaves timezone empty when the team row has none', () => {
    const selected = toSelectedUser({
      userId: 9,
      userName: 'Priya',
      email: 'priya@example.com',
      role: 'user',
    });
    expect(selected.timezone).toBeNull();
    expect(selected.timezoneIana).toBeNull();
  });
});
