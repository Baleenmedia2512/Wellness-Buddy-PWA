/**
 * @file Shared JSDoc typedefs. Project is JavaScript today; this file
 * gives features a single place to import shared shapes from in the
 * meantime, and is the natural seed for a future TypeScript migration.
 *
 * Re-export concrete enums/values from constants so consumers can do
 * `import { ROLE_ADMIN } from 'shared/types'` when they want the role
 * union type and value side-by-side.
 *
 * Named exports only.
 */

export {
  ROLE_ADMIN,
  ROLE_COACH,
  ROLE_MEMBER,
  ROLE_GUEST,
  ALL_ROLES,
  ROLE_RANK,
} from '../constants/roles.js';

/**
 * @typedef {Object} User
 * @property {string} userId
 * @property {string} [email]
 * @property {string} [displayName]
 * @property {import('../constants/roles.js').Role} role
 * @property {string|null} [coachId]
 * @property {string|null} [teamId]
 * @property {string|null} [photoUrl]
 */

/**
 * @typedef {Object} TeamMember
 * @property {string} userId
 * @property {string} displayName
 * @property {import('../constants/roles.js').Role} role
 * @property {string|null} coachId
 * @property {number} [disciplineScore]
 */

/**
 * @typedef {Object} WeightEntry
 * @property {string} entryId
 * @property {string} userId
 * @property {number} weightKg
 * @property {string} recordedAtIst ISO timestamp in IST.
 * @property {string} [photoUrl]
 * @property {boolean} [deleted]
 */

/**
 * @typedef {Object} FoodLog
 * @property {string} logId
 * @property {string} userId
 * @property {string} eatenAtIst
 * @property {string} mealType   e.g. breakfast / lunch / snack
 * @property {Array<FoodItem>} items
 * @property {number} totalCalories
 */

/**
 * @typedef {Object} FoodItem
 * @property {string} name
 * @property {number} grams
 * @property {number} calories
 * @property {number} [proteinG]
 * @property {number} [carbsG]
 * @property {number} [fatG]
 */

/**
 * @typedef {Object} DisciplineScore
 * @property {string} userId
 * @property {string} dateIst
 * @property {number} overall 0-100
 * @property {Record<string, number>} byCategory keyed by DISCIPLINE_CATEGORIES.
 */

/**
 * @typedef {Object} TokenUsage
 * @property {string} userId
 * @property {string} model
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} costUsd
 * @property {string} occurredAtIst
 */

/**
 * @typedef {Object} ApiResult
 * @property {boolean} success
 * @property {string} [error]
 * @property {*} [data]
 */

// JSDoc-only file — runtime no-op export keeps tree-shakers and
// some bundlers happy if anyone does `import * as Types from ...`.
export const __types__ = Object.freeze({});
