/**
 * WeightCardModal.js — slice-level container.
 *
 * Detail/edit modal for a single weight entry. Validation, formatting and
 * the lazy image fetch all live in services/hooks; this file orchestrates
 * UI state for inline editing only.
 */
import React, { useState } from 'react';
import { Edit2, Trash2, Share2, TrendingDown, TrendingUp, Target } from 'lucide-react';
import {
  validateEditWeight,
  formatWeightChangeLabel,
  pickIdealWeightDisplay,
  formatHistoryDate,
} from '../services/weightFormService';
import { useWeightDetailImage } from '../hooks/useWeightDetailImage';
import WeightDetailHeader from './WeightDetailHeader';
import { captureAndShare } from '../../../shared/utils/shareUtils';

const WeightCardModal = ({
  data, onClose, onDelete, onUpdate, apiBaseUrl, userId = null,
  previousWeight = null, previousEntry = null, idealWeight = null,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = React.useRef(null);

  const { lazyImage, imageLoading } = useWeightDetailImage({ apiBaseUrl, userId, entry: data });

  if (!data) return null;

  const startEdit = () => {
    setEditWeight(parseFloat(data.Weight).toFixed(2));
    setEditError('');
    setIsEditing(true);
  };
  const cancelEdit = () => { setIsEditing(false); setEditWeight(''); setEditError(''); };

  const saveEdit = async () => {
    const { valid, error, weightValue } = validateEditWeight(editWeight);
    if (!valid) { setEditError(error); return; }
    const entryId = data.ID ?? data.id;
    if (!entryId) { setEditError('Unable to find entry ID'); return; }
    setIsSaving(true); setEditError('');
    try {
      await onUpdate?.(entryId, weightValue);
      setIsEditing(false);
    } catch (err) {
      setEditError(err?.message || 'Failed to update weight');
    } finally {
      setIsSaving(false);
    }
  };

  const displayWeight = isEditing ? editWeight : parseFloat(data.Weight).toFixed(2);
  const changeInfo = formatWeightChangeLabel(displayWeight, previousWeight);
  const idealDisplay = pickIdealWeightDisplay(parseFloat(displayWeight), idealWeight);
  const previousDateLabel = previousEntry?.CreatedAt
    ? formatHistoryDate(previousEntry.CreatedAt)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div
        ref={cardRef}
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <WeightDetailHeader
          data={data}
          lazyImage={lazyImage}
          imageLoading={imageLoading}
          displayWeight={displayWeight}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-emerald-800">Weight</span>
              {!isEditing ? (
                <button onClick={startEdit}
                  className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-100 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              ) : null}
            </div>
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  autoFocus
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none text-lg font-bold"
                  style={{ fontSize: '16px' }}
                />
                {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={cancelEdit} disabled={isSaving}
                    className="flex-1 py-2 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={isSaving}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-emerald-900 mt-1">{displayWeight} kg</p>
            )}
          </div>

          {changeInfo && (
            <div
              className={`rounded-2xl p-4 border ${
                changeInfo.gained
                  ? 'bg-rose-50 border-rose-100'
                  : 'bg-emerald-50 border-emerald-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Since last log
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Previous: <span className="font-semibold text-gray-800">{changeInfo.previousLabel}</span>
                  </p>
                  {previousDateLabel && (
                    <p className="text-xs text-gray-400 mt-0.5">{previousDateLabel}</p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      changeInfo.gained ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {changeInfo.signedLabel}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-end gap-1">
                    {changeInfo.gained ? (
                      <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    change
                  </p>
                </div>
              </div>
            </div>
          )}

          {idealWeight && idealDisplay && (
            <div className="rounded-2xl p-4 border border-blue-100 bg-blue-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" aria-hidden="true" />
                    Ideal weight
                  </p>
                  <p className="text-xs text-blue-600/80 mt-1">
                    Based on height {idealWeight.heightCm} cm
                  </p>
                  <p className="text-xs text-blue-600/70 mt-0.5">
                    Healthy range: {idealWeight.min}–{idealWeight.value} {idealWeight.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-800">{idealDisplay}</p>
                  <p className="text-[11px] text-blue-600/70 mt-0.5">target</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { onDelete?.(data); }}
              className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button
              onClick={async () => {
                if (isSharing || !cardRef.current) return;
                setIsSharing(true);
                try {
                  await captureAndShare(cardRef.current, {
                    title: `Weight ${displayWeight} kg`,
                    fileName: `wellness-weight-${Date.now()}.png`,
                  });
                } catch (err) {
                  if (!err?.message?.toLowerCase().includes('cancel')) console.error('Share failed:', err);
                } finally {
                  setIsSharing(false);
                }
              }}
              disabled={isSharing}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isSharing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 className="w-4 h-4" />}
              {isSharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
};

export default WeightCardModal;
