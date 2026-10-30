import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { WALLET_FLAG } from '../domain/wallet.rules.js';
import { findActivePersonByUserId, searchPeopleWithEmail } from '../data/people.repo.js';
import { validatePeopleSearch } from '../validation/wallet.schema.js';

export async function searchWalletPeople(query) {
  if (!isEnabled(WALLET_FLAG)) {
    throw new ValidationError(404, 'Wallet is not available');
  }
  const { userId, q } = validatePeopleSearch(query);
  const owner = await findActivePersonByUserId(userId);
  if (!owner) {
    throw new ValidationError(404, 'Account not found');
  }
  const people = await searchPeopleWithEmail(q);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: { people },
    },
  };
}
