/**
 * Run: node --test backend/features/user/domain/__tests__/developerBot.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPER_BOT_EMAIL,
  DEVELOPER_BOT_NAME,
  DEVELOPER_BOT_PHONE,
  isDeveloperBotEmail,
  isDeveloperBotName,
  isDeveloperBotPhone,
  isDeveloperBotUser,
  rankSponsorSearchUsers,
  restoreDeveloperBotInSponsorSearch,
  shouldKeepDeveloperBotInSponsorSearch,
} from '../developerBot.rules.js';

describe('developerBot.rules', () => {
  it('matches the dedicated email, name, and 10-digit phone', () => {
    assert.equal(isDeveloperBotEmail('  Easy2Work.Developer@gmail.com '), true);
    assert.equal(isDeveloperBotName('Developer Bot'), true);
    assert.equal(isDeveloperBotPhone('+91' + DEVELOPER_BOT_PHONE), true);
    assert.equal(isDeveloperBotUser({ Email: DEVELOPER_BOT_EMAIL }), true);
    assert.equal(isDeveloperBotUser({ UserName: DEVELOPER_BOT_NAME }), true);
    assert.equal(isDeveloperBotUser({ PhoneNumber: DEVELOPER_BOT_PHONE }), true);
    assert.equal(isDeveloperBotUser({ UserName: 'Yasheer J' }), false);
  });

  it('pins the bot ahead of other sponsor search hits', () => {
    const ranked = rankSponsorSearchUsers([
      { UserId: 2, UserName: 'Adithya', Email: 'a@example.com' },
      { UserId: 1, UserName: DEVELOPER_BOT_NAME, Email: DEVELOPER_BOT_EMAIL },
      { UserId: 3, UserName: 'Balaji', Email: 'b@example.com' },
    ]);
    assert.equal(ranked[0].UserId, 1);
    assert.deepEqual(ranked.slice(1).map((u) => u.UserId), [2, 3]);
  });

  it('restores the bot after production developer filtering', () => {
    const matched = [
      { UserId: 1, UserName: DEVELOPER_BOT_NAME, Email: DEVELOPER_BOT_EMAIL, Role: 'developer' },
      { UserId: 2, UserName: 'Adithya', Email: 'a@example.com', Role: 'user' },
    ];
    const eligible = [matched[1]];
    const restored = restoreDeveloperBotInSponsorSearch(matched, eligible);
    assert.equal(shouldKeepDeveloperBotInSponsorSearch(matched[0]), true);
    assert.equal(restored[0].UserId, 1);
    assert.equal(restored[1].UserId, 2);
  });
});
