/**
 * After coach OTP, shows the one field-collection step the server chose.
 * Released app builds that do not include this component keep the old gates.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PhysicalActivitySetup from '../../user/components/PhysicalActivitySetup';
import OnboardingTransformationPhotosPage from '../../user/components/OnboardingTransformationPhotosPage';
import { fetchFieldCollectionPrompts } from '../services/fieldCollection.api';
import { readDeferredFields } from '../domain/sessionDefer';
import { fetchProfile } from '../../user/services/profileService';
import {
  readSavedCommunityPosition,
  shouldConfirmCommunityPositionGate,
  shouldSuppressCommunityPositionStep,
} from '../../user/domain/communityPosition';
import {
  hasCompleteTransformationPhotos,
  readTransformationPhotosComplete,
  rememberTransformationPhotosComplete,
  shouldSuppressPhotosStep,
} from '../../user/domain/transformationPhotosGate';
import OnboardingCommunityPositionPage from './OnboardingCommunityPositionPage';
import OnboardingEntryFieldsPage from './OnboardingEntryFieldsPage';
import OnboardingProfileIntroPage from './OnboardingProfileIntroPage';
import FieldCollectionPrompt from './FieldCollectionPrompt';

export default function FieldCollectionHost({
  user,
  apiBaseUrl,
  nonce = 0,
  onBlockingChange,
  onInactive,
}) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const planRef = useRef(null);
  const generation = useRef(0);
  const confirmedMissingPosition = useRef(false);
  const userId = user?.id || user?.UserId || user?.userId;

  const load = useCallback(async () => {
    if (!userId) {
      generation.current += 1;
      planRef.current = null;
      setPlan(null);
      setLoading(false);
      return null;
    }
    const gen = ++generation.current;
    // Keep the current step mounted while a save is rechecked, so typed
    // answers are not wiped when the server still asks for the same fields.
    if (!planRef.current) setLoading(true);
    setError('');
    try {
      const request = () => fetchFieldCollectionPrompts({
        userId,
        apiBaseUrl,
        defer: readDeferredFields(userId),
      });
      let data = await request();
      if (gen !== generation.current) return data;
      const savedPosition = readSavedCommunityPosition(userId);
      if (shouldSuppressCommunityPositionStep(data?.step, savedPosition)) {
        // The role is already on this phone. Do not cover Home while prompts
        // catch up, and do not delete the saved role.
        confirmedMissingPosition.current = false;
        data = { ...data, step: 'done' };
      } else if (shouldConfirmCommunityPositionGate({
        step: data?.step,
        alreadyConfirmed: confirmedMissingPosition.current,
      })) {
        confirmedMissingPosition.current = true;
        data = await request();
        if (gen !== generation.current) return data;
        if (shouldSuppressCommunityPositionStep(data?.step, readSavedCommunityPosition(userId))) {
          confirmedMissingPosition.current = false;
          data = { ...data, step: 'done' };
        }
      } else if (data?.step !== 'communityPosition') {
        confirmedMissingPosition.current = false;
      }
      if (data?.step === 'photos') {
        let photosComplete = readTransformationPhotosComplete(userId);
        if (!photosComplete) {
          try {
            const profile = await fetchProfile({ userId });
            if (gen !== generation.current) return data;
            photosComplete = hasCompleteTransformationPhotos(profile?.data?.transformationPhotos);
            if (photosComplete) rememberTransformationPhotosComplete(userId);
          } catch {
            photosComplete = false;
          }
        }
        if (shouldSuppressPhotosStep(data?.step, photosComplete)) {
          data = { ...data, step: 'done' };
        }
      }
      planRef.current = data;
      setPlan(data);
      return data;
    } catch (err) {
      // A failed prompts request must not erase a role the server already saved.
      confirmedMissingPosition.current = false;
      const message = err?.message || 'Could not check required details.';
      if (!planRef.current) {
        setError(message);
        setPlan(null);
      }
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [userId, apiBaseUrl]);

  useEffect(() => {
    confirmedMissingPosition.current = false;
    generation.current += 1;
  }, [userId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, nonce]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const step = planRef.current?.step;
      if (step && step !== 'done' && step !== 'communityPosition') return;
      load().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const blocking = Boolean(error) || (plan?.active && plan.step && plan.step !== 'done');
  useEffect(() => {
    if (plan && plan.active === false) onInactive?.();
  }, [plan, onInactive]);
  useEffect(() => {
    onBlockingChange?.(blocking);
    return () => onBlockingChange?.(false);
  }, [blocking, onBlockingChange]);

  if (!userId) return null;
  if (loading && (!plan || plan.step === 'done')) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 z-[10060] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="fixed inset-0 z-[10060] bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={load} className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!plan?.active || plan.step === 'done') return null;

  if (plan.step === 'communityPosition') {
    return <OnboardingCommunityPositionPage user={user} onComplete={load} />;
  }
  if (plan.step === 'entryFields') {
    return (
      <OnboardingEntryFieldsPage
        user={user}
        fields={plan.entryFields}
        onComplete={load}
      />
    );
  }
  if (plan.step === 'photos') {
    return (
        <OnboardingTransformationPhotosPage
        user={user}
        requiredSlots={plan.photoSlots}
        preferUserId
        onComplete={load}
      />
  );
  }
  if (plan.step === 'lifestyle') {
    return <PhysicalActivitySetup user={user} preferUserId onComplete={load} />;
  }
  if (plan.step === 'profileIntro') {
    return (
      <OnboardingProfileIntroPage
        user={user}
        fields={plan.profileFields || []}
        onComplete={load}
      />
    );
  }
  if (plan.step === 'scheduled' && plan.scheduled) {
    return (
      <FieldCollectionPrompt
        key={plan.scheduled.key}
        user={user}
        prompt={plan.scheduled}
        apiBaseUrl={apiBaseUrl}
        onDone={load}
      />
    );
  }
  return null;
}
