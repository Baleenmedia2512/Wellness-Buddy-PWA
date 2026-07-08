/**
 * useTestimonialVideo.js — State and lifecycle for video uploads on the member testimonial.
 * Mirrors the useTestimonial hook pattern: file input → base64, submit, verify OTP.
 *
 * Health video:   max 1 min  → enforced client-side by duration check
 * Business video: max 2 min  → enforced client-side by duration check
 */
import { useState, useCallback } from 'react';
import { submitTestimonialVideo, verifyTestimonialVideoOtp } from '../services/testimonialApi.js';

// Server-side limits (base64 bytes) — mirrors backend validator constants
const MAX_HEALTH_VIDEO_MB   = 20;
const MAX_BUSINESS_VIDEO_MB = 40;
const MAX_HEALTH_DURATION_S   = 60;   // 1 min
const MAX_BUSINESS_DURATION_S = 120;  // 2 min

/**
 * Read a File as a base64 data-URI string via FileReader.
 * @param {File} file
 * @returns {Promise<string>} data-URI (e.g. "data:video/mp4;base64,...")
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error('Failed to read file. Please try again.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get video duration in seconds using an <video> element.
 * @param {File} file
 * @returns {Promise<number>}
 */
function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video metadata. Please try a different file.'));
    };
    video.src = url;
  });
}

/**
 * @param {{ userId: number, testimonialId: number|null }} opts
 * testimonialId is the existing testimonial ID (null = no testimonial yet, upload disabled).
 */
export function useTestimonialVideo({ userId, testimonialId }) {
  const [healthVideo,   setHealthVideo]   = useState(null); // { name, base64, sizeLabel }
  const [businessVideo, setBusinessVideo] = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState(null);
  const [success,       setSuccess]       = useState(null);
  const [showOtpModal,  setShowOtpModal]  = useState(false);

  const reset = useCallback(() => {
    setHealthVideo(null);
    setBusinessVideo(null);
    setError(null);
    setSuccess(null);
  }, []);

  const removeHealthVideo   = useCallback(() => { setHealthVideo(null);   setError(null); }, []);
  const removeBusinessVideo = useCallback(() => { setBusinessVideo(null); setError(null); }, []);

  /**
   * Build a video change handler for a given slot ('health' | 'business').
   */
  const makeVideoHandler = useCallback(
    (slot) => async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input so the same file can be re-selected
      e.target.value = '';
      setError(null);

      const maxMb       = slot === 'health' ? MAX_HEALTH_VIDEO_MB   : MAX_BUSINESS_VIDEO_MB;
      const maxDuration = slot === 'health' ? MAX_HEALTH_DURATION_S : MAX_BUSINESS_DURATION_S;
      const maxLabel    = slot === 'health' ? '1 min' : '2 min';

      // Size check (rough, before full read)
      const fileMb = file.size / (1024 * 1024);
      if (fileMb > maxMb) {
        setError(`${slot === 'health' ? 'Health' : 'Business'} video is too large (max ~${maxMb} MB). Please compress or trim the video.`);
        return;
      }

      try {
        // Duration check
        const duration = await getVideoDuration(file);
        if (duration > maxDuration) {
          setError(`${slot === 'health' ? 'Health' : 'Business'} video must be ${maxLabel} or less (yours is ${Math.ceil(duration)}s). Please trim and try again.`);
          return;
        }

        // Read as base64
        const base64 = await readFileAsBase64(file);
        const sizeLabel = fileMb < 1 ? `${Math.round(file.size / 1024)} KB` : `${fileMb.toFixed(1)} MB`;

        const info = { name: file.name, base64, sizeLabel };
        if (slot === 'health') setHealthVideo(info);
        else setBusinessVideo(info);
      } catch (err) {
        setError(err.message);
      }
    },
    [],
  );

  const handleHealthVideoChange   = useCallback(makeVideoHandler('health'),   [makeVideoHandler]);
  const handleBusinessVideoChange = useCallback(makeVideoHandler('business'), [makeVideoHandler]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (!healthVideo && !businessVideo) {
      setError('Please select at least one video to upload.');
      return;
    }
    if (!testimonialId) {
      setError('Please complete your photo testimonial (before/after photos) first.');
      return;
    }

    setSubmitting(true);
    try {
      await submitTestimonialVideo({
        userId,
        healthVideoBase64:   healthVideo?.base64   ?? undefined,
        businessVideoBase64: businessVideo?.base64 ?? undefined,
      });
      setSuccess('Videos uploaded! Share the OTP your coach receives to complete verification.');
      setShowOtpModal(true);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [userId, testimonialId, healthVideo, businessVideo]);

  const handleVideoVerified = useCallback(() => {
    setShowOtpModal(false);
    setSuccess('Video testimonial verified!');
    reset();
  }, [reset]);

  return {
    healthVideo,
    businessVideo,
    handleHealthVideoChange,
    handleBusinessVideoChange,
    removeHealthVideo,
    removeBusinessVideo,
    submitting,
    error,
    success,
    showOtpModal,
    setShowOtpModal,
    handleSubmit,
    handleVideoVerified,
    reset,
  };
}
