/**
 * Profile: title, social links, Herbalife date, about, qualification, languages.
 * Links are optional until an admin makes the field required.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_BY_CODE, WORLD_LANGUAGES } from '../../domain/worldLanguages';
import {
  ABOUT_ME_MAX,
  PROFESSIONAL_TITLE_MAX,
  QUALIFICATION_MAX,
  splitHerbalifeDate,
} from '../../domain/profileIntro';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-900';

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1">
      <span className="block text-sm font-medium text-gray-700">{children}</span>
      {hint ? <span className="block text-xs text-gray-400">{hint}</span> : null}
    </div>
  );
}

function LanguagePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const selected = Array.isArray(value) ? value : [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return WORLD_LANGUAGES;
    return WORLD_LANGUAGES.filter((item) => (
      item.name.toLowerCase().includes(needle) || item.code.includes(needle)
    ));
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (code) => {
    if (selected.includes(code)) {
      onChange(selected.filter((item) => item !== code));
      return;
    }
    onChange([...selected, code]);
  };

  return (
    <div ref={rootRef}>
      <FieldLabel hint="Select every language you use.">Languages</FieldLabel>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold px-2 py-1"
            >
              {LANGUAGE_BY_CODE[code] || code} ×
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} text-left`}
        style={{ fontSize: '16px' }}
      >
        {open ? 'Close languages' : 'Select languages'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search languages"
            className="w-full px-3 py-2 border-b border-gray-200 outline-none text-gray-900"
            style={{ fontSize: '16px' }}
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((item) => (
              <label key={item.code} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 border-b border-gray-50">
                <input
                  type="checkbox"
                  checked={selected.includes(item.code)}
                  onChange={() => toggle(item.code)}
                />
                {item.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DatePart({ value, max, placeholder, inputRef, onChange, onFilled, ariaLabel }) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={max}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => {
        const next = event.target.value.replace(/\D/g, '').slice(0, max);
        onChange(next);
        if (next.length === max) onFilled?.();
      }}
      onBlur={() => {
        if (max === 2 && value.length === 1) onChange(`0${value}`);
      }}
      className="box-border h-11 w-full min-w-0 px-1 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-900"
      style={{ fontSize: '16px' }}
    />
  );
}

function HerbalifeDateFields({ value, onChange }) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const parts = splitHerbalifeDate(value);
  const write = (day, month, year) => {
    if (!day && !month && !year) {
      onChange('');
      return;
    }
    if (!month && !year) {
      onChange(day);
      return;
    }
    if (!year) {
      onChange(`${day}/${month}`);
      return;
    }
    onChange(`${day}/${month}/${year}`);
  };

  return (
    <div>
      <FieldLabel hint="Day, month, then year. Numbers only.">Date of joining Herbalife</FieldLabel>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        <DatePart
          value={parts.day}
          max={2}
          placeholder="DD"
          ariaLabel="Day"
          onChange={(day) => write(day, parts.month, parts.year)}
          onFilled={() => monthRef.current?.focus()}
        />
        <span className="text-gray-400 font-semibold leading-none">/</span>
        <DatePart
          inputRef={monthRef}
          value={parts.month}
          max={2}
          placeholder="MM"
          ariaLabel="Month"
          onChange={(month) => write(parts.day, month, parts.year)}
          onFilled={() => yearRef.current?.focus()}
        />
        <span className="text-gray-400 font-semibold leading-none">/</span>
        <DatePart
          inputRef={yearRef}
          value={parts.year}
          max={4}
          placeholder="YYYY"
          ariaLabel="Year"
          onChange={(year) => write(parts.day, parts.month, year)}
        />
      </div>
    </div>
  );
}

export default function ProfileIntroFields({ values = {}, onChange, keys = null }) {
  const show = (key) => !keys || keys.includes(key);
  const set = (key) => (event) => onChange(key, event.target.value);

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800">About you</p>
      {show('professionalTitle') && (
        <div>
          <FieldLabel hint={`Up to ${PROFESSIONAL_TITLE_MAX} characters. Example: Wellness coach`}>
            Professional title
          </FieldLabel>
          <input
            type="text"
            maxLength={PROFESSIONAL_TITLE_MAX}
            value={values.professionalTitle || ''}
            onChange={set('professionalTitle')}
            placeholder=""
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('instagram') && (
        <div>
          <FieldLabel hint="Optional. Paste your Instagram profile link.">Instagram</FieldLabel>
          <input
            type="url"
            value={values.instagram || ''}
            onChange={set('instagram')}
            placeholder="https://instagram.com/your-name"
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('youtube') && (
        <div>
          <FieldLabel hint="Optional. Paste your YouTube channel link.">YouTube</FieldLabel>
          <input
            type="url"
            value={values.youtube || ''}
            onChange={set('youtube')}
            placeholder="https://youtube.com/@your-channel"
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('linkedin') && (
        <div>
          <FieldLabel hint="Optional. Paste your LinkedIn profile link.">LinkedIn</FieldLabel>
          <input
            type="url"
            value={values.linkedin || ''}
            onChange={set('linkedin')}
            placeholder="https://linkedin.com/in/your-name"
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('herbalifeJoinedOn') && (
        <HerbalifeDateFields
          value={values.herbalifeJoinedOn || ''}
          onChange={(next) => onChange('herbalifeJoinedOn', next)}
        />
      )}
      {show('aboutMe') && (
        <div>
          <FieldLabel hint={`${String(values.aboutMe || '').length}/${ABOUT_ME_MAX} characters`}>
            About me
          </FieldLabel>
          <textarea
            rows={4}
            maxLength={ABOUT_ME_MAX}
            value={values.aboutMe || ''}
            onChange={set('aboutMe')}
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('qualification') && (
        <div>
          <FieldLabel hint={`${String(values.qualification || '').length}/${QUALIFICATION_MAX} characters`}>
            Qualification
          </FieldLabel>
          <textarea
            rows={3}
            maxLength={QUALIFICATION_MAX}
            value={values.qualification || ''}
            onChange={set('qualification')}
            className={inputClass}
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {show('languages') && (
        <LanguagePicker
          value={values.languages}
          onChange={(next) => onChange('languages', next)}
        />
      )}
    </div>
  );
}
