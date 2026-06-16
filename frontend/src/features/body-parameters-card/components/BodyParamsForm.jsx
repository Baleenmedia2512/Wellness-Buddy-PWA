/**
 * BodyParamsForm.jsx
 *
 * Modal form for creating a Body Parameters Card.
 * Pure presentational — all logic in useBodyParamsCard hook.
 * Fields: Date, Location, Name, Phone, Age, Gender, Height, Weight, BMI, Fat%, BMR, Body Age.
 */
import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useBodyParamsCard } from '../hooks/useBodyParamsCard.js';

const InputField = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
    >
      <option value="">Select</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

/**
 * @param {{ isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard, onSaveStart }} props
 */
const BodyParamsForm = ({ isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard = null, onSaveStart = null }) => {
  const vm = useBodyParamsCard({ user, selectedMember, onSaveSuccess, existingCard, onSaveStart });

  if (!isOpen) return null;

  const handleCancel = () => {
    vm.resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-600 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-bold">{vm.isEditMode ? 'Edit Body Parameters' : 'Your Body Parameters'}</h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              {selectedMember ? `For ${selectedMember.userName || 'Member'}` : (vm.form.name.trim() || (vm.isEditMode ? 'Editing card' : 'New Card'))}
            </p>
          </div>
          <button onClick={handleCancel} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {vm.error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {vm.error}
            </div>
          )}

          {/* Date + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Date" value={vm.form.recordedDate} onChange={(v) => vm.setField('recordedDate', v)} type="date" />
            <InputField label="Phone Number" value={vm.form.phoneNumber} onChange={(v) => vm.setField('phoneNumber', v)} type="tel" placeholder="e.g. +919876543210" />
          </div>

          {/* Name */}
          <InputField label="1. Name" value={vm.form.name} onChange={(v) => vm.setField('name', v)} placeholder="Full name" />

          {/* Age + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <InputField    label="2. Age"    value={vm.form.age}    onChange={(v) => vm.setField('age', v)}    type="number" placeholder="yrs" />
            <SelectField   label="3. Gender" value={vm.form.gender} onChange={(v) => vm.setField('gender', v)} options={['Male', 'Female']} />
          </div>

          {/* Divider */}
          <hr className="border-green-100" />

          {/* Height + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <InputField label="4. Height (cm)" value={vm.form.heightCm}   onChange={(v) => vm.setField('heightCm', v)}   type="number" placeholder="cm" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                5. Weight {vm.derivedIdealWeight ? `(${vm.derivedIdealWeight} kg)` : '(kg)'}
              </label>
              <input
                type="number"
                value={vm.form.weightKg}
                onChange={(e) => vm.setWeightManually(e.target.value)}
                placeholder="kg"
                className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
          </div>

          {/* BMI + BMR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                6. BMI (19–23)
              </label>
              {(() => {
                const bmiVal = parseFloat(vm.form.bmi);
                const isOutOfRange = vm.form.bmi !== '' && !isNaN(bmiVal) && (bmiVal < 19 || bmiVal > 23);
                return (
                  <>
                    <input
                      type="number"
                      value={vm.form.bmi}
                      onChange={(e) => vm.setBmiManually(e.target.value)}
                      placeholder="e.g. 21"
                      className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white border ${
                        isOutOfRange
                          ? 'border-red-400 text-red-600 focus:ring-red-300'
                          : 'border-indigo-200 focus:ring-indigo-400'
                      }`}
                    />
                    {isOutOfRange && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {bmiVal < 19 ? 'Below normal (19–23)' : 'Above normal (19–23)'}
                      </p>
                    )}
                    {!isOutOfRange && !vm.bmiUserEdited && vm.derivedBmi && (
                      <p className="text-[10px] text-indigo-400 mt-0.5">Auto-computed from height & weight</p>
                    )}
                  </>
                );
              })()}
            </div>
            <InputField label="7. BMR (kcal)"  value={vm.form.bmr}        onChange={(v) => vm.setField('bmr', v)}        type="number" placeholder="kcal" />
          </div>

          {/* Fat% + Body Age */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                8. Fat% {vm.form.gender ? `(${vm.fatHint})` : '(%)'}
              </label>
              {(() => {
                const fatVal = parseFloat(vm.form.fatPercent);
                const minFat = vm.form.gender === 'Male' ? 10 : vm.form.gender === 'Female' ? 20 : null;
                const maxFat = vm.form.gender === 'Male' ? 20 : vm.form.gender === 'Female' ? 30 : null;
                const isOutOfRange = vm.form.fatPercent !== '' && !isNaN(fatVal) && minFat !== null && (fatVal < minFat || fatVal > maxFat);
                return (
                  <>
                    <input
                      type="number"
                      value={vm.form.fatPercent}
                      onChange={(e) => vm.setField('fatPercent', e.target.value)}
                      placeholder="%"
                      className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white border ${
                        isOutOfRange
                          ? 'border-red-400 text-red-600 focus:ring-red-300'
                          : 'border-indigo-200 focus:ring-indigo-400'
                      }`}
                    />
                    {isOutOfRange && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {fatVal < minFat ? `Below normal (${minFat}–${maxFat}%)` : `Above normal (${minFat}–${maxFat}%)`}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <InputField label="9. Body Age" value={vm.form.bodyAge} onChange={(v) => vm.setField('bodyAge', v)} type="number" placeholder="yrs" />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100 flex gap-3 rounded-b-2xl">
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={vm.handleSave}
            disabled={!vm.isValid || vm.isSaving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {vm.isSaving ? 'Saving…' : vm.isEditMode ? 'Update & Share' : 'Save & Share'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodyParamsForm;
