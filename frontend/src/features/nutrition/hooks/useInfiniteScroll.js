/**
 * useInfiniteScroll — paginates a list with IntersectionObserver-driven loading.
 *
 * Responsibilities:
 *  - keep a `displayedMeals` window over `analyses`
 *  - track `hasMoreMeals` + `loadingMore`
 *  - expose a `sentinelRef` to attach to a DOM sentinel element
 *  - auto-reset displayed window when `analyses` changes
 *
 * Extracted from NutritionDashboard.js. Pagination + observer behavior
 * preserved exactly (300ms artificial delay retained for UX consistency).
 */
import { useState, useEffect, useRef } from 'react';

export function useInfiniteScroll({ analyses, perPage = 10 }) {
  const [displayedMeals, setDisplayedMeals] = useState([]);
  const [hasMoreMeals, setHasMoreMeals] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Reset displayed window whenever the source list changes.
  useEffect(() => {
    const initialMeals = analyses.slice(0, perPage);
    setDisplayedMeals(initialMeals);
    setHasMoreMeals(analyses.length > perPage);
  }, [analyses, perPage]);

  // Observe sentinel and load next page when it scrolls into view.
  useEffect(() => {
    if (!sentinelRef.current || !hasMoreMeals || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMeals && !loadingMore) {
          setLoadingMore(true);

          setTimeout(() => {
            const currentLength = displayedMeals.length;
            const nextMeals = analyses.slice(0, currentLength + perPage);
            setDisplayedMeals(nextMeals);
            setHasMoreMeals(nextMeals.length < analyses.length);
            setLoadingMore(false);
          }, 300);
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);

    return () => {
      if (observer) observer.disconnect();
    };
  }, [displayedMeals, analyses, hasMoreMeals, loadingMore, perPage]);

  return { displayedMeals, hasMoreMeals, loadingMore, sentinelRef };
}
