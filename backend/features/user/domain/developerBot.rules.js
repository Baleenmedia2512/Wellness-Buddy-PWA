/**
 * Dedicated internal sponsor used for developer onboarding tests.
 * Selecting this user emails sponsor OTP to DEVELOPER_BOT_EMAIL so testers
 * do not need a real coach to share a code.
 *
 * Pure — no I/O.
 */

import { normalizeEmailForStorage } from './emailIdentity.rules.js';

export const DEVELOPER_BOT_EMAIL = 'easy2work.developer@gmail.com';
export const DEVELOPER_BOT_NAME = 'developer bot';
export const DEVELOPER_BOT_PHONE = '9000000001';

function nationalDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function normalizeDeveloperBotName(name) {
  return String(name || '').trim().toLowerCase();
}

export function isDeveloperBotEmail(email) {
  return normalizeEmailForStorage(email) === DEVELOPER_BOT_EMAIL;
}

export function isDeveloperBotName(name) {
  return normalizeDeveloperBotName(name) === DEVELOPER_BOT_NAME;
}

export function isDeveloperBotPhone(phone) {
  return nationalDigits(phone) === DEVELOPER_BOT_PHONE;
}

/**
 * @param {{ Email?: string, email?: string, UserName?: string, userName?: string, PhoneNumber?: string, phoneNumber?: string }|null|undefined} row
 */
export function isDeveloperBotUser(row) {
  if (!row) return false;
  return isDeveloperBotEmail(row.Email ?? row.email)
    || isDeveloperBotName(row.UserName ?? row.userName)
    || isDeveloperBotPhone(row.PhoneNumber ?? row.phoneNumber);
}

/**
 * Keep this account in sponsor search even when production hides developers.
 * Leaderboards and other aggregates still exclude Role=developer.
 *
 * @param {object|null|undefined} userRow
 */
export function shouldKeepDeveloperBotInSponsorSearch(userRow) {
  return isDeveloperBotUser(userRow);
}

/**
 * Pin the developer bot to the top of sponsor search without reordering others.
 *
 * @param {object[]} users
 * @returns {object[]}
 */
export function rankSponsorSearchUsers(users) {
  if (!Array.isArray(users) || users.length === 0) return [];
  const bots = [];
  const rest = [];
  for (const user of users) {
    if (isDeveloperBotUser(user)) bots.push(user);
    else rest.push(user);
  }
  return [...bots, ...rest];
}

/**
 * Restore the bot after production aggregate filtering when the query already matched it.
 *
 * @param {object[]} matched
 * @param {object[]} eligible
 * @returns {object[]}
 */
export function restoreDeveloperBotInSponsorSearch(matched, eligible) {
  const kept = Array.isArray(eligible) ? [...eligible] : [];
  const bot = (matched || []).find(shouldKeepDeveloperBotInSponsorSearch);
  if (!bot) return kept;
  const botId = bot.UserId ?? bot.userId;
  const already = kept.some((row) => String(row.UserId ?? row.userId) === String(botId));
  if (already) return kept;
  return [bot, ...kept];
}
