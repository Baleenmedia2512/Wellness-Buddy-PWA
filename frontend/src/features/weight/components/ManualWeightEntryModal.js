/**
 * ManualWeightEntryModal.js — slice-level container.
 *
 * Composes the manual weight-entry experience (intro screen + form) from
 * dumb sub-components and the `useWeightForm` hook. No validation, no
 * parsing, no setState juggling lives here.
 */
import React from 'react';
import { useWeightForm } from '../hooks/useWeightForm';
import ManualEntryTypeSelect from './ManualEntryTypeSelect';
import ManualEntryHeader from './ManualEntryHeader';
import WeightFormFields from './WeightFormFields';

const ManualWeightEntryModal = ({ isOpen, onClose, onSave, imagePreview, onBack, lastWeight }) => {
  const vm = useWeightForm({ onSave, onClose });
  if (!isOpen) return null;

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
              {lastWeight && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                  <span className="text-sm">📌</span>
                  <div>
                    <p className="text-xs text-purple-600 font-semibold">Last entry</p>
                    <p className="text-xs text-purple-800 font-bold">
                      {lastWeight.value} {lastWeight.unit || 'kg'}
                      {lastWeight.date && (
                        <span className="font-normal text-purple-500 ml-1.5">
                          — {new Date(lastWeight.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
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
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={vm.handleCancel}
                disabled={vm.isSaving}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={vm.handleSave}
                disabled={!vm.canSubmit}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vm.isSaving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </span>
                ) : (
                  'Save Weight'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManualWeightEntryModal;
