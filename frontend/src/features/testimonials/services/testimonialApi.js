/**
 * testimonialApi.js — CapacitorHttp wrappers for the testimonials feature.
 * All network calls for this feature go through this file.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

function base() {
  return `${getApiBaseUrl()}/api/testimonials`;
}

/**
 * Submit a new testimonial (member).
 * @param {{ userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText }} payload
 */
export async function submitTestimonial(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/submit`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to submit testimonial');
  return result;
}

/**
 * Edit an existing testimonial (member).
 * @param {{ userId, ...partialFields }} payload
 */
export async function editTestimonial(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/edit`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to update testimonial');
  return result;
}

/**
 * Fetch the current user's own testimonial.
 * @param {number} userId
 */
export async function getMyTestimonial(userId) {
  const res = await CapacitorHttp.get({
    url: `${base()}/my-testimonial?userId=${encodeURIComponent(userId)}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch testimonial');
  return result.data; // null if not submitted yet
}

/**
 * Coach: verify a testimonial via OTP.
 * @param {{ testimonialId, otp }} payload
 */
export async function verifyTestimonialOtp(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/verify-otp`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'OTP verification failed');
  return result;
}

/**
 * Coach: list direct-downline testimonials.
 * @param {number} coachId
 */
export async function listForCoach(coachId) {
  const res = await CapacitorHttp.get({
    url: `${base()}/list-for-coach?coachId=${encodeURIComponent(coachId)}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch team testimonials');
  return result.data; // Array<{ user, testimonial }>
}
