/**
 * useWeightProgressCheck.js
 * Custom hook to check for reverse weight progress and fetch tips.
 */
import { useState, useCallback } from 'react';
import { fetchWeightProgressCheck, submitProgressReview } from '../api/weightProgressClient.js';

export function useWeightProgressCheck() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const checkProgress = useCallback(async (userId, currentWeightId = null) => {
    console.log('🎯 [useWeightProgressCheck] Starting check for userId:', userId, 'weightId:', currentWeightId);
    setLoading(true);
    setError(null);

    try {
      console.log('📡 [useWeightProgressCheck] Calling API...');
      const result = await fetchWeightProgressCheck(userId, currentWeightId);
      console.log('✅ [useWeightProgressCheck] API Success:', result);
      setData(result);
      return result;
    } catch (err) {
      console.error('❌ [useWeightProgressCheck] API Error:', err);
      setError(err.message || 'Failed to check weight progress');
      setData(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Persist the user's accountability review.
   * Requires `userId` to be included in `payload`.
   */
  const submitReview = useCallback(async (payload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitProgressReview(payload);
      return result;
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit review');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setSubmitError(null);
  }, []);

  return {
    data,
    loading,
    error,
    submitting,
    submitError,
    checkProgress,
    submitReview,
    reset,
    shouldShow: data?.shouldShow || false,
    comparison: data?.comparison || null,
    tips: data?.tips || [],
    goalMode: data?.goalMode || null,
    followedPlanCorrectly: data?.followedPlanCorrectly || false,
    coachPhone: data?.coachPhone || null,
  };
}
