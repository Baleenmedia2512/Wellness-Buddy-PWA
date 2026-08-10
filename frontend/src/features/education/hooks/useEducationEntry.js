/**
 * useEducationEntry.js
 * Owns state + validation + submit lifecycle for the manual education entry
 * form. UI components consuming this hook only render — no async, no parsing.
 */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MEETING_SESSION } from '../components/EducationFormFields';

const DEFAULT_PLATFORM = 'Zoom';

export function useEducationEntry({
  onSave,
  onClose,
  isOpen = true,
  skipTypeSelect = false,
  initialPlatform,
  initialTopic,
} = {}) {
  const [showTypeSelect, setShowTypeSelect] = useState(!skipTypeSelect);
  const [platform, setPlatform] = useState(initialPlatform || DEFAULT_PLATFORM);
  const [topic, setTopic] = useState(initialTopic || DEFAULT_MEETING_SESSION);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setShowTypeSelect(!skipTypeSelect);
    setPlatform(initialPlatform || DEFAULT_PLATFORM);
    setTopic(initialTopic || DEFAULT_MEETING_SESSION);
    setError('');
  }, [isOpen, skipTypeSelect, initialPlatform, initialTopic]);

  const reset = useCallback(() => {
    setPlatform(initialPlatform || DEFAULT_PLATFORM);
    setTopic(initialTopic || DEFAULT_MEETING_SESSION);
    setError('');
    setShowTypeSelect(!skipTypeSelect);
  }, [initialPlatform, initialTopic, skipTypeSelect]);

  const handleCancel = useCallback(() => {
    reset();
    if (onClose) onClose();
  }, [reset, onClose]);

  const handleBack = useCallback((onBack) => {
    reset();
    if (onBack) onBack();
  }, [reset]);

  const handleSave = useCallback(() => {
    setError('');
    if (!platform) {
      setError('Please select a platform');
      return;
    }
    if (!topic.trim()) {
      setError('Please select a meeting session');
      return;
    }
    // Hand off without awaiting network — parent closes classify and saves in background.
    const payload = { platform, topic: topic.trim() };
    reset();
    if (onClose) onClose();
    void Promise.resolve(onSave?.(payload));
  }, [platform, topic, onSave, onClose, reset]);

  return {
    showTypeSelect,
    platform, topic, error, isSaving,
    setPlatform, setTopic,
    openManual: () => setShowTypeSelect(false),
    handleCancel, handleBack, handleSave,
  };
}
