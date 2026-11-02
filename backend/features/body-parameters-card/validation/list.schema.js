/**
 * list.schema.js — Validation for listing body parameter cards
 */
import Joi from 'joi';
import {
  BPC_LIST_DEFAULT_PAGE_SIZE,
  BPC_LIST_MAX_PAGE_SIZE,
  normalizeBpcListPagination,
} from '../domain/list.pagination.js';

const listCardsSchema = Joi.object({
  coachId: Joi.number().integer().positive().required().label('Coach ID'),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(BPC_LIST_MAX_PAGE_SIZE).optional(),
  search: Joi.string().allow('').max(100).optional(),
  /** When set, return a single full card (edit detail) instead of a page. */
  cardId: Joi.number().integer().positive().optional(),
});

export function validateListCards(payload) {
  const { value, error } = listCardsSchema.validate(payload, {
    abortEarly: false,
    convert: true,
  });
  if (error) return { value, error };

  const pagination = normalizeBpcListPagination({
    page: value.page ?? 1,
    limit: value.limit ?? BPC_LIST_DEFAULT_PAGE_SIZE,
    search: value.search ?? '',
  });

  return {
    value: {
      coachId: value.coachId,
      cardId: value.cardId || null,
      ...pagination,
    },
    error: undefined,
  };
}
