/**
 * Profile: title, social links, community date, about, qualification, languages you speak.
 * Links are optional until an admin makes the field required.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_BY_CODE, WORLD_LANGUAGES } from '../../domain/worldLanguages';
import {
  ABOUT_ME_MAX,
  PROFESSIONAL_TITLE_MAX,
  QUALIFICATION_MAX,
  herbalifeDateMaxIso,
  herbalifeDateToIso,
  isoToHerbalifeDate,
} from '../../domain/profileIntro';
import { profileIntroFieldDomId } from '../../domain/profileIntroFocus';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-900';

const highlightInputClass =
  'w-full px-3 py-2 border-2 border-rose-500 rounded-lg ring-2 ring-rose-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-600 outline-none bg-rose-50/40 text-gray-900';

function FieldLabel({ children, hint, requiredMark = false }) {
  return (
    <div className="mb-1">
      <span className={`block text-sm font-medium ${requiredMark ? 'text-rose-700' : 'text-gray-700'}`}>
        {children}
        {requiredMark ? <span className="ml-1 font-semibold text-rose-600">*</span> : null}
      </span>
      {hint ? (
        <span className={`block text-xs ${requiredMark ? 'text-rose-500' : 'text-gray-400'}`}>{hint}</span>
      ) : null}
    </div>
  );
}

function LanguagePicker({ value, onChange, highlighted = false }) {
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

  const fieldClass = highlighted ? highlightInputClass : inputClass;

  return (
    <div
      ref={rootRef}
      id={profileIntroFieldDomId('languages')}
      className={highlighted ? 'rounded-xl border-2 border-rose-400 bg-rose-50/50 p-3' : undefined}
    >
      <FieldLabel
        requiredMark={highlighted}
        hint={highlighted ? 'Required — select at least one language.' : 'Select every language you use.'}
      >
        Languages you speak
      </FieldLabel>
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
        className={`${fieldClass} text-left`}
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

function HerbalifeDateFields({ value, onChange, highlighted = false }) {
  const isoValue = herbalifeDateToIso(value);
  const maxIso = herbalifeDateMaxIso();
  const fieldClass = highlighted ? highlightInputClass : inputClass;

  return (
    <div
      id={profileIntroFieldDomId('herbalifeJoinedOn')}
      className={highlighted ? 'rounded-xl border-2 border-rose-400 bg-rose-50/50 p-3' : undefined}
    >
      <FieldLabel
        requiredMark={highlighted}
        hint={highlighted
          ? 'Required — open the calendar and pick the day you joined.'
          : 'Open the calendar and pick the day you joined.'}
      >
        Date of joining community
      </FieldLabel>
      <input
        type="date"
        value={isoValue}
        min="1980-01-01"
        max={maxIso}
        aria-label="Date of joining community"
        onChange={(event) => {
          const next = event.target.value;
          onChange(next ? isoToHerbalifeDate(next) : '');
        }}
        className={fieldClass}
        style={{ fontSize: '16px' }}
      />
      {isoValue ? (
        <p className="mt-1 text-xs text-gray-500">As {isoToHerbalifeDate(isoValue)} (day / month / year).</p>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   values?: object,
 *   onChange: (key: string, value: unknown) => void,
 *   keys?: string[]|null,
 *   highlightKeys?: string[]|null,
 * }} props
 */
export default function ProfileIntroFields({
  values = {},
  onChange,
  keys = null,
  highlightKeys = null,
}) {
  const show = (key) => !keys || keys.includes(key);
  const marked = (key) => Array.isArray(highlightKeys) && highlightKeys.includes(key);
  const set = (key) => (event) => onChange(key, event.target.value);
  const fieldClass = (key) => (marked(key) ? highlightInputClass : inputClass);
  const wrapClass = (key) => (
    marked(key) ? 'rounded-xl border-2 border-rose-400 bg-rose-50/50 p-3' : undefined
  );

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-800">About you</p>
      {show('professionalTitle') && (
        <div id={profileIntroFieldDomId('professionalTitle')} className={wrapClass('professionalTitle')}>
          <FieldLabel
            requiredMark={marked('professionalTitle')}
            hint={marked('professionalTitle')
              ? `Required — up to ${PROFESSIONAL_TITLE_MAX} characters.`
              : `Up to ${PROFESSIONAL_TITLE_MAX} characters. Example: Wellness coach`}
          >
            Professional title
          </FieldLabel>
          <input
            type="text"
            maxLength={PROFESSIONAL_TITLE_MAX}
            value={values.professionalTitle || ''}
            onChange={set('professionalTitle')}
            placeholder=""
            className={fieldClass('professionalTitle')}
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
          highlighted={marked('herbalifeJoinedOn')}
        />
      )}
      {show('aboutMe') && (
        <div id={profileIntroFieldDomId('aboutMe')} className={wrapClass('aboutMe')}>
          <FieldLabel
            requiredMark={marked('aboutMe')}
            hint={marked('aboutMe')
              ? `Required — ${String(values.aboutMe || '').length}/${ABOUT_ME_MAX} characters`
              : `${String(values.aboutMe || '').length}/${ABOUT_ME_MAX} characters`}
          >
            About me
          </FieldLabel>
          <textarea
            rows={4}
            maxLength={ABOUT_ME_MAX}
            value={values.aboutMe || ''}
            onChange={set('aboutMe')}
            className={fieldClass('aboutMe')}
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
          highlighted={marked('languages')}
        />
      )}
    </div>
  );
}
