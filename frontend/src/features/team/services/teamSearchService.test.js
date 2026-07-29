import { resolveTeamSearchDisplayName } from './teamSearchService';

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
