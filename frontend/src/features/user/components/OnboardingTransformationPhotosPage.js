/**
 * OnboardingTransformationPhotosPage — mandatory Left / Centre / Right.
 * Compact no-scroll layout; Continue only when all three photos are set.
 * Left photo still seeds testimonial Before.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { fetchProfile, saveProfile } from '../services/profileService';
import TransformationPhotosSection from './profile/TransformationPhotosSection';
import useTransformationPhotos from '../hooks/useTransformationPhotos';
import { persistOnboardingTestimonialPhotos } from '../services/persistOnboardingTestimonialPhotos';
import { deriveWeightGoalMode } from '../../weight/services/weightFormService';
import {
  DEFAULT_POSE_SLOT,
  POSE_SLOT_KEYS,
  allTransformationSlotsFilled,
} from '../domain/transformationPoseGuide';

/**
 * @param {{
 *   user: object,
 *   onComplete: () => void | Promise<void>,
 *   onSkip?: () => void | Promise<void>,
 * }} props
 */
export default function OnboardingTransformationPhotosPage({
  user,
  onComplete,
}) {
  const transformationPhotos = useTransformationPhotos();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weightKg, setWeightKg] = useState(null);
  const [heightCm, setHeightCm] = useState(null);
  const [healthIssues, setHealthIssues] = useState([]);

  const email = user?.email || user?.Email || '';
  const userId = user?.id || user?.userId || user?.UserId;

  const allDone = useMemo(
    () => allTransformationSlotsFilled(transformationPhotos.previews),
    [transformationPhotos.previews],
  );

  const doneCount = useMemo(
    () => POSE_SLOT_KEYS.filter((key) => {
      const value = transformationPhotos.previews?.[key];
      return typeof value === 'string' && value.trim().length > 0;
    }).length,
    [transformationPhotos.previews],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (!email) {
          if (mounted) setLoading(false);
          return;
        }
        const result = await fetchProfile(email);
        if (!mounted) return;
        const profile = result?.data;
        transformationPhotos.loadFromProfile(profile?.transformationPhotos);
        transformationPhotos.setSelectedType(DEFAULT_POSE_SLOT);
        const w = profile?.latestWeight != null ? parseFloat(profile.latestWeight) : NaN;
        const h = profile?.height != null ? parseFloat(profile.height) : NaN;
        const weight = Number.isFinite(w) ? w : null;
        setWeightKg(weight);
        setHeightCm(Number.isFinite(h) ? h : null);
        setHealthIssues(
          Array.isArray(profile?.recoveredHealthIssues) ? profile.recoveredHealthIssues : [],
        );
        transformationPhotos.loadFromTestimonial(null, weight);
        transformationPhotos.setSnapshotWeight(weight);
      } catch (e) {
        if (mounted) setError(e.message || 'Could not load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mount/email
  }, [email]);

  const finish = useCallback(async () => {
    if (!allTransformationSlotsFilled(transformationPhotos.previews)) {
      setError('Add Left, Centre, and Right photos to continue.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const extras = transformationPhotos.payloadExtras();
      const centrePhoto = transformationPhotos.frontImageBase64();
      if (email) {
        await saveProfile({
          email,
          ...extras,
          ...(centrePhoto ? { profileImage: centrePhoto } : {}),
        });
      }
      if (userId && (weightKg != null || transformationPhotos.leftImageBase64())) {
        await persistOnboardingTestimonialPhotos({
          userId,
          weightKg,
          leftImageBase64: transformationPhotos.leftImageBase64(),
          goalType: deriveWeightGoalMode({
            heightCm,
            currentWeightKg: weightKg,
          }) || 'loss',
          recoveredHealthIssues: healthIssues,
        });
      }
      await onComplete?.({ profileImage: centrePhoto || undefined });
    } catch (e) {
      setError(e.message || 'Failed to save photos. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    email,
    userId,
    weightKg,
    heightCm,
    healthIssues,
    transformationPhotos,
    onComplete,
  ]);

  return (
    <div
      className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden"
      style={{ zIndex: 9999 }}
    >
      <div
        className="shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-white/20 rounded-full p-1.5">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight">Transformation Photos</h1>
            <p className="text-[11px] text-emerald-100 font-medium">
              {doneCount}/3 required
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-w-md w-full mx-auto px-4 pt-3 flex flex-col">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
        ) : (
          <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-md border border-gray-100 p-3 flex flex-col">
            <TransformationPhotosSection
              selectedType={transformationPhotos.selectedType}
              onSelectType={transformationPhotos.setSelectedType}
              previews={transformationPhotos.previews}
              disabled={saving}
              onSelectFile={async (slot, file) => {
                try {
                  setError('');
                  await transformationPhotos.setSlotFromFile(slot, file);
                } catch (e) {
                  setError(e.message || 'Failed to prepare photo.');
                }
              }}
            />
          </div>
        )}

        {error ? (
          <p className="text-xs text-red-600 text-center mt-2 shrink-0">{error}</p>
        ) : null}
      </div>

      <div
        className="shrink-0 px-4 pt-2 bg-gray-50"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        <div className="max-w-md mx-auto">
          {allDone ? (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => finish()}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          ) : (
            <p className="text-center text-xs text-gray-500 font-medium py-2">
              Add all three photos to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
