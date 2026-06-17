/**
 * BodyParamsForm.jsx
 *
 * Modal form for creating a Body Parameters Card.
 * Pure presentational — all logic in useBodyParamsCard hook.
 * Fields: Date, Location, Name, Phone, Age, Gender, Height, Weight, BMI, Fat%, BMR, Body Age.
 */
import React, { useRef, useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useBodyParamsCard } from '../hooks/useBodyParamsCard.js';
import PhoneAutocomplete from './PhoneAutocomplete.jsx';
import InlineNumericKeypad from '../../user/components/InlineNumericKeypad.js';

const InputField = ({ label, value, onChange, type = 'text', placeholder = '', inputRef, onEnter, maxLength, inputMode: customInputMode, onFocus, onBlur, readOnly }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  // Use inputMode for better mobile keyboard control
  const inputMode = customInputMode || (type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : 'text');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">{label}</label>
      <input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        autoComplete="off"
        className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      />
    </div>
  );
};

const SelectField = ({ label, value, onChange, options, inputRef, onEnter }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">{label}</label>
      <select
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
};

/**
 * @param {{ isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard, onSaveStart }} props
 */
const BodyParamsForm = ({ isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard = null, onSaveStart = null }) => {
  const vm = useBodyParamsCard({ user, selectedMember, onSaveSuccess, existingCard, onSaveStart });

  // State for custom keypad
  const [focusedField, setFocusedField] = useState(null);
  const [isAndroid, setIsAndroid] = useState(false);

  // Detect Android on mount
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroidDevice = ua.indexOf('android') > -1;
    setIsAndroid(isAndroidDevice);
  }, []);

  // Refs for all input fields
  const phoneRef = useRef(null);
  const nameRef = useRef(null);
  const ageRef = useRef(null);
  const genderRef = useRef(null);
  const heightRef = useRef(null);
  const weightRef = useRef(null);
  const bmiRef = useRef(null);
  const bmrRef = useRef(null);
  const fatRef = useRef(null);
  const bodyAgeRef = useRef(null);

  // Handle keypad digit input
  const handleKeypadDigit = (digit) => {
    if (!focusedField) return;
    
    const currentValue = vm.form[focusedField] || '';
    
    // Handle decimal point - only one allowed
    if (digit === '.') {
      if (currentValue.includes('.')) return; // Already has decimal
      if (currentValue === '') {
        // Start with "0."
        const newValue = '0.';
        if (focusedField === 'weightKg') {
          vm.setWeightManually(newValue);
        } else if (focusedField === 'bmi') {
          vm.setBmiManually(newValue);
        } else {
          vm.setField(focusedField, newValue);
        }
        return;
      }
    }
    
    const newValue = currentValue + digit;
    
    // Apply maxLength restrictions (for non-decimal fields)
    if (focusedField === 'phoneNumber' && newValue.length > 10) return;
    if (focusedField === 'age' && newValue.length > 2) return;
    
    // Use special setter for weight and BMI
    if (focusedField === 'weightKg') {
      vm.setWeightManually(newValue);
    } else if (focusedField === 'bmi') {
      vm.setBmiManually(newValue);
    } else {
      vm.setField(focusedField, newValue);
    }
  };

  // Handle keypad backspace
  const handleKeypadBackspace = () => {
    if (!focusedField) return;
    
    const currentValue = vm.form[focusedField] || '';
    const newValue = currentValue.slice(0, -1);
    
    // Use special setter for weight and BMI
    if (focusedField === 'weightKg') {
      vm.setWeightManually(newValue);
    } else if (focusedField === 'bmi') {
      vm.setBmiManually(newValue);
    } else {
      vm.setField(focusedField, newValue);
    }
  };

  // Handle field focus
  const handleFieldFocus = (fieldName) => {
    if (isAndroid) {
      setFocusedField(fieldName);
    }
  };

  // Handle field blur
  const handleFieldBlur = () => {
    // Delay to allow keypad clicks to register
    setTimeout(() => setFocusedField(null), 150);
  };

  // Focus next field with smooth scroll
  const focusNextField = (ref) => {
    if (ref && ref.current) {
      ref.current.focus();
      // Scroll to 'start' to position field at top, avoiding keyboard overlap
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      
      // Additional manual scroll adjustment for mobile keyboards
      setTimeout(() => {
        const elementRect = ref.current.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const middle = absoluteElementTop - (window.innerHeight / 4); // Position in upper quarter
        window.scrollTo({ top: middle, behavior: 'smooth' });
      }, 100);
    }
  };

  if (!isOpen) return null;

  const handleCancel = () => {
    vm.resetForm();
    onClose();
  };

  const handleSave = async () => {
    await vm.handleSave();
    // After successful save, reset form so next open shows empty form
    if (!vm.error) {
      vm.resetForm();
    }
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-3"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative z-[71]"
        onClick={(e) => e.stopPropagation()}
      >

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

          {/* Date */}
          <InputField 
            label="Date" 
            value={vm.form.recordedDate} 
            onChange={(v) => vm.setField('recordedDate', v)} 
            type="date"
            onEnter={() => focusNextField(phoneRef)}
          />

          {/* Phone Number */}
          <PhoneAutocomplete
            value={vm.form.phoneNumber}
            onChange={vm.setPhoneField}
            suggestions={vm.phoneSuggestions}
            onSelect={vm.fillFromMember}
            isLoading={vm.phoneSearchLoading}
            inputRef={phoneRef}
            onEnter={() => focusNextField(nameRef)}
            onFocus={() => handleFieldFocus('phoneNumber')}
            onBlur={handleFieldBlur}
            readOnly={isAndroid}
          />

          {/* Name */}
          <InputField 
            label="Name" 
            value={vm.form.name} 
            onChange={(v) => vm.setField('name', v)} 
            placeholder="Full name"
            inputRef={nameRef}
            onEnter={() => focusNextField(ageRef)}
          />

          {/* Age + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <InputField 
              label="Age" 
              value={vm.form.age} 
              onChange={(v) => vm.setField('age', v)} 
              type="number"
              inputMode="decimal"
              maxLength={2}
              inputRef={ageRef}
              onEnter={() => focusNextField(genderRef)}
              onFocus={() => handleFieldFocus('age')}
              onBlur={handleFieldBlur}
              readOnly={isAndroid}
            />
            <SelectField 
              label="Gender" 
              value={vm.form.gender} 
              onChange={(v) => vm.setField('gender', v)} 
              options={['Male', 'Female']}
              inputRef={genderRef}
              onEnter={() => focusNextField(heightRef)}
            />
          </div>

          {/* Divider */}
          <hr className="border-green-100" />

          {/* Height + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <InputField 
              label="Height (cm)" 
              value={vm.form.heightCm} 
              onChange={(v) => vm.setField('heightCm', v)} 
              type="number" 
              placeholder="cm"
              inputRef={heightRef}
              onEnter={() => focusNextField(weightRef)}
              onFocus={() => handleFieldFocus('heightCm')}
              onBlur={handleFieldBlur}
              readOnly={isAndroid}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                Weight {vm.derivedIdealWeight ? `(${vm.derivedIdealWeight} kg)` : '(kg)'}
              </label>
              {(() => {
                const weightVal = parseFloat(vm.form.weightKg);
                const heightVal = parseFloat(vm.form.heightCm);
                // Calculate ideal weight range: BMI 18.5 to 23
                const minIdealWeight = heightVal >= 50 && heightVal <= 250 ? Math.round((18.5 * Math.pow(heightVal / 100, 2)) * 10) / 10 : null;
                const maxIdealWeight = heightVal >= 50 && heightVal <= 250 ? Math.round((23 * Math.pow(heightVal / 100, 2)) * 10) / 10 : null;
                
                const isUnderweight = vm.form.weightKg !== '' && !isNaN(weightVal) && minIdealWeight && weightVal < minIdealWeight;
                const isOverweight = vm.form.weightKg !== '' && !isNaN(weightVal) && maxIdealWeight && weightVal > maxIdealWeight;
                
                const handleKeyDown = (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(bmiRef);
                  }
                };

                const handleFocus = () => handleFieldFocus('weightKg');
                
                return (
                  <>
                    <input
                      ref={weightRef}
                      type="number"
                      inputMode="decimal"
                      value={vm.form.weightKg}
                      onChange={(e) => vm.setWeightManually(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleFocus}
                      onBlur={handleFieldBlur}
                      readOnly={isAndroid}
                      placeholder="kg"
                      className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white border ${
                        isUnderweight
                          ? 'border-blue-400 text-blue-600 focus:ring-blue-300'
                          : isOverweight
                          ? 'border-red-400 text-red-600 focus:ring-red-300'
                          : 'border-indigo-200 focus:ring-indigo-400'
                      }`}
                    />
                    {isUnderweight && minIdealWeight && maxIdealWeight && (
                      <p className="text-[10px] text-blue-500 mt-0.5">
                        Underweight (Ideal: {minIdealWeight}–{maxIdealWeight} kg)
                      </p>
                    )}
                    {isOverweight && minIdealWeight && maxIdealWeight && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        Overweight (Ideal: {minIdealWeight}–{maxIdealWeight} kg)
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* BMI + Fat% */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                BMI (19–23)
              </label>
              {(() => {
                const bmiVal = parseFloat(vm.form.bmi);
                const isOutOfRange = vm.form.bmi !== '' && !isNaN(bmiVal) && (bmiVal < 19 || bmiVal > 23);
                
                const handleKeyDown = (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(fatRef);
                  }
                };

                const handleFocus = () => handleFieldFocus('bmi');
                
                return (
                  <>
                    <input
                      ref={bmiRef}
                      type="number"
                      inputMode="decimal"
                      value={vm.form.bmi}
                      onChange={(e) => vm.setBmiManually(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleFocus}
                      onBlur={handleFieldBlur}
                      readOnly={isAndroid}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                Fat% {vm.form.gender ? `(${vm.fatHint})` : '(%)'}
              </label>
              {(() => {
                const fatVal = parseFloat(vm.form.fatPercent);
                const minFat = vm.form.gender === 'Male' ? 10 : vm.form.gender === 'Female' ? 20 : null;
                const maxFat = vm.form.gender === 'Male' ? 20 : vm.form.gender === 'Female' ? 30 : null;
                const isOutOfRange = vm.form.fatPercent !== '' && !isNaN(fatVal) && minFat !== null && (fatVal < minFat || fatVal > maxFat);
                
                const handleKeyDown = (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField(bmrRef);
                  }
                };

                const handleFocus = () => handleFieldFocus('fatPercent');
                
                return (
                  <>
                    <input
                      ref={fatRef}
                      type="number"
                      inputMode="decimal"
                      value={vm.form.fatPercent}
                      onChange={(e) => vm.setField('fatPercent', e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleFocus}
                      onBlur={handleFieldBlur}
                      readOnly={isAndroid}
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
          </div>

          {/* BMR + Body Age */}
          <div className="grid grid-cols-2 gap-3">
            <InputField 
              label="BMR (kcal)" 
              value={vm.form.bmr} 
              onChange={(v) => vm.setField('bmr', v)} 
              type="number" 
              placeholder="kcal"
              inputRef={bmrRef}
              onEnter={() => focusNextField(bodyAgeRef)}
              onFocus={() => handleFieldFocus('bmr')}
              onBlur={handleFieldBlur}
              readOnly={isAndroid}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                Body Age
              </label>
              {(() => {
                const bodyAgeVal = parseFloat(vm.form.bodyAge);
                const actualAge = parseFloat(vm.form.age);
                const isOlderThanActual = vm.form.bodyAge !== '' && vm.form.age !== '' && !isNaN(bodyAgeVal) && !isNaN(actualAge) && bodyAgeVal > actualAge;
                
                const handleKeyDown = (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Last field - could trigger save or just blur
                  }
                };

                const handleFocus = () => handleFieldFocus('bodyAge');
                
                return (
                  <>
                    <input
                      ref={bodyAgeRef}
                      type="number"
                      inputMode="decimal"
                      value={vm.form.bodyAge}
                      onChange={(e) => vm.setField('bodyAge', e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleFocus}
                      onBlur={handleFieldBlur}
                      readOnly={isAndroid}
                      placeholder="yrs"
                      className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white border ${
                        isOlderThanActual
                          ? 'border-red-400 text-red-600 focus:ring-red-300'
                          : 'border-indigo-200 focus:ring-indigo-400'
                      }`}
                    />
                    {isOlderThanActual && (
                      <p className="text-[10px] text-red-500 mt-0.5">
                        Body age higher than actual age ({actualAge} yrs)
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Custom Numeric Keypad for Android */}
          {isAndroid && focusedField && (
            <div className="mt-6 pb-2">
              <InlineNumericKeypad
                onDigit={handleKeypadDigit}
                onBackspace={handleKeypadBackspace}
                showDecimal={['heightCm', 'weightKg', 'bmi', 'fatPercent', 'bmr', 'bodyAge'].includes(focusedField)}
              />
            </div>
          )}
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
            onClick={handleSave}
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
