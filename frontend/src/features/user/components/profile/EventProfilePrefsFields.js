/**
 * Profile: Translation, Your City, Level — saved once for all event registrations.
 */
import React from 'react';
import {
  EVENT_TRANSLATION_OPTIONS,
  EVENT_YOUR_CITY_OPTIONS,
} from '../../domain/eventProfilePrefs';

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-900';

function PrefSelect({ id, label, value, options, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
        style={{ fontSize: '16px' }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function EventProfilePrefsFields({
  eventTranslation,
  setEventTranslation,
  eventYourCity,
  setEventYourCity,
}) {
  return (
    <div className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <p className="text-sm font-semibold text-gray-800">Event registration details</p>
      <PrefSelect
        id="profile-event-translation"
        label="Translation"
        value={eventTranslation}
        options={EVENT_TRANSLATION_OPTIONS}
        placeholder="Choose translation"
        onChange={setEventTranslation}
      />
      <PrefSelect
        id="profile-event-your-city"
        label="Your City"
        value={eventYourCity}
        options={EVENT_YOUR_CITY_OPTIONS}
        placeholder="Choose your city"
        onChange={setEventYourCity}
      />
    </div>
  );
}
