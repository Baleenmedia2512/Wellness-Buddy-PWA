/**
 * CoachTestimonialsPage.jsx
 * Coach's read-only view of all direct-downline testimonials.
 * - Members with no testimonial are highlighted in red.
 * - Members with a pending testimonial show an amber badge + reminder to share the OTP.
 * - Members with a verified testimonial show a green badge + before/after photos.
 * OTP is entered by the MEMBER (not coach) after the coach shares it via WhatsApp/phone.
 */
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Users } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { listForCoach, getMyTestimonial } from '../services/testimonialApi.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
import {
  STATUS_FILTERS,
  TEAM_SCOPES,
  filterRowsByStatus,
  countRowsByStatus,
  toggleStatusFilter,
} from '../utils/testimonialFilters.js';
import {
  buildSearchSuggestions,
  filterRowsBySearch,
  normalizeSearchQuery,
} from '../utils/testimonialSearch.js';
import { PORTRAIT_IMAGE_CLASS_SM } from '../services/testimonialFormUtils.js';

const STATUS_CHIP_STYLES = {
  [STATUS_FILTERS.VERIFIED]: {
    base: 'bg-green-100 text-green-800',
    active: 'bg-green-600 text-white shadow-sm ring-2 ring-green-300',
  },
  [STATUS_FILTERS.PENDING]: {
    base: 'bg-amber-100 text-amber-800',
    active: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300',
  },
  [STATUS_FILTERS.MISSING]: {
    base: 'bg-red-100 text-red-800',
    active: 'bg-red-600 text-white shadow-sm ring-2 ring-red-300',
  },
};

const TEAM_SCOPE_OPTIONS = [
  { value: TEAM_SCOPES.MINE, label: 'Mine', short: 'Mine' },
  { value: TEAM_SCOPES.DIRECT, label: 'Direct Team', short: 'Direct' },
  { value: TEAM_SCOPES.FULL, label: 'Full Team', short: 'Full' },
];

function StatusFilterChip({ filterKey, label, count, activeFilter, onToggle }) {
  const isActive = activeFilter === filterKey;
  const styles = STATUS_CHIP_STYLES[filterKey];

  return (
    <button
      type="button"
      onClick={() => onToggle(filterKey)}
      aria-pressed={isActive}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer ${
        isActive ? styles.active : styles.base
      }`}
    >
      {label}: {count}
    </button>
  );
}

function MemberRow({ user, testimonial }) {
  const missing  = !testimonial;
  const pending  = testimonial?.status === 'pending';
  const verified = testimonial?.status === 'verified';

  const diff = testimonial
    ? Math.abs(testimonial.afterWeightKg - testimonial.beforeWeightKg).toFixed(1)
    : null;
  const arrow     = testimonial?.goalType === 'loss' ? '↓' : '↑';
  const goalLabel = testimonial?.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';

  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${
        missing
          ? 'border-red-300 bg-red-50'
          : pending
            ? 'border-amber-300 bg-amber-50'
            : 'border-green-300 bg-white'
      }`}
    >
      {/* Member header */}
      <div className="flex items-center gap-3">
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.userName}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
            loading="lazy"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm">
            {(user.userName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user.userName}</p>
          <div className="mt-0.5">
            {missing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                <AlertCircle className="h-3 w-3" /> Not Uploaded
              </span>
            )}
            {pending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                <Clock className="h-3 w-3" /> Pending Verification
              </span>
            )}
            {verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Testimonial details */}
      {testimonial && (
        <>
          {/* Photos */}
          {(testimonial.beforeImageUrl || testimonial.afterImageUrl) && (
            <div className="flex gap-2">
              {testimonial.beforeImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.beforeImageUrl}
                    alt="Before"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">BEFORE</p>
                </div>
              )}
              {testimonial.afterImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.afterImageUrl}
                    alt="After"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">AFTER</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              Before: {testimonial.beforeWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              After: {testimonial.afterWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-green-700 font-semibold">
              {arrow} {diff} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              {goalLabel}
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              ⏱ {testimonial.durationText}
            </span>
          </div>

          {pending && (
            <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center">
              📧 OTP sent to your email — share it with {user.userName} to verify
            </p>
          )}

          {verified && testimonial.verifiedAt && (
            <p className="text-xs text-green-600 font-medium">
              ✅ Verified {new Date(testimonial.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function CoachTestimonialsPage({ user }) {
  const [directRows, setDirectRows] = useState([]);
  const [fullRows, setFullRows] = useState([]);
  const [mineRow, setMineRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

  const coachId = user?.userId || user?.id;

  const buildMineRow = useCallback(async () => {
    if (!coachId) return null;
    try {
      const testimonial = await getMyTestimonial(coachId);
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber: user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: testimonial || null,
      };
    } catch {
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber: user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: null,
      };
    }
  }, [coachId, user]);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const requests = [
        listForCoach(coachId, TEAM_SCOPES.DIRECT),
        buildMineRow(),
      ];
      if (teamScope === TEAM_SCOPES.FULL) {
        requests.push(listForCoach(coachId, TEAM_SCOPES.FULL));
      }
      const results = await Promise.all(requests);
      setDirectRows(results[0] || []);
      setMineRow(results[1]);
      if (teamScope === TEAM_SCOPES.FULL) {
        setFullRows(results[2] || []);
      } else {
        setFullRows([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [coachId, buildMineRow, teamScope]);

  const loadFullTeam = useCallback(async () => {
    if (!coachId || fullRows.length > 0) return;
    setFullLoading(true);
    try {
      const data = await listForCoach(coachId, TEAM_SCOPES.FULL);
      setFullRows(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load full team testimonials');
    } finally {
      setFullLoading(false);
    }
  }, [coachId, fullRows.length]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (teamScope === TEAM_SCOPES.FULL) {
      loadFullTeam();
    }
  }, [teamScope, loadFullTeam]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
  }, [teamScope]);

  const scopeRows = useMemo(() => {
    if (teamScope === TEAM_SCOPES.MINE) {
      return mineRow ? [mineRow] : [];
    }
    if (teamScope === TEAM_SCOPES.FULL) {
      return fullRows;
    }
    return directRows;
  }, [teamScope, mineRow, directRows, fullRows]);

  const statusCounts = useMemo(() => countRowsByStatus(scopeRows), [scopeRows]);

  const statusFilteredRows = useMemo(
    () => filterRowsByStatus(scopeRows, statusFilter),
    [scopeRows, statusFilter],
  );

  const suggestions = useMemo(
    () => buildSearchSuggestions(statusFilteredRows, searchQuery),
    [statusFilteredRows, searchQuery],
  );

  const filteredRows = useMemo(
    () => filterRowsBySearch(statusFilteredRows, searchQuery),
    [statusFilteredRows, searchQuery],
  );

  const handleStatusToggle = useCallback((next) => {
    setStatusFilter((current) => toggleStatusFilter(current, next));
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setIsSearchOpen(true);
    setHighlightedSuggestion(-1);
  }, []);

  const handleSelectSuggestion = useCallback((row) => {
    setSearchQuery(row.user?.userName || '');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
  }, []);

  const handleSearchKeyDown = useCallback((event) => {
    const hasQuery = normalizeSearchQuery(searchQuery).length > 0;
    if (!hasQuery) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (
        prev < suggestions.length - 1 ? prev + 1 : 0
      ));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (
        prev > 0 ? prev - 1 : suggestions.length - 1
      ));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedSuggestion >= 0 && suggestions[highlightedSuggestion]) {
        handleSelectSuggestion(suggestions[highlightedSuggestion]);
      } else {
        setIsSearchOpen(false);
        setHighlightedSuggestion(-1);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setHighlightedSuggestion(-1);
    }
  }, [searchQuery, suggestions, highlightedSuggestion, handleSelectSuggestion]);

  const showScopeLoading = loading || (teamScope === TEAM_SCOPES.FULL && fullLoading && fullRows.length === 0);
  const hasScopeData = scopeRows.length > 0;
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-700" />
          <h1 className="text-lg font-bold text-gray-900">Team Testimonials</h1>
        </div>
        <TouchFeedbackButton
          onClick={load}
          disabled={loading}
          className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
          ariaLabel="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </TouchFeedbackButton>
      </div>

      {/* Team scope filter */}
      {!loading && (
        <div
          className="bg-white rounded-xl border border-gray-200 px-1 py-1 flex gap-1"
          role="group"
          aria-label="Team scope filter"
        >
          {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
            const isActive = teamScope === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTeamScope(value)}
                aria-pressed={isActive}
                className={`flex-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer min-w-0 px-1 ${
                  isActive
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-800 hover:bg-green-50'
                }`}
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Smart search */}
      {!loading && hasScopeData && (
        <TestimonialSearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          suggestions={suggestions}
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          highlightedIndex={highlightedSuggestion}
          onHighlightChange={setHighlightedSuggestion}
          onSelectSuggestion={handleSelectSuggestion}
          onKeyDown={handleSearchKeyDown}
        />
      )}

      {/* Summary chips — clickable status filters */}
      {!loading && hasScopeData && (
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Status filter">
          <StatusFilterChip
            filterKey={STATUS_FILTERS.VERIFIED}
            label="✅ Verified"
            count={statusCounts.verified}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
          <StatusFilterChip
            filterKey={STATUS_FILTERS.PENDING}
            label="🕐 Pending"
            count={statusCounts.pending}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
          <StatusFilterChip
            filterKey={STATUS_FILTERS.MISSING}
            label="⚠️ Not Uploaded"
            count={statusCounts.missing}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
        </div>
      )}

      {showScopeLoading && <LoadingSpinner message="Loading team testimonials…" />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!showScopeLoading && !error && !hasScopeData && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team members found</p>
        </div>
      )}

      {!showScopeLoading && !error && hasScopeData && filteredRows.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="font-medium text-sm">
            {hasActiveSearch ? 'No matching users found.' : 'No records match the selected filters.'}
          </p>
        </div>
      )}

      {!showScopeLoading && filteredRows.map(({ user: member, testimonial }) => (
        <MemberRow
          key={member.userId}
          user={member}
          testimonial={testimonial}
        />
      ))}
    </div>
  );
}
