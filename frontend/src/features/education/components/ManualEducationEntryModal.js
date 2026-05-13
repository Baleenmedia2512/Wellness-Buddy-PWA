/**
 * ManualEducationEntryModal.js — slice-level container.
 * Two-screen manual education entry. State and validation live in the
 * `useEducationEntry` hook; this file only composes UI.
 */
import React from 'react';
import EducationTypeSelect from './EducationTypeSelect';
import EducationFormFields from './EducationFormFields';
import { EducationFormActions } from './EducationActionButtons';
import { useEducationEntry } from '../hooks/useEducationEntry';

const ManualEducationEntryModal = ({ isOpen, onClose, onSave, onBack }) => {
  const vm = useEducationEntry({ onSave, onClose });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {vm.showTypeSelect ? (
          <EducationTypeSelect onPick={vm.openManual} onCancel={vm.handleCancel} />
        ) : (
          <>
            <EducationFormFields
              platform={vm.platform}
              onSelectPlatform={vm.setPlatform}
              error={vm.error}
              onCancel={vm.handleCancel}
              onBack={onBack ? () => vm.handleBack(onBack) : null}
            />
            <EducationFormActions
              onCancel={vm.handleCancel}
              onSave={vm.handleSave}
              isSaving={vm.isSaving}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ManualEducationEntryModal;
