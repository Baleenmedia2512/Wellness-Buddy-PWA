/**
 * list.schema.js — Validation for listing body parameter cards
 */
import Joi from 'joi';

const listCardsSchema = Joi.object({
  coachId: Joi.string().uuid().required().label('Coach ID')
});

export function validateListCards(payload) {
  return listCardsSchema.validate(payload, { abortEarly: false });
}
