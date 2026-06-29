/**
 * WeightCardModal.js — slice-level container.
 *
 * Detail/edit modal for a single weight entry. Validation, formatting and
 * the lazy image fetch all live in services/hooks; this file orchestrates
 * UI state for inline editing only.
 */
import React, { useState } from 'react';
import { Edit2, Trash2, Share2 } from 'lucide-react';
import { validateEditWeight } from '../services/weightFormService';
import { useWeightDetailImage } from '../hooks/useWeightDetailImage';
import WeightDetailHeader from './WeightDetailHeader';
import { captureAndShare } from '../../../shared/utils/shareUtils';

const WeightCardModal = ({
  data, onClose, onDelete, onUpdate, apiBaseUrl, userId = null,
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
                  type="number" step="0.01" inputMode="decimal" autoFocus
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

          <div className="flex gap-3">
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
            <button
              onClick={() => { onDelete?.(data); onClose?.(); }}
              className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
};

export default WeightCardModal;
