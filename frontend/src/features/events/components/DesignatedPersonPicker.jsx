import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService.js';

function personKey(person) {
  return Number(person?.userId);
}

async function searchPeople(query, email) {
  const params = new URLSearchParams({ q: query });
  if (email) params.set('email', email);
  const res = await apiFetch(`${getApiBaseUrl()}/api/users/search?${params.toString()}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) return [];
  return (data.coaches || [])
    .map((person) => ({
      userId: Number(person.userId),
      name: String(person.userName || person.displayName || '').trim(),
    }))
    .filter((person) => Number.isInteger(person.userId) && person.userId > 0 && person.name);
}

export default function DesignatedPersonPicker({ userId, userEmail, selected, onChange }) {
  const [team, setTeam] = useState([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let live = true;
    if (!userId) return undefined;
    teamHierarchyService.getFlatTeamList(userId, { purpose: 'search' })
      .then((list) => {
        if (!live) return;
        const people = (list || [])
          .map((person) => ({
            userId: Number(person.userId),
            name: String(person.userName || '').trim(),
          }))
          .filter((person) => Number.isInteger(person.userId) && person.userId > 0 && person.name);
        setTeam(people);
      })
      .catch(() => {
        if (live) setTeam([]);
      });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setMatches([]);
      setSearching(false);
      return undefined;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(text, userEmail)
        .then((people) => {
          if (live) setMatches(people);
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
  }, [query, userEmail]);

  const selectedIds = useMemo(
    () => new Set((selected || []).map(personKey)),
    [selected],
  );

  const options = useMemo(() => {
    const text = query.trim().toLowerCase();
    const pool = text.length >= 2 ? [...team, ...matches] : team;
    const unique = [];
    const seen = new Set();
    pool.forEach((person) => {
      if (seen.has(person.userId)) return;
      if (text && !person.name.toLowerCase().includes(text)) return;
      seen.add(person.userId);
      unique.push(person);
    });
    return unique.slice(0, 8);
  }, [team, matches, query]);

  const toggle = (person) => {
    if (selectedIds.has(person.userId)) {
      onChange((selected || []).filter((item) => personKey(item) !== person.userId));
      return;
    }
    onChange([...(selected || []), { userId: person.userId, name: person.name }]);
  };

  return (
    <fieldset className="block text-sm font-medium text-gray-700">
      <legend>Designated persons</legend>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people"
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-normal outline-none focus:border-green-600"
      />
      {(selected || []).length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                onClick={() => toggle(person)}
                className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900"
              >
                {person.name} ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-normal text-gray-500">Select one or more people.</p>
      )}
      {searching ? <p className="mt-2 text-xs font-normal text-gray-500">Searching…</p> : null}
      {options.length > 0 ? (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-gray-100">
          {options.map((person) => {
            const on = selectedIds.has(person.userId);
            return (
              <li key={person.userId}>
                <button
                  type="button"
                  onClick={() => toggle(person)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${on ? 'bg-green-50 text-green-900' : 'text-gray-800'}`}
                >
                  <span>{person.name}</span>
                  <span className="text-xs font-semibold">{on ? 'Selected' : 'Add'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </fieldset>
  );
}
