/**
 * BodyParamsForm.jsx
 *
 * Modal form for creating a Body Parameters Card.
 * Pure presentational — all logic in useBodyParamsCard hook.
 * Fields: Date, Venue, Name, Phone, Age, Gender, Height, Weight, BMI, Fat%, BMR, Body Age, Chest, Waist, Hip.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useBodyParamsCard } from '../hooks/useBodyParamsCard.js';
import PhoneAutocomplete from './PhoneAutocomplete.jsx';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import HealthIssuesFilterSelect from './HealthIssuesFilterSelect.jsx';
import {
  BCM_DEPENDENT_PARENTS,
  getBcmParentNeededHint,
  getFirstMissingBcmRequiredField,
  isBcmParentFilled,
  isValidBcmGender,
} from '../domain/formValidation.rules.js';
import {
  evaluateChestCm,
  evaluateHipCm,
  evaluateVisceralFat,
  evaluateWaistCm,
  getChestCmReference,
  getHipCmReference,
  getVisceralFatReference,
  getWaistCmReference,
} from '../domain/bodyMetricReferences.js';

function rangeOutOfRangeError(evalResult, referenceLabel) {
  if (!evalResult?.isOutOfRange || !referenceLabel) return null;
  if (evalResult.direction === 'low') return `Below expected (Ideal: ${referenceLabel})`;
  return `Above expected (Ideal: ${referenceLabel})`;
}

const fieldBorderClass = (invalid, needed) => {
  if (invalid) return 'border-red-400 text-red-600 focus:ring-red-300';
  if (needed) return 'border-amber-400 text-amber-700 focus:ring-amber-300';
  return 'border-indigo-200 focus:ring-indigo-400';
};

const FieldLabel = ({ children }) => (
  <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
    {children}
  </label>
);

const InputField = ({
  label, value, onChange, type = 'text', placeholder = '', inputRef, onEnter,
  maxLength, inputMode: customInputMode, pattern: customPattern, autoComplete,
  error, hint, needed,
  ...rest
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  // Use inputMode for better mobile keyboard control
  // For Capacitor APK: use type="text" with inputMode for numeric fields to force numeric keypad
  const inputMode = customInputMode || (type === 'number' ? 'numeric' : 'text');
  const pattern = customPattern || (type === 'number' || customInputMode ? '[0-9]*' : undefined);
  const inputType = type === 'number' ? 'text' : type;
  const isInvalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <NativeInput
        ref={inputRef}
        type={inputType}
        inputMode={inputMode}
        pattern={pattern}
        autoComplete={autoComplete ?? 'off'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={isInvalid}
        {...rest}
        className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${fieldBorderClass(isInvalid, needed)}`}
      />
      {error ? (
        <p className="text-[10px] text-red-500 mt-0.5" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-amber-600 mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
};

const SelectField = ({
  label, value, onChange, options, inputRef, onEnter, error, hint, needed,
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };
  const isInvalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <select
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-invalid={isInvalid}
        className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${fieldBorderClass(isInvalid, needed)}`}
      >
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error ? (
        <p className="text-[10px] text-red-500 mt-0.5" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-amber-600 mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
};

/**
 * @param {{ isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard, onSaveStart, externalVenue, onVenueChange, hideVenueField }} props
 */
const BodyParamsForm = ({
  isOpen, onClose, user, selectedMember, onSaveSuccess, existingCard = null, onSaveStart = null,
  externalVenue = null, onVenueChange = null, hideVenueField = false,
}) => {
  const vm = useBodyParamsCard({
    user, selectedMember, onSaveSuccess, existingCard, onSaveStart, isOpen,
    externalVenue,
  });

  // Refs for all input fields
  const venueRef = useRef(null);
  const phoneRef = useRef(null);
  const nameRef = useRef(null);
  const ageRef = useRef(null);
  const genderRef = useRef(null);
  const heightRef = useRef(null);
  const weightRef = useRef(null);
  const fatRef = useRef(null);
  const vfatRef = useRef(null);
  const bmrRef = useRef(null);
  const bmiRef = useRef(null);
  const bodyAgeRef = useRef(null);
  const chestRef = useRef(null);
  const waistRef = useRef(null);
  const hipRef = useRef(null);
  const [requestedFor, setRequestedFor] = useState(null);

  useEffect(() => {
    if (!isOpen) setRequestedFor(null);
  }, [isOpen]);

  const parentRefs = {
    gender: genderRef,
    heightCm: heightRef,
    age: ageRef,
  };

  const scrollToField = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  const takeUserToParent = (forField) => {
    const meta = BCM_DEPENDENT_PARENTS[forField];
    if (!meta) return false;
    if (isBcmParentFilled(meta.parent, vm.form)) return false;
    setRequestedFor(forField);
    window.setTimeout(() => scrollToField(parentRefs[meta.parent]), 0);
    return true;
  };

  const clearParentRequestIfFilled = (parentField, value) => {
    if (isBcmParentFilled(parentField, { ...vm.form, [parentField]: value })) {
      setRequestedFor(null);
    }
  };

  // Focus next field with smooth scroll
  const focusNextField = (ref) => {
    scrollToField(ref);
  };

  if (!isOpen) return null;

  const handleCancel = () => {
    vm.resetForm();
    onClose();
  };

  const handleSave = async () => {
    vm.markAttemptedSubmit();
    const missing = getFirstMissingBcmRequiredField(vm.form);
    if (missing === 'name') {
      scrollToField(nameRef);
      return;
    }
    if (missing === 'phoneNumber') {
      scrollToField(phoneRef);
      return;
    }
    await vm.handleSave();
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  const ageNeededHint = getBcmParentNeededHint('age', vm.form, { requestedFor });
  const genderNeededHint = getBcmParentNeededHint('gender', vm.form, { requestedFor });
  const heightNeededHint = getBcmParentNeededHint('heightCm', vm.form, { requestedFor });

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
              {selectedMember ? `For ${selectedMember.userName || 'Customer'}` : (vm.form.name.trim() || (vm.isEditMode ? 'Editing card' : 'New Card'))}
            </p>
          </div>
          <button onClick={handleCancel} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {vm.error && !/user already exists/i.test(String(vm.error)) && (
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
            onEnter={() => focusNextField(hideVenueField ? nameRef : venueRef)}
          />

          {/* Venue — editable; prefilled from header when provided */}
          {!hideVenueField && (
            <InputField
              label="Venue"
              value={vm.form.locationName}
              onChange={(v) => {
                vm.setField('locationName', v);
                if (onVenueChange) onVenueChange(v);
              }}
              placeholder="e.g. Chennai"
              inputRef={venueRef}
              onEnter={() => focusNextField(nameRef)}
            />
          )}

          {/* Name */}
          <InputField 
            label="Name"
            value={vm.form.name} 
            onChange={(v) => vm.setField('name', v)} 
            placeholder="FULL NAME"
            autoCapitalize="characters"
            inputRef={nameRef}
            onEnter={() => focusNextField(phoneRef)}
            onBlur={vm.onNameBlur}
            error={vm.nameError}
          />

          {/* Phone Number — required identity field sits with Name */}
          <PhoneAutocomplete
            value={vm.form.phoneNumber}
            onChange={vm.setPhoneField}
            suggestions={vm.phoneSuggestions}
            onSelect={vm.fillFromMember}
            isLoading={vm.phoneSearchLoading}
            inputRef={phoneRef}
            onEnter={() => focusNextField(ageRef)}
            onBlur={() => {
              vm.onPhoneBlur();
              vm.recheckPhoneStatus();
            }}
            error={vm.phoneFieldError}
          />

          {/* Age - Full Width */}
          <InputField 
            label="Age" 
            value={vm.form.age} 
            onChange={(v) => {
              vm.setField('age', v);
              clearParentRequestIfFilled('age', v);
            }} 
            type="number"
            inputMode="decimal"
            maxLength={2}
            inputRef={ageRef}
            onEnter={() => focusNextField(genderRef)}
            needed={Boolean(ageNeededHint)}
            hint={ageNeededHint}
          />

          {/* Gender - Full Width */}
          <SelectField 
            label="Gender" 
            value={vm.form.gender} 
            onChange={(v) => {
              vm.setField('gender', v);
              if (isValidBcmGender(v)) setRequestedFor(null);
            }} 
            options={['Male', 'Female']}
            inputRef={genderRef}
            onEnter={() => focusNextField(heightRef)}
            needed={Boolean(genderNeededHint)}
            hint={genderNeededHint}
          />

          {/* Divider */}
          <hr className="border-green-100" />

          {/* Height - Full Width */}
          <InputField 
            label="Height (cm)" 
            value={vm.form.heightCm} 
            onChange={(v) => {
              vm.setField('heightCm', v);
              clearParentRequestIfFilled('heightCm', v);
            }} 
            type="number" 
            placeholder="cm"
            inputRef={heightRef}
            onEnter={() => focusNextField(weightRef)}
            needed={Boolean(heightNeededHint)}
            hint={heightNeededHint}
          />

          {/* Weight - Full Width */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
              {vm.derivedIdealWeightRange
                ? `Weight (Ideal: ${vm.derivedIdealWeightRange.lo}–${vm.derivedIdealWeightRange.hi} kg)`
                : 'Weight (kg)'}
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
                  focusNextField(fatRef);
                }
              };
              
              return (
                <>
                  <input
                    ref={weightRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={vm.form.weightKg}
                    onChange={(e) => {
                      if (takeUserToParent('weightKg')) return;
                      vm.setWeightManually(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { takeUserToParent('weightKg'); }}
                    placeholder="kg"
                    className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white border ${
                      isUnderweight || isOverweight
                        ? 'border-red-400 text-red-600 focus:ring-red-300'
                        : 'border-indigo-200 focus:ring-indigo-400'
                    }`}
                  />
                  {isUnderweight && minIdealWeight && maxIdealWeight && (
                    <p className="text-[10px] text-red-500 mt-0.5">
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

          {/* Fat% - Full Width */}
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
                  focusNextField(vfatRef);
                }
              };
              
              return (
                <>
                  <input
                    ref={fatRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={vm.form.fatPercent}
                    onChange={(e) => {
                      if (takeUserToParent('fatPercent')) return;
                      vm.setField('fatPercent', e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { takeUserToParent('fatPercent'); }}
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

          {/* V-Fat - Full Width */}
          {(() => {
            const vFatEval = evaluateVisceralFat(vm.form.visceralFat);
            const vFatRefLabel = getVisceralFatReference();
            return (
              <InputField
                label={`V-Fat (Ideal: ${vFatRefLabel})`}
                value={vm.form.visceralFat}
                onChange={(v) => vm.setField('visceralFat', v)}
                type="number"
                placeholder="Visceral fat"
                inputRef={vfatRef}
                onEnter={() => focusNextField(bmrRef)}
                error={rangeOutOfRangeError(vFatEval, vFatRefLabel)}
              />
            );
          })()}

          {/* BMR - editable; auto-filled from weight + fat % when not manually edited */}
          <div className="flex flex-col gap-1">
            <InputField
              label="BMR (kcal)"
              value={vm.form.bmr}
              onChange={(v) => vm.setBmrManually(v)}
              type="number"
              placeholder="kcal"
              inputRef={bmrRef}
              onEnter={() => focusNextField(bmiRef)}
            />
            {!vm.bmrUserEdited && vm.derivedBmr != null && (
              <p className="text-[10px] text-indigo-400 -mt-0.5">Auto-computed from weight &amp; fat %</p>
            )}
          </div>

          {/* BMI - Full Width */}
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
                  focusNextField(bodyAgeRef);
                }
              };
              
              return (
                <>
                  <input
                    ref={bmiRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    value={vm.form.bmi}
                    onChange={(e) => vm.setBmiManually(e.target.value)}
                    onKeyDown={handleKeyDown}
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
          {/* Body Age */}
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
                  focusNextField(chestRef);
                }
              };
              
              return (
                <>
                  <input
                    ref={bodyAgeRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={vm.form.bodyAge}
                    onChange={(e) => {
                      if (takeUserToParent('bodyAge')) return;
                      vm.setField('bodyAge', e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { takeUserToParent('bodyAge'); }}
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

          {/* Chest - Full Width */}
          {(() => {
            const gender = vm.form.gender;
            const refLabel = getChestCmReference(gender);
            const evalResult = evaluateChestCm(vm.form.chestCm, gender);
            return (
              <InputField
                label={refLabel ? `Chest (Ideal: ${refLabel})` : 'Chest (cm)'}
                value={vm.form.chestCm}
                onChange={(v) => {
                  if (takeUserToParent('chestCm')) return;
                  vm.setField('chestCm', v);
                }}
                onFocus={() => { takeUserToParent('chestCm'); }}
                type="number"
                placeholder="cm"
                inputRef={chestRef}
                onEnter={() => focusNextField(waistRef)}
                error={rangeOutOfRangeError(evalResult, refLabel)}
              />
            );
          })()}

          {/* Waist - Full Width */}
          {(() => {
            const gender = vm.form.gender;
            const refLabel = getWaistCmReference(gender);
            const evalResult = evaluateWaistCm(vm.form.waistCm, gender);
            return (
              <InputField
                label={refLabel ? `Waist (Ideal: ${refLabel})` : 'Waist (cm)'}
                value={vm.form.waistCm}
                onChange={(v) => {
                  if (takeUserToParent('waistCm')) return;
                  vm.setField('waistCm', v);
                }}
                onFocus={() => { takeUserToParent('waistCm'); }}
                type="number"
                placeholder="cm"
                inputRef={waistRef}
                onEnter={() => focusNextField(hipRef)}
                error={rangeOutOfRangeError(evalResult, refLabel)}
              />
            );
          })()}

          {/* Hip - Full Width */}
          {(() => {
            const gender = vm.form.gender;
            const refLabel = getHipCmReference(gender);
            const evalResult = evaluateHipCm(vm.form.hipCm, gender);
            return (
              <InputField
                label={refLabel ? `Hip (Ideal: ${refLabel})` : 'Hip (cm)'}
                value={vm.form.hipCm}
                onChange={(v) => {
                  if (takeUserToParent('hipCm')) return;
                  vm.setField('hipCm', v);
                }}
                onFocus={() => { takeUserToParent('hipCm'); }}
                type="number"
                placeholder="cm"
                inputRef={hipRef}
                error={rangeOutOfRangeError(evalResult, refLabel)}
              />
            );
          })()}

          {/* Health Issues — filter-style multi-select */}
          <div className="mt-1">
            <HealthIssuesFilterSelect
              value={vm.form.recoveredHealthIssues || []}
              onChange={(next) => vm.setField('recoveredHealthIssues', next)}
            />
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
            onClick={handleSave}
            disabled={!vm.canAttemptSave}
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
