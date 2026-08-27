/**
 * OnboardingTransformationPhotosPage — separate step after Complete Profile.
 * Optional Front / Left / Right guided capture (on-device, no Gemini).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { fetchProfile, saveProfile } from '../services/profileService';
import TransformationPhotosSection from './profile/TransformationPhotosSection';
import useTransformationPhotos from '../hooks/useTransformationPhotos';
import { persistOnboardingTestimonialPhotos } from '../services/persistOnboardingTestimonialPhotos';
import { deriveWeightGoalMode } from '../../weight/services/weightFormService';

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
  onSkip,
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

  const finish = useCallback(async (skipped) => {
    setError('');
    setSaving(true);
    try {
      if (!skipped) {
        const extras = transformationPhotos.payloadExtras();
        if (email && Object.keys(extras).length > 0) {
          await saveProfile({ email, ...extras });
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
      }
      if (skipped) await onSkip?.();
      else await onComplete?.();
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
    onSkip,
  ]);

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Transformation Photos</h1>
        </div>
        <p className="text-emerald-100 text-sm">
          Optional — capture Front, Left, and Right on separate guided screens.
        </p>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-5 pb-28">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <TransformationPhotosSection
              history={transformationPhotos.history}
              selectedType={transformationPhotos.selectedType}
              onSelectType={transformationPhotos.setSelectedType}
              previews={transformationPhotos.previews}
              disabled={saving}
              onApplyGuidedSlots={async (slots) => {
                try {
                  await transformationPhotos.applyGuidedSlots(slots);
                } catch (e) {
                  setError(e.message || 'Failed to save guided photos.');
                }
              }}
              onSelectFile={async (slot, file) => {
                try {
                  await transformationPhotos.setSlotFromFile(slot, file);
                } catch (e) {
                  setError(e.message || 'Failed to prepare photo.');
                }
              }}
            />
          </div>
        )}

        {error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-100 px-5 pt-3 space-y-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="max-w-md mx-auto space-y-2">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => finish(false)}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => finish(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-gray-500 disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
