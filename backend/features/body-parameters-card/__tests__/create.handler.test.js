/**
 * create.handler.test.js — orchestration tests for team member creation on save.
 */
import { handleCreateCard } from '../api/create.handler.js';
import * as cardRepo from '../data/card.repo.js';

jest.mock('../data/card.repo.js', () => ({
  insertCard: jest.fn(),
  findOrCreateTeamMember: jest.fn(),
}));

describe('handleCreateCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cardRepo.findOrCreateTeamMember.mockResolvedValue(99);
    cardRepo.insertCard.mockResolvedValue({
      id: 1,
      public_share_token: '550e8400-e29b-41d4-a716-446655440000',
      share_expires_at: '2026-07-01T00:00:00Z',
      name: 'Priya',
    });
  });

  it('creates team_table member when phoneNumber is provided', async () => {
    await handleCreateCard({
      createdBy: 12,
      name: 'Priya',
      phoneNumber: '9876543210',
      heightCm: 165,
      bmr: 1400,
    });

    expect(cardRepo.findOrCreateTeamMember).toHaveBeenCalledWith({
      name: 'Priya',
      phoneNumber: '9876543210',
      coachId: 12,
      heightCm: 165,
      bmr: 1400,
    });
    expect(cardRepo.insertCard).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 99, phoneNumber: '9876543210' }),
    );
  });

  it('skips team member creation when phoneNumber is omitted', async () => {
    await handleCreateCard({ createdBy: 12, name: 'Priya' });

    expect(cardRepo.findOrCreateTeamMember).not.toHaveBeenCalled();
    expect(cardRepo.insertCard).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, phoneNumber: null }),
    );
  });
});
