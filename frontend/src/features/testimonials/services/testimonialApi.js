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
 * @param {{ userId, beforeImageBase64, afterImageBase64, beforeWeightKg, afterWeightKg, goalType, durationText, recoveredHealthIssues? }} payload
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
 * @param {{ userId, recoveredHealthIssues?, ...partialFields }} payload
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
 * Fetch the current user's result-video status.
 * @param {number} userId
 */
export async function getMyVideoTestimonial(userId) {
  const res = await CapacitorHttp.get({
    url: `${base()}/my-video?userId=${encodeURIComponent(userId)}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch video testimonial');
  return result.data; // null if no videos uploaded
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
 * @param {'direct'|'full'} [scope='direct']
 */
export async function listForCoach(coachId, scope = 'direct') {
  const params = new URLSearchParams({
    coachId: String(coachId),
  });
  if (scope === 'full') params.set('scope', 'full');
  const res = await CapacitorHttp.get({
    url: `${base()}/list-for-coach?${params.toString()}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch team testimonials');
  return result.data; // Array<{ user, testimonial }>
}

/**
 * Request signed Supabase Storage upload URLs for testimonial videos.
 * @param {{ userId, uploadHealth?: boolean, uploadBusiness?: boolean }} payload
 */
export async function prepareTestimonialVideoUpload(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/prepare-video-upload`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (res.status < 200 || res.status >= 300 || !result?.success) {
    throw new Error(result?.message || 'Failed to prepare video upload');
  }
  return result.uploads;
}

/**
 * Upload a video file in chunks via the backend (Capacitor-safe, no direct Supabase fetch).
 * @param {File} file
 * @param {{ path: string, sessionId: string }} uploadInfo
 * @param {'health'|'business'} slot
 * @param {number} userId
 */
export { uploadTestimonialVideoInChunks as uploadTestimonialVideoFile } from './testimonialVideoUpload.js';

/**
 * Member finalises health/business result videos after direct storage upload.
 * At least one of healthVideoPath / businessVideoPath must be provided.
 * @param {{ userId, healthVideoPath?, businessVideoPath? }} payload
 */
export async function submitTestimonialVideo(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/submit-video`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to upload video testimonial');
  return result;
}

/**
 * Member verifies their video testimonial using the OTP shared by the coach.
 * @param {{ testimonialId, otp }} payload
 */
export async function verifyTestimonialVideoOtp(payload) {
  const res = await CapacitorHttp.post({
    url:     `${base()}/verify-video-otp`,
    headers: { 'Content-Type': 'application/json' },
    data:    payload,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Video OTP verification failed');
  return result;
}

/**
 * Coach: get the video upload/verification report for their team.
 * @param {number} coachId
 * @param {'direct'|'full'} [scope='direct']
 */
export async function getTestimonialVideoReport(coachId, scope = 'direct') {
  const params = new URLSearchParams({ coachId: String(coachId) });
  if (scope === 'full') params.set('scope', 'full');
  const res = await CapacitorHttp.get({
    url: `${base()}/video-report?${params.toString()}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch video report');
  return result.data; // Array<{ user, videoStatus, hasHealthVideo, hasBusinessVideo, videoVerifiedAt }>
}

/**
 * Coach: upload / not-upload percentages for photo and video team reports.
 * @param {number} coachId
 * @returns {Promise<{ photoReport: object, videoReport: object }>}
 */
export async function getTeamTestimonialReport(coachId) {
  const res = await CapacitorHttp.get({
    url: `${base()}/team-report?coachId=${encodeURIComponent(coachId)}`,
  });
  const result = res.data;
  if (!result?.success) throw new Error(result?.message || 'Failed to fetch team testimonial report');
  return {
    photoReport: result.photoReport,
    videoReport: result.videoReport,
    teamPerformanceByUserId: result.teamPerformanceByUserId ?? {},
  };
}
