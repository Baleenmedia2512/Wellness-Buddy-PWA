/**
 * WellnessCounsellingForm.js — slice-level container.
 *
 * Composes the counselling form from dumb section components and the
 * useCounsellingForm hook. No business logic, no fetch, no validation
 * lives in this file — everything is delegated.
 */
import React from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import {
  HealthProblemSection,
  EatingHabitsSection,
  SleepQualitySection,
  MedicationSection,
} from '../sections';
import { useCounsellingForm } from '../hooks/useCounsellingForm';
import AssessmentTargetCard from './AssessmentTargetCard';
import CounsellingFormActions from './CounsellingFormActions';

const WellnessCounsellingForm = ({ isOpen, onClose, user, selectedMember, onSaveSuccess }) => {
  const vm = useCounsellingForm({ user, selectedMember, onSaveSuccess, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="min-h-screen w-full flex items-start justify-center p-2 sm:p-4 py-4 sm:py-8">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative my-safe">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between z-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">Wellness Counselling</h2>
              <p className="text-xs sm:text-sm text-green-100">Initial Assessment Record</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors flex-shrink-0 ml-2"
            >
              <X size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={vm.handleSubmit} className="p-4 sm:p-6 space-y-6 sm:space-y-8">
            {vm.saveSuccess && (
              <div className="flex items-center gap-2 sm:gap-3 bg-green-50 border border-green-200 text-green-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
                <CheckCircle size={18} className="flex-shrink-0" />
                <span className="text-sm sm:text-base">Assessment saved successfully!</span>
              </div>
            )}
            {vm.error && (
              <div className="flex items-center gap-2 sm:gap-3 bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm sm:text-base">{vm.error}</span>
              </div>
            )}

            <AssessmentTargetCard
              targetMember={vm.targetMember}
              counsellor={user}
              todayLabel={vm.todayLabel}
            />

            <div className="border-t pt-4 sm:pt-6">
              <HealthProblemSection
                selectedProblems={vm.selectedHealthProblems}
                onChange={vm.setSelectedHealthProblems}
              />
            </div>
            <div className="border-t pt-4 sm:pt-6">
              <EatingHabitsSection
                eatingHabits={vm.eatingHabits}
                onChange={vm.setEatingHabits}
              />
            </div>
            <div className="border-t pt-4 sm:pt-6">
              <SleepQualitySection
                sleepData={vm.sleepData}
                onChange={vm.setSleepData}
              />
            </div>
            <div className="border-t pt-4 sm:pt-6">
              <MedicationSection
                medicationDetails={vm.medicationDetails}
                onChange={vm.setMedicationDetails}
              />
            </div>

            <CounsellingFormActions
              isSaving={vm.isSaving}
              canSubmit={vm.canSubmit}
              isValid={vm.isValid}
              onReset={vm.handleReset}
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default WellnessCounsellingForm;
