/**
 * useCounsellingForm.js
 * Owns state + validation + submit lifecycle for the wellness counselling form.
 *
 * Components consuming this hook only render — no calculations, no fetch.
 *
 * Validation rule (matches legacy behaviour exactly):
 *   - At least one health problem must be selected before submit is enabled.
 */
import { useCallback, useMemo, useState } from 'react';
import { saveAssessment } from '../services/counsellingApi';
import { debugLog } from '../../../shared/utils/logger.js';

const SUCCESS_TOAST_MS = 1500;

const EMPTY_EATING_HABITS = {
  wakeUpTime: '',
  teaCoffeeTime: '',
  breakfastTime: '',
  lunchTime: '',
  snacksTime: '',
  dinnerTime: '',
  dietType: '',
  waterIntake: '',
};

const EMPTY_SLEEP = { quality: '', duration: '' };

export function useCounsellingForm({ user, selectedMember, onSaveSuccess, onClose } = {}) {
  const [selectedHealthProblems, setSelectedHealthProblems] = useState([]);
  const [eatingHabits, setEatingHabits] = useState(EMPTY_EATING_HABITS);
  const [sleepData, setSleepData] = useState(EMPTY_SLEEP);
  const [medicationDetails, setMedicationDetails] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const targetMember = selectedMember || user;

  const resetForm = useCallback(() => {
    setSelectedHealthProblems([]);
    setEatingHabits(EMPTY_EATING_HABITS);
    setSleepData(EMPTY_SLEEP);
    setMedicationDetails('');
    setSaveSuccess(false);
    setError('');
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all data?')) {
      resetForm();
    }
  }, [resetForm]);

  const isValid = selectedHealthProblems.length > 0;
  const canSubmit = isValid && !isSaving;

  const buildPayload = useCallback(
    () => ({
      userId: targetMember?.userId || targetMember?.id,
      counsellorId: user?.id,
      healthProblems: selectedHealthProblems,
      eatingHabits,
      sleepData,
      medicationDetails,
      submittedAt: new Date().toISOString(),
    }),
    [targetMember, user, selectedHealthProblems, eatingHabits, sleepData, medicationDetails],
  );

  const handleSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      if (!isValid) return;
      setError('');
      setIsSaving(true);
      try {
        const formData = buildPayload();
        // Preserve legacy 1s artificial delay so success animation feels right.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
        debugLog('✅ Wellness Counselling Data:', formData);
        await saveAssessment(formData);
        setSaveSuccess(true);
        if (onSaveSuccess) onSaveSuccess(formData);
        setTimeout(() => {
          setSaveSuccess(false);
          resetForm();
          if (onClose) onClose();
        }, SUCCESS_TOAST_MS);
      } catch (err) {
        // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
        console.error('❌ Error saving data:', err);
        setError('Failed to save. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [isValid, buildPayload, onSaveSuccess, resetForm, onClose],
  );

  const todayLabel = useMemo(() => new Date().toLocaleDateString(), []);

  return {
    // model
    selectedHealthProblems, setSelectedHealthProblems,
    eatingHabits, setEatingHabits,
    sleepData, setSleepData,
    medicationDetails, setMedicationDetails,
    // status
    isSaving, saveSuccess, error,
    isValid, canSubmit,
    // derived
    targetMember, todayLabel,
    // actions
    handleSubmit, handleReset,
  };
}
