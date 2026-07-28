/**
 * useEducationEntry.js
 * Owns state + validation + submit lifecycle for the manual education entry
 * form. UI components consuming this hook only render — no async, no parsing.
 */
import { useCallback, useEffect, useState } from 'react';

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
  const [topic, setTopic] = useState(initialTopic || '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setShowTypeSelect(!skipTypeSelect);
    setPlatform(initialPlatform || DEFAULT_PLATFORM);
    setTopic(initialTopic || '');
    setError('');
  }, [isOpen, skipTypeSelect, initialPlatform, initialTopic]);

  const reset = useCallback(() => {
    setPlatform(initialPlatform || DEFAULT_PLATFORM);
    setTopic(initialTopic || '');
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

  const handleSave = useCallback(async () => {
    setError('');
    if (!platform) {
      setError('Please select a platform');
      return;
    }
    setIsSaving(true);
    try {
      await onSave?.({
        platform,
        topic: topic.trim() || 'Education Meeting',
      });
      reset();
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save education log');
    } finally {
      setIsSaving(false);
    }
  }, [platform, topic, onSave, onClose, reset]);

  return {
    showTypeSelect,
    platform, topic, error, isSaving,
    setPlatform, setTopic,
    openManual: () => setShowTypeSelect(false),
    handleCancel, handleBack, handleSave,
  };
}
