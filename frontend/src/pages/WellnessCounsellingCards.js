// src/pages/WellnessCounsellingCards.js
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Plus, RefreshCw, FileHeart, Edit2, Trash2 } from "lucide-react";
import {
  BodyParamsForm,
  BodyParamsShareSheet,
  BodyParamsSearchBar,
  preloadBodyParamsShareAssets,
  listBodyParamsCards,
  getBodyParamsCard,
  deleteBodyParamsCard,
  buildBpcSearchSuggestions,
} from "../features/body-parameters-card";
import { CapacitorHttp } from '@capacitor/core';
import { debugLog } from '../shared/utils/logger.js';
import { getAppVersionHeaders } from '../shared/services/apiFetch.js';
import CustomAlertModal from '../shared/components/CustomAlertModal';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

/** Skeleton placeholder matching the card grid tile. */
function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
      <div className="p-4">
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-2 h-12" />
          ))}
        </div>
        <div className="h-3 bg-gray-100 rounded w-full" />
      </div>
    </div>
  );
}

/** Memoized grid tile — avoids re-rendering unchanged cards on load-more. */
const BodyParamsCardTile = memo(function BodyParamsCardTile({
  card,
  onEdit,
  onDelete,
  isDeleting = false,
}) {
  return (
    <div
      onClick={() => onEdit(card)}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{card.name}</h3>
            {card.phoneNumber ? (
              <p className="text-sm text-gray-500 truncate">{card.phoneNumber}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={`Edit ${card.name || 'card'}`}
            >
              <Edit2 size={16} className="text-gray-400" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card);
              }}
              disabled={isDeleting}
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              aria-label={`Delete ${card.name || 'card'}`}
            >
              <Trash2 size={16} className={isDeleting ? 'text-red-300' : 'text-red-400'} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-blue-600 font-medium">Height</p>
            <p className="text-sm font-semibold text-blue-900">{card.heightCm} cm</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-green-600 font-medium">Weight</p>
            <p className="text-sm font-semibold text-green-900">{card.weightKg} kg</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <p className="text-xs text-purple-600 font-medium">BMI</p>
            <p className="text-sm font-semibold text-purple-900">{card.bmi}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-xs text-orange-600 font-medium">Age</p>
            <p className="text-sm font-semibold text-orange-900">{card.age} yrs</p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{card.gender || '—'}</span>
            <span>
              Date:{' '}
              {card.recordedDate ? format(new Date(card.recordedDate), 'd MMM yyyy') : 'N/A'}
            </span>
          </div>
          {card.locationName ? (
            <p className="text-xs text-gray-600 truncate">
              Venue: <span className="font-medium text-gray-800">{card.locationName}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
});

/**
 * Wellness Counselling - Body Parameters Cards View
 * Shows body parameter cards for team members in a tile/grid layout
 */
const WellnessCounsellingCards = ({ user, onBack, refreshKey = 0, onCardSaved = null }) => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [bodyParamsCards, setBodyParamsCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState(null);
  const [cardPendingDelete, setCardPendingDelete] = useState(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    currentPage: 0,
    hasNextPage: false,
  });

  const [isBodyParamsFormOpen, setIsBodyParamsFormOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [bodyParamsShareData, setBodyParamsShareData] = useState(null);
  const [bodyParamsPreCapCard, setBodyParamsPreCapCard] = useState(null);
  /** Editable page-level Venue — shown in header only, applied when saving a card. */
  const [headerVenue, setHeaderVenue] = useState('');
  const headerVenueInitializedRef = useRef(false);

  const coachIdRef = useRef(null);
  /** Cache: `${search}::${page}` → { cards, pagination } */
  const pageCacheRef = useRef(new Map());
  /** Accumulated cards for autocomplete (survives paginated / filtered list swaps). */
  const [suggestionPool, setSuggestionPool] = useState([]);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  /** Monotonic request id — only the latest request may write state. */
  const requestIdRef = useRef(0);
  /** Keys currently fetching — prevents duplicate load-more, not remount. */
  const inFlightPagesRef = useRef(new Set());

  useEffect(() => {
    if (!isBodyParamsFormOpen) return;
    preloadBodyParamsShareAssets();
  }, [isBodyParamsFormOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Grow autocomplete pool whenever cards load (page 1, load-more, or search hits).
  useEffect(() => {
    setSuggestionPool((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      let changed = false;
      for (const card of bodyParamsCards) {
        if (card?.id == null) continue;
        const next = {
          id: card.id,
          name: card.name,
          phoneNumber: card.phoneNumber,
        };
        const existing = map.get(card.id);
        if (
          existing
          && existing.name === next.name
          && existing.phoneNumber === next.phoneNumber
        ) {
          continue;
        }
        map.set(card.id, next);
        changed = true;
      }
      return changed ? Array.from(map.values()) : prev;
    });
  }, [bodyParamsCards]);

  const suggestions = useMemo(
    () => buildBpcSearchSuggestions(suggestionPool, searchQuery),
    [suggestionPool, searchQuery],
  );

  const handleSelectSuggestion = useCallback((suggestion) => {
    setSearchQuery(suggestion?.term || '');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
  }, []);

  const handleSearchKeyDown = useCallback((e) => {
    if (!searchQuery.trim()) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestions.length) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedSuggestion >= 0 && suggestions[highlightedSuggestion]) {
        handleSelectSuggestion(suggestions[highlightedSuggestion]);
      } else {
        setIsSearchOpen(false);
        setHighlightedSuggestion(-1);
      }
      return;
    }
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setHighlightedSuggestion(-1);
    }
  }, [searchQuery, suggestions, highlightedSuggestion, handleSelectSuggestion]);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setIsSearchOpen(true);
    setHighlightedSuggestion(-1);
  }, []);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const getUserId = useCallback(async (email) => {
    if (!email) throw new Error("User email is required");
    if (coachIdRef.current) return coachIdRef.current;

    const response = await CapacitorHttp.get({
      url: `${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`,
      headers: getAppVersionHeaders(),
    });
    const data = response.data;

    if (!data.success) throw new Error(data.message || "User not found");
    coachIdRef.current = data.userId;
    return data.userId;
  }, [apiBaseUrl]);

  const applyPageResult = useCallback((page, append, cards, meta) => {
    setPagination(meta);
    setBodyParamsCards((prev) => {
      if (!append) return cards;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...cards.filter((c) => !seen.has(c.id))];
    });
  }, []);

  const fetchPage = useCallback(async ({
    page,
    search,
    append,
    isBackground = false,
    bustCache = false,
  }) => {
    if (!user?.email) {
      setError("User information not available. Please log in again.");
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      return;
    }

    const key = `${search || ''}::${page}`;

    if (!bustCache && pageCacheRef.current.has(key)) {
      const cached = pageCacheRef.current.get(key);
      applyPageResult(page, append, cached.cards, cached.pagination);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      return;
    }

    // Block duplicate load-more for the same page only (never block a fresh page-1 remount)
    if (append && inFlightPagesRef.current.has(key)) return;

    const requestId = ++requestIdRef.current;
    inFlightPagesRef.current.add(key);

    if (append) setLoadingMore(true);
    else if (!isBackground) setLoading(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      if (requestId !== requestIdRef.current) return;

      const { cards, pagination: meta } = await listBodyParamsCards(userId, {
        page,
        limit: PAGE_SIZE,
        search,
      });

      if (requestId !== requestIdRef.current) return;

      pageCacheRef.current.set(key, { cards, pagination: meta });
      applyPageResult(page, append, cards, meta);
      debugLog('[WellnessCounselling] page loaded', {
        page,
        count: cards.length,
        total: meta.totalRecords,
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("[WellnessCounselling] Error fetching cards:", err);
      setError(err.message || "Failed to load body parameter cards.");
    } finally {
      inFlightPagesRef.current.delete(key);
      // Always clear loading for the latest request; stale requests leave loading alone
      // so the active request can finish the UI transition.
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [user?.email, getUserId, applyPageResult]);

  /** True after the first successful page-1 load for the current user/refreshKey. */
  const hasLoadedOnceRef = useRef(false);
  const prevListDriversRef = useRef({ user, refreshKey, debouncedSearch });

  // Load page 1 when user / search / refreshKey changes.
  // Search-only changes soft-update in the background so typing does not flash
  // the full-page Loading skeleton or unmount the search bar.
  useEffect(() => {
    const prev = prevListDriversRef.current;
    const hardReset = prev.user !== user || prev.refreshKey !== refreshKey;
    prevListDriversRef.current = { user, refreshKey, debouncedSearch };

    pageCacheRef.current.clear();
    inFlightPagesRef.current.clear();
    setError(null);

    if (hardReset) {
      hasLoadedOnceRef.current = false;
      setBodyParamsCards([]);
      setPagination({ totalRecords: 0, currentPage: 0, hasNextPage: false });
      setLoading(true);
    }

    const softSearch = hasLoadedOnceRef.current && !hardReset;

    let cancelled = false;
    const run = async () => {
      await fetchPage({
        page: 1,
        search: debouncedSearch,
        append: false,
        // Keep current cards + search UI visible while filtered results load.
        isBackground: softSearch,
      });
      if (cancelled) return;
      hasLoadedOnceRef.current = true;
    };
    run();

    return () => {
      cancelled = true;
      // Invalidate in-flight writers without blocking the next mount's fetch
      requestIdRef.current += 1;
    };
  }, [user, refreshKey, debouncedSearch, fetchPage]);

  // Clear suggestion pool when the coach or external refresh key changes.
  useEffect(() => {
    setSuggestionPool([]);
  }, [user, refreshKey]);

  const handleRefresh = () => {
    pageCacheRef.current.clear();
    inFlightPagesRef.current.clear();
    setSuggestionPool([]);
    setRefreshing(true);
    fetchPage({
      page: 1,
      search: debouncedSearch,
      append: false,
      isBackground: true,
      bustCache: true,
    });
  };

  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing) return;
    if (!pagination.hasNextPage) return;
    const nextPage = (pagination.currentPage || 1) + 1;
    fetchPage({ page: nextPage, search: debouncedSearch, append: true });
  }, [loading, loadingMore, refreshing, pagination, debouncedSearch, fetchPage]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: '200px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, bodyParamsCards.length]);

  const handleEditCard = async (card) => {
    try {
      const userId = await getUserId(user.email);
      const fresh = await getBodyParamsCard(userId, card.id);
      const merged = {
        ...card,
        ...fresh,
        phoneNumber: fresh.phoneNumber ?? card.phoneNumber ?? null,
        locationName: fresh.locationName ?? card.locationName ?? null,
      };
      // Sync header to THIS card's venue so header doesn't force an old value.
      headerVenueInitializedRef.current = true;
      setHeaderVenue(String(merged.locationName || '').trim());
      setSelectedCard(merged);
      setIsBodyParamsFormOpen(true);
    } catch {
      headerVenueInitializedRef.current = true;
      setHeaderVenue(String(card.locationName || '').trim());
      setSelectedCard(card);
      setIsBodyParamsFormOpen(true);
    }
  };

  const handleDeleteCard = useCallback((card) => {
    if (!card?.id || deletingCardId != null) return;
    setDeleteErrorMessage(null);
    setCardPendingDelete(card);
  }, [deletingCardId]);

  const confirmDeleteCard = useCallback(async () => {
    const card = cardPendingDelete;
    if (!card?.id || deletingCardId != null) return;

    setCardPendingDelete(null);
    setDeletingCardId(card.id);
    try {
      const coachId = await getUserId(user.email);
      await deleteBodyParamsCard({ id: card.id, coachId });
      pageCacheRef.current.clear();
      setBodyParamsCards((prev) => prev.filter((c) => c.id !== card.id));
      setSuggestionPool((prev) => prev.filter((c) => c.id !== card.id));
      setPagination((prev) => ({
        ...prev,
        totalRecords: Math.max(0, (prev.totalRecords || 1) - 1),
      }));
      debugLog('[WellnessCounselling] card deleted', { id: card.id });
    } catch (err) {
      console.error('[WellnessCounselling] Error deleting card:', err);
      setDeleteErrorMessage(err.message || 'Failed to delete card. Please try again.');
    } finally {
      setDeletingCardId(null);
    }
  }, [cardPendingDelete, deletingCardId, getUserId, user?.email]);

  if (loading && bodyParamsCards.length === 0 && !error) {
    return (
      <div className="h-screen bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 bg-white shadow-sm px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Body Composition Metrics</h1>
          <p className="text-xs text-gray-500">Loading...</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-900 min-w-0">Body Composition Metrics</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="mt-1 flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5 sm:gap-2">
            <label
              className="whitespace-nowrap text-[11px] text-gray-500 sm:text-xs"
              htmlFor="bpc-header-venue"
            >
              Body composition metrics checked at:
            </label>
            <input
              id="bpc-header-venue"
              type="text"
              value={headerVenue}
              onChange={(e) => {
                headerVenueInitializedRef.current = true;
                setHeaderVenue(e.target.value);
              }}
              className="h-7 w-20 min-w-[4.5rem] flex-shrink-0 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus:border-green-500 focus:ring-1 focus:ring-inset focus:ring-green-500 sm:w-28 md:w-36"
            />
            <p className="ml-auto flex-shrink-0 whitespace-nowrap text-[11px] text-gray-500 sm:text-xs">
              {pagination.totalRecords || bodyParamsCards.length} Cards
            </p>
          </div>
        </div>

        <div className="px-4 pb-3">
          <BodyParamsSearchBar
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
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <FileHeart className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Cards</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => fetchPage({ page: 1, search: debouncedSearch, append: false, bustCache: true })}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : bodyParamsCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileHeart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {debouncedSearch ? 'No matching cards' : 'No body parameters yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {debouncedSearch
                ? `No cards match "${debouncedSearch}"`
                : 'Create your first body parameters card using the + button below'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {bodyParamsCards.map((card) => (
                <BodyParamsCardTile
                  key={card.id}
                  card={card}
                  onEdit={handleEditCard}
                  onDelete={handleDeleteCard}
                  isDeleting={deletingCardId === card.id}
                />
              ))}
            </div>
            {loadingMore && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={`more-${i}`} />
                ))}
              </div>
            )}
            <div ref={sentinelRef} className="h-8 pb-20" aria-hidden="true" />
          </>
        )}
      </div>

      <button
        onClick={() => {
          setSelectedCard(null);
          setIsBodyParamsFormOpen(true);
        }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Create Body Parameters Card"
      >
        <Plus size={28} />
      </button>

      <BodyParamsForm
        isOpen={isBodyParamsFormOpen}
        onClose={() => {
          setIsBodyParamsFormOpen(false);
          setSelectedCard(null);
        }}
        user={user}
        selectedMember={null}
        existingCard={selectedCard}
        externalVenue={headerVenue}
        onVenueChange={(venue) => {
          headerVenueInitializedRef.current = true;
          setHeaderVenue(venue);
        }}
        onSaveStart={(formData) => {
          const venue = String(formData.locationName || '').trim();
          if (venue) {
            headerVenueInitializedRef.current = true;
            setHeaderVenue(venue);
          }
          setBodyParamsPreCapCard({
            ...formData,
            locationName: venue,
          });
        }}
        onSaveSuccess={(card, shareUrl, previousCard) => {
          setIsBodyParamsFormOpen(false);
          onCardSaved?.(card);
          const savedVenue = String(card?.locationName || '').trim();
          headerVenueInitializedRef.current = true;
          setHeaderVenue(savedVenue);

          pageCacheRef.current.clear();
          setBodyParamsCards((prevCards) => {
            const idx = prevCards.findIndex((c) => c.id === card.id);
            const merged = {
              ...(idx >= 0 ? prevCards[idx] : {}),
              ...card,
              phoneNumber: card.phoneNumber ?? (idx >= 0 ? prevCards[idx].phoneNumber : null),
              locationName: savedVenue || null,
            };
            if (idx >= 0) {
              const next = [...prevCards];
              next[idx] = merged;
              return next;
            }
            return [merged, ...prevCards];
          });

          setSelectedCard(null);
          setBodyParamsShareData({
            card: {
              ...card,
              locationName: savedVenue,
            },
            shareUrl,
            previousCard: previousCard || null,
          });
        }}
      />

      <BodyParamsShareSheet
        isOpen={!!bodyParamsShareData}
        onClose={() => {
          setBodyParamsShareData(null);
          setBodyParamsPreCapCard(null);
          pageCacheRef.current.clear();
          fetchPage({
            page: 1,
            search: debouncedSearch,
            append: false,
            isBackground: true,
            bustCache: true,
          });
        }}
        card={bodyParamsShareData?.card}
        shareUrl={bodyParamsShareData?.shareUrl}
        preCapCard={bodyParamsPreCapCard}
        previousCard={bodyParamsShareData?.previousCard ?? null}
      />

      <CustomAlertModal
        isOpen={!!cardPendingDelete}
        onClose={() => setCardPendingDelete(null)}
        title="Delete card?"
        message={`Delete ${String(cardPendingDelete?.name || 'this card').trim() || 'this card'}? This cannot be undone.`}
        type="warning"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteCard}
        onCancel={() => setCardPendingDelete(null)}
      />

      <CustomAlertModal
        isOpen={!!deleteErrorMessage}
        onClose={() => setDeleteErrorMessage(null)}
        title="Delete failed"
        message={deleteErrorMessage || ''}
        type="error"
        confirmText="OK"
      />
    </div>
  );
};

export default WellnessCounsellingCards;
