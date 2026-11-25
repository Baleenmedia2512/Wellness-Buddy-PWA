import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, User, X } from 'lucide-react';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { searchEventPeople } from '../services/events.api.js';
import { buildUserAvatarUrl } from '../../user/services/avatarDisplayVersion.js';

const AVATAR_TONES = [
  'bg-green-600',
  'bg-emerald-600',
  'bg-teal-600',
  'bg-lime-700',
  'bg-green-700',
];

function personInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarTone(userId) {
  return AVATAR_TONES[Math.abs(Number(userId) || 0) % AVATAR_TONES.length];
}

function avatarSrc(userId) {
  try {
    return buildUserAvatarUrl(getApiBaseUrl(), userId);
  } catch {
    return null;
  }
}

function PersonAvatar({ userId, name, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const src = userId && !failed ? avatarSrc(userId) : null;
  const box = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm';

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ring-2 ring-white`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${box} ${avatarTone(userId)} inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white`}
    >
      {personInitials(name)}
    </span>
  );
}

function toPickerPerson(person) {
  const uplineLabel = String(person.uplineLabel || '').trim();
  const coachName = String(person.coachName || '').trim();
  const coCoachName = String(person.coCoachName || '').trim();
  const builtUpline =
    uplineLabel ||
    [coachName, coCoachName].filter(Boolean).join(' / ');
  return {
    userId: Number(person.userId),
    name: String(person.name || person.userName || '').trim(),
    email: String(person.email || '').trim(),
    uplineLabel: builtUpline || undefined,
  };
}

function isPickerPerson(person) {
  return Number.isInteger(person.userId) && person.userId > 0 && person.name;
}

/**
 * Single-select type-and-search over all Active Wellness Valley people.
 * Does not dump a default list — results appear only after typing 2+ characters.
 */
export default function MemberSearchPicker({
  userId,
  label,
  value,
  onChange,
  inputId,
  hint = 'Type a name to find people.',
  error = '',
  required = false,
  showUpline = false,
  labelledBy = '',
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const selectedName = String(value?.name || '').trim();
  const searchingNow = query.trim().length >= 2;
  const labelId = `${inputId}-label`;

  useEffect(() => {
    const text = query.trim();
    if (!userId || text.length < 2) {
      setMatches([]);
      setSearching(false);
      return undefined;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchEventPeople({ userId, q: text })
        .then((people) => {
          if (live) setMatches((people || []).map(toPickerPerson).filter(isPickerPerson));
        })
        .catch(() => {
          if (live) setMatches([]);
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, userId]);

  const options = useMemo(() => {
    const unique = [];
    const seen = new Set();
    matches.forEach((person) => {
      if (seen.has(person.userId)) return;
      seen.add(person.userId);
      unique.push(person);
    });
    return unique;
  }, [matches]);

  const selectPerson = (person) => {
    onChange(person);
    setQuery('');
    setMatches([]);
  };

  const clearPerson = () => {
    onChange(null);
    setQuery('');
    setMatches([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const hasVisibleLabel = Boolean(String(label || '').trim());
  const groupLabelledBy = hasVisibleLabel ? labelId : (labelledBy || undefined);

  return (
    <div className="block" role="group" aria-labelledby={groupLabelledBy}>
      {hasVisibleLabel ? (
        <label id={labelId} htmlFor={inputId} className="block text-sm font-semibold text-gray-900">
          {label} {required ? <span className="text-rose-600">*</span> : null}
        </label>
      ) : null}
      <input
        id={`${inputId}-required`}
        value={selectedName}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      {selectedName && !query ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <PersonAvatar userId={value?.userId} name={selectedName} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900">{selectedName}</span>
              {showUpline && value?.uplineLabel ? (
                <span className="block truncate text-xs font-normal text-gray-600">
                  + {value.uplineLabel}
                </span>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            onClick={clearPerson}
            className="shrink-0 text-xs font-semibold text-green-700"
          >
            Change
          </button>
        </div>
      ) : (
        <div
          className={`mt-2 overflow-hidden rounded-2xl border bg-white ${
            error ? 'border-rose-400' : 'border-gray-200'
          }`}
        >
          <div className={`relative p-2 ${searchingNow ? 'border-b border-gray-100' : ''}`}>
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              id={inputId}
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                if (next.trim().length >= 2) setSearching(true);
              }}
              placeholder="Search people"
              className="w-full rounded-xl bg-gray-50 py-2.5 pl-9 pr-9 text-base font-normal text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            )}
          </div>
          {searchingNow ? (
            <>
              <p className="border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Matching people
              </p>
              {searching ? (
                <p className="flex items-center gap-2 px-3 py-3 text-xs font-normal text-gray-500">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                  Searching…
                </p>
              ) : options.length > 0 ? (
                <ul className="max-h-56 divide-y divide-gray-50 overflow-y-auto">
                  {options.map((person) => {
                    const on =
                      selectedName === person.name && Number(value?.userId) === person.userId;
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          onClick={() => selectPerson(person)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            on ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <PersonAvatar userId={person.userId} name={person.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">
                              {person.name}
                            </span>
                            {showUpline && person.uplineLabel ? (
                              <span className="block truncate text-xs font-normal text-gray-600">
                                + {person.uplineLabel}
                              </span>
                            ) : person.email ? (
                              <span className="block truncate text-xs font-normal text-gray-500">
                                {person.email}
                              </span>
                            ) : null}
                          </span>
                          {on ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white">
                              <Check className="h-3 w-3" />
                              Selected
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 rounded-full border border-green-200 bg-white px-2.5 py-1 text-[11px] font-bold text-green-700">
                              Select
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-3 py-3 text-xs font-normal text-gray-500">
                  No people match that name. Try another search.
                </p>
              )}
            </>
          ) : (
            <p className="px-3 pb-3 text-xs font-normal text-gray-500">{hint}</p>
          )}
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
