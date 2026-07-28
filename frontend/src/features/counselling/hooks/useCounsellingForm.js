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

// A "lead" is a prospective member who does not yet have an app account.
// Only name + phone are captured here — the counselling form's existing
// sections (EatingHabits, HealthProblems, etc.) capture everything else.
const EMPTY_LEAD = { name: '', phone: '' };

export function useCounsellingForm({ user, selectedMember, isLead = false, onSaveSuccess, onClose } = {}) {
  const [selectedHealthProblems, setSelectedHealthProblems] = useState([]);
  const [eatingHabits, setEatingHabits] = useState(EMPTY_EATING_HABITS);
  const [sleepData, setSleepData] = useState(EMPTY_SLEEP);
  const [medicationDetails, setMedicationDetails] = useState('');
  const [leadDetails, setLeadDetails] = useState(EMPTY_LEAD);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const targetMember = selectedMember || user;

  // isLeadMode: true when explicitly flagged (isLead=true) OR when no real
  // userId exists on the target member — meaning this assessment is for a
  // new prospective member who has no app account yet.
  const isLeadMode = isLead || (!selectedMember && !user?.id) || (!!selectedMember && !selectedMember?.userId && !selectedMember?.id);

  const resetForm = useCallback(() => {
    setSelectedHealthProblems([]);
    setEatingHabits(EMPTY_EATING_HABITS);
    setSleepData(EMPTY_SLEEP);
    setMedicationDetails('');
    setLeadDetails(EMPTY_LEAD);
    setSaveSuccess(false);
    setError('');
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all data?')) {
      resetForm();
    }
  }, [resetForm]);

  // For lead mode: require at least name + phone + one health problem.
  // For normal mode: require at least one health problem (legacy behaviour).
  const isValid = isLeadMode
    ? selectedHealthProblems.length > 0 && leadDetails.name.trim() !== '' && leadDetails.phone.trim() !== ''
    : selectedHealthProblems.length > 0;
  const canSubmit = isValid && !isSaving;

  const buildPayload = useCallback(
    () => ({
      userId: targetMember?.userId || targetMember?.id,
      counsellorId: user?.id,
      healthProblems: selectedHealthProblems,
      eatingHabits,
      sleepData,
      medicationDetails,
      // lead fields — only name + phone for linking the lead later.
      // Diet type, health issues, etc. come from the counselling sections.
      leadName: isLeadMode ? leadDetails.name.trim() || null : null,
      leadPhone: isLeadMode ? leadDetails.phone.trim() || null : null,
      submittedAt: new Date().toISOString(),
    }),
    [targetMember, user, selectedHealthProblems, eatingHabits, sleepData, medicationDetails, isLeadMode, leadDetails],
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
        // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
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
        // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
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
    leadDetails, setLeadDetails,
    // flags
    isLeadMode,
    // status
    isSaving, saveSuccess, error,
    isValid, canSubmit,
    // derived
    targetMember, todayLabel,
    // actions
    handleSubmit, handleReset,
  };
}
