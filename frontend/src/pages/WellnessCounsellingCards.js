// src/pages/WellnessCounsellingCards.js
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Search, Plus, RefreshCw, FileHeart, Edit2 } from "lucide-react";
import {
  BodyParamsForm,
  BodyParamsShareSheet,
  preloadBodyParamsShareAssets,
  listBodyParamsCards,
  getBodyParamsCard,
} from "../features/body-parameters-card";
import { CapacitorHttp } from '@capacitor/core';
import { debugLog } from '../shared/utils/logger.js';
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
const BodyParamsCardTile = memo(function BodyParamsCardTile({ card, onEdit }) {
  return (
    <div
      onClick={() => onEdit(card)}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{card.name}</h3>
            <p className="text-sm text-gray-500">{card.phoneNumber}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit2 size={16} className="text-gray-400" />
          </button>
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

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>{card.gender}</span>
          <span>{card.recordedDate ? format(new Date(card.recordedDate), 'MMM d, yyyy') : 'N/A'}</span>
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
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    currentPage: 0,
    hasNextPage: false,
  });

  const [isBodyParamsFormOpen, setIsBodyParamsFormOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [bodyParamsShareData, setBodyParamsShareData] = useState(null);
  const [bodyParamsPreCapCard, setBodyParamsPreCapCard] = useState(null);

  const coachIdRef = useRef(null);
  /** Cache: `${search}::${page}` → { cards, pagination } */
  const pageCacheRef = useRef(new Map());
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

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const getUserId = useCallback(async (email) => {
    if (!email) throw new Error("User email is required");
    if (coachIdRef.current) return coachIdRef.current;

    const response = await CapacitorHttp.get({
      url: `${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`
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
    else setRefreshing(true);
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

  // Reset + load page 1 when user / search / refreshKey changes
  useEffect(() => {
    pageCacheRef.current.clear();
    inFlightPagesRef.current.clear();
    setBodyParamsCards([]);
    setPagination({ totalRecords: 0, currentPage: 0, hasNextPage: false });
    setLoading(true);
    setError(null);

    let cancelled = false;
    const run = async () => {
      await fetchPage({ page: 1, search: debouncedSearch, append: false });
      if (cancelled) return;
    };
    run();

    return () => {
      cancelled = true;
      // Invalidate in-flight writers without blocking the next mount's fetch
      requestIdRef.current += 1;
    };
  }, [user, refreshKey, debouncedSearch, fetchPage]);

  const handleRefresh = () => {
    pageCacheRef.current.clear();
    inFlightPagesRef.current.clear();
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
        ...fresh,
        phoneNumber: fresh.phoneNumber ?? card.phoneNumber ?? null,
      };
      setSelectedCard(merged);
      setIsBodyParamsFormOpen(true);
    } catch {
      setSelectedCard(card);
      setIsBodyParamsFormOpen(true);
    }
  };

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
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Body Composition Metrics</h1>
              <p className="text-xs text-gray-500">{pagination.totalRecords || bodyParamsCards.length} Cards</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
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
                <BodyParamsCardTile key={card.id} card={card} onEdit={handleEditCard} />
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
        onSaveStart={(formData) => {
          setBodyParamsPreCapCard(formData);
        }}
        onSaveSuccess={(card, shareUrl, previousCard) => {
          setIsBodyParamsFormOpen(false);
          onCardSaved?.(card);

          pageCacheRef.current.clear();
          setBodyParamsCards((prevCards) => {
            const idx = prevCards.findIndex((c) => c.id === card.id);
            const merged = {
              ...(idx >= 0 ? prevCards[idx] : {}),
              ...card,
              phoneNumber: card.phoneNumber ?? (idx >= 0 ? prevCards[idx].phoneNumber : null),
            };
            if (idx >= 0) {
              const next = [...prevCards];
              next[idx] = merged;
              return next;
            }
            return [merged, ...prevCards];
          });

          setSelectedCard(null);
          setBodyParamsShareData({ card, shareUrl, previousCard: previousCard || null });
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
    </div>
  );
};

export default WellnessCounsellingCards;
