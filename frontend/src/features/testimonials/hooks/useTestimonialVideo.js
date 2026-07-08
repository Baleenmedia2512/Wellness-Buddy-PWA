/**
 * useTestimonialVideo.js — State and lifecycle for video uploads on the member testimonial.
 * Mirrors the useTestimonial hook pattern: file input → direct storage upload, submit, verify OTP.
 *
 * Health video:   max 1 min  → enforced client-side when metadata is readable
 * Business video: max 2 min  → enforced client-side when metadata is readable
 * Fallback: allowed video types may upload when WebView cannot read metadata
 */
import { useState, useCallback, useEffect } from 'react';
import {
  prepareTestimonialVideoUpload,
  uploadTestimonialVideoFile,
  submitTestimonialVideo,
} from '../services/testimonialApi.js';
import { resolveVideoDuration } from '../utils/getVideoMetadata.js';

// Server-side binary limits — mirrors backend validator constants
const MAX_HEALTH_VIDEO_MB   = 20;
const MAX_BUSINESS_VIDEO_MB = 40;
const MAX_HEALTH_DURATION_S   = 60;   // 1 min
const MAX_BUSINESS_DURATION_S = 120;  // 2 min

/**
 * @param {{ userId: number, testimonialId: number|null }} opts
 * testimonialId is the existing testimonial ID (null = no testimonial yet, upload disabled).
 */
export function useTestimonialVideo({ userId, testimonialId }) {
  const [healthVideo,   setHealthVideo]   = useState(null); // { name, file, sizeLabel }
  const [businessVideo, setBusinessVideo] = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState(null);
  const [warning,       setWarning]       = useState(null);
  const [success,       setSuccess]       = useState(null);
  const [showOtpModal,  setShowOtpModal]  = useState(false);

  const reset = useCallback(() => {
    setHealthVideo(null);
    setBusinessVideo(null);
    setError(null);
    setWarning(null);
    setSuccess(null);
  }, []);

  const syncDurationWarning = useCallback((health, business) => {
    const unverifiedSlots = [
      health?.durationUnverified ? 'Health' : null,
      business?.durationUnverified ? 'Business' : null,
    ].filter(Boolean);

    if (unverifiedSlots.length === 0) {
      setWarning(null);
      return;
    }

    const slotLabel = unverifiedSlots.join(' and ');
    setWarning(
      `${slotLabel} video length could not be checked on this device. `
      + 'Please ensure health videos are 1 min or less and business videos are 2 min or less before uploading.',
    );
  }, []);

  useEffect(() => {
    syncDurationWarning(healthVideo, businessVideo);
  }, [healthVideo, businessVideo, syncDurationWarning]);

  const removeHealthVideo = useCallback(() => {
    setHealthVideo(null);
    setError(null);
  }, []);

  const removeBusinessVideo = useCallback(() => {
    setBusinessVideo(null);
    setError(null);
  }, []);

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
      setWarning(null);

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
        const { duration, durationVerified } = await resolveVideoDuration(file);
        if (durationVerified && duration > maxDuration) {
          setError(`${slot === 'health' ? 'Health' : 'Business'} video must be ${maxLabel} or less (yours is ${Math.ceil(duration)}s). Please trim and try again.`);
          return;
        }

        const sizeLabel = fileMb < 1 ? `${Math.round(file.size / 1024)} KB` : `${fileMb.toFixed(1)} MB`;

        const info = {
          name: file.name,
          file,
          sizeLabel,
          durationUnverified: !durationVerified,
        };

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
      const uploads = await prepareTestimonialVideoUpload({
        userId,
        uploadHealth: !!healthVideo,
        uploadBusiness: !!businessVideo,
      });

      let healthVideoPath;
      let businessVideoPath;

      if (healthVideo) {
        healthVideoPath = await uploadTestimonialVideoFile(
          healthVideo.file,
          uploads.health,
          'health',
          userId,
        );
      }
      if (businessVideo) {
        businessVideoPath = await uploadTestimonialVideoFile(
          businessVideo.file,
          uploads.business,
          'business',
          userId,
        );
      }

      await submitTestimonialVideo({
        userId,
        healthVideoPath,
        businessVideoPath,
      });
      setSuccess('Videos uploaded! Share the OTP your coach receives to complete verification.');
      setShowOtpModal(true);
    } catch (err) {
      const message = err?.message || 'Upload failed. Please try again.';
      setError(
        message.toLowerCase().includes('failed to fetch')
          ? 'Upload failed — please check your internet connection and try again.'
          : message,
      );
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
    warning,
    success,
    showOtpModal,
    setShowOtpModal,
    handleSubmit,
    handleVideoVerified,
    reset,
  };
}
