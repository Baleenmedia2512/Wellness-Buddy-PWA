/**
 * recognition.handler.js — Returns pending recognition splash screens for a user
 * and marks them as viewed.
 */
import {
  validateGetRecognition,
  validateMarkRecognitionViewed,
}                                   from '../validation/marathon.schema.js';
import { getPendingRecognition, markRecognitionViewed } from '../data/marathon.repo.js';

export async function handleGetRecognition(query) {
  const { userId } = validateGetRecognition(query);
  const pending    = await getPendingRecognition(userId);
  return {
    httpStatus: 200,
    body: { ok: true, data: pending },
  };
}

export async function handleMarkRecognitionViewed(body) {
  const { userId, marathonId, resultDate } = validateMarkRecognitionViewed(body);
  await markRecognitionViewed(userId, marathonId, resultDate);
  return {
    httpStatus: 200,
    body: { ok: true },
  };
}
