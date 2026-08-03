/**
 * useWeightForm.js
 * Owns state + validation + submit lifecycle for the manual weight-entry form.
 * Components consuming this hook only render — no validation, no parsing.
 */
import { useCallback, useState } from 'react';
import { validateManualEntry } from '../services/weightFormService';

export function useWeightForm({
  onSave,
  onClose,
  initialWeightValue = null,
  initialWeightUnit = null,
  skipTypeSelect = false,
} = {}) {
  // When the caller supplies initial values (e.g. AI-detected weight) or
  // skipTypeSelect (caller already chose Weight), go straight to the form.
  const hasInitial = initialWeightValue != null;
  const [showTypeSelect, setShowTypeSelect] = useState(!(hasInitial || skipTypeSelect));
  const [weight, setWeight] = useState(hasInitial ? String(initialWeightValue) : '');
  const [unit, setUnit] = useState(initialWeightUnit || 'kg');
  const [bmr, setBmr] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = useCallback(() => {
    setWeight(hasInitial ? String(initialWeightValue) : '');
    setUnit(initialWeightUnit || 'kg');
    setBmr('');
    setError('');
  }, [hasInitial, initialWeightValue, initialWeightUnit]);

  const handleCancel = useCallback(() => {
    reset();
    setShowTypeSelect(!(hasInitial || skipTypeSelect));
    if (onClose) onClose();
  }, [reset, onClose, hasInitial, skipTypeSelect]);

  const handleBack = useCallback((onBack) => {
    reset();
    setShowTypeSelect(!(hasInitial || skipTypeSelect));
    if (onBack) onBack();
  }, [reset, hasInitial, skipTypeSelect]);

  const toggleUnit = useCallback(() => {
    setUnit((u) => (u === 'kg' ? 'lbs' : 'kg'));
  }, []);

  const handleSave = useCallback(async () => {
    setError('');
    const v = validateManualEntry({ weight, unit, bmr });
    if (!v.valid) {
      setError(v.error);
      return;
    }
    setIsSaving(true);
    try {
      await onSave?.({
        weightValue: v.weightValue,
        unit,
        bmr: v.bmrValue,
      });
      reset();
      if (onClose) onClose();
    } catch (err) {
      // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
      console.error('❌ Manual entry error:', err);
      setError(err.message || 'Failed to save weight');
    } finally {
      setIsSaving(false);
    }
  }, [weight, unit, bmr, onSave, onClose, reset]);

  return {
    // state
    weight, unit, bmr, error, isSaving,
    showTypeSelect,
    // setters / actions
    setWeight, setUnit, setBmr,
    toggleUnit,
    openManual: () => setShowTypeSelect(false),
    handleCancel, handleBack, handleSave,
    // derived
    canSubmit: Boolean(weight) && !isSaving,
  };
}
