/**
 * ManualWeightEntryModal.js — slice-level container.
 *
 * Composes the manual weight-entry experience (intro screen + form) from
 * dumb sub-components and the `useWeightForm` hook. No validation, no
 * parsing, no setState juggling lives here.
 */
import React from 'react';
import { useWeightForm } from '../hooks/useWeightForm';
import { useLastWeightReference } from '../hooks/useLastWeightReference';
import { getCachedLatestWeight } from '../services/weight.api';
import ManualEntryTypeSelect from './ManualEntryTypeSelect';
import ManualEntryHeader from './ManualEntryHeader';
import WeightFormFields from './WeightFormFields';

function ManualWeightEntryForm({
  onSave,
  onClose,
  imagePreview,
  onBack,
  initialWeightValue = null,
  initialWeightUnit = null,
  skipTypeSelect = false,
  cachedLastWeight = null,
}) {
  const resolvedInitial = initialWeightValue ?? cachedLastWeight?.value ?? null;

  const vm = useWeightForm({
    onSave,
    onClose,
    initialWeightValue: resolvedInitial,
    initialWeightUnit,
    skipTypeSelect,
  });

  const showImage =
    imagePreview && typeof imagePreview === 'string' &&
    (imagePreview.startsWith('data:image') || imagePreview.startsWith('blob:'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {vm.showTypeSelect ? (
          <ManualEntryTypeSelect onPick={vm.openManual} onCancel={vm.handleCancel} />
        ) : (
          <>
            <ManualEntryHeader
              onBack={onBack ? () => vm.handleBack(onBack) : null}
              onCancel={vm.handleCancel}
            />
            <div className="px-4 pt-3 pb-2 space-y-3">
              {showImage && (
                <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ height: '180px' }}>
                  <img src={imagePreview} alt="Weight scale"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
              )}
              <div className="space-y-3">
                <WeightFormFields
                  weight={vm.weight}
                  unit={vm.unit}
                  onWeightChange={vm.setWeight}
                  onToggleUnit={vm.toggleUnit}
                />
                {vm.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                    {vm.error}
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={vm.handleSave}
                disabled={!vm.canSubmit}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vm.isSaving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ManualWeightEntryModal = ({
  isOpen,
  onClose,
  onSave,
  imagePreview,
  onBack,
  userId = null,
  lastWeight: lastWeightProp = null,
  initialWeightValue = null,
  initialWeightUnit = null,
  skipTypeSelect = false,
}) => {
  // Keep cache warm even while modal is closed.
  useLastWeightReference({
    userId,
    enabled: !!userId && !lastWeightProp,
  });

  if (!isOpen) return null;

  const cachedLastWeight = lastWeightProp ?? (userId ? getCachedLatestWeight(userId) : null);

  return (
    <ManualWeightEntryForm
      key={`${userId}-${initialWeightValue ?? cachedLastWeight?.value ?? 'empty'}`}
      onSave={onSave}
      onClose={onClose}
      imagePreview={imagePreview}
      onBack={onBack}
      initialWeightValue={initialWeightValue}
      initialWeightUnit={initialWeightUnit}
      skipTypeSelect={skipTypeSelect}
      cachedLastWeight={cachedLastWeight}
    />
  );
};

export default ManualWeightEntryModal;
