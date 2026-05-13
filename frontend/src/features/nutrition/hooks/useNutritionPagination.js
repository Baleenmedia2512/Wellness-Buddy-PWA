// useNutritionPagination — owns the displayed-meals window + IntersectionObserver
// driven infinite scroll. Extracted from the dashboard so the component stays UI-only.
import { useState, useEffect, useRef } from 'react';

const MEALS_PER_PAGE = 10;

export function useNutritionPagination(analyses) {
  const [displayedMeals, setDisplayedMeals] = useState([]);
  const [hasMoreMeals, setHasMoreMeals]     = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const sentinelRef = useRef(null);

  // Reset window when the underlying meal list changes.
  useEffect(() => {
    const initial = analyses.slice(0, MEALS_PER_PAGE);
    setDisplayedMeals(initial);
    setHasMoreMeals(analyses.length > MEALS_PER_PAGE);
  }, [analyses]);

  // Watch the sentinel and append the next page when it intersects.
  useEffect(() => {
    if (!sentinelRef.current || !hasMoreMeals || loadingMore) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreMeals && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => {
          const currentLength = displayedMeals.length;
          const next = analyses.slice(0, currentLength + MEALS_PER_PAGE);
          setDisplayedMeals(next);
          setHasMoreMeals(next.length < analyses.length);
          setLoadingMore(false);
        }, 300);
      }
    }, { root: null, rootMargin: '100px', threshold: 0.1 });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [displayedMeals, analyses, hasMoreMeals, loadingMore]);

  return { displayedMeals, hasMoreMeals, loadingMore, sentinelRef, MEALS_PER_PAGE };
}
