/**
 * useMarathon.js — Server-state hook for Marathon Recognition Engine.
 *
 * v2 additions: myLaps, leaderboard, pendingRecognition
 */
import { useState, useRef, useCallback } from 'react';
import {
  listMarathons,
  getCardData,
  getMyLaps,
  getLeaderboard,
  getPendingRecognition,
  markRecognitionViewed as apiMarkViewed,
}                               from '../services/marathon.api.js';
import { buildShareUrl }        from '../domain/marathon.display.js';

const SHARE_BASE_URL = process.env.REACT_APP_PUBLIC_URL || 'https://app.wellnessvalley.com';

export function useMarathon({ coachId, userId } = {}) {
  // ── Coach: marathon list ───────────────────────────────────────────────────
  const [marathons,    setMarathons]    = useState([]);
  const [loadingList,  setLoadingList]  = useState(false);
  const [listError,    setListError]    = useState(null);

  // ── Coach: card generation ─────────────────────────────────────────────────
  const [cardData,     setCardData]     = useState(null);
  const [shareUrl,     setShareUrl]     = useState(null);
  const [loadingCard,  setLoadingCard]  = useState(false);
  const [cardError,    setCardError]    = useState(null);
  const [shareOpen,    setShareOpen]    = useState(false);

  // ── Member: my laps ────────────────────────────────────────────────────────
  const [myLaps,       setMyLaps]       = useState([]);
  const [loadingLaps,  setLoadingLaps]  = useState(false);
  const [lapsError,    setLapsError]    = useState(null);

  // ── Leaderboard ────────────────────────────────────────────────────────────
  const [leaderboard,     setLeaderboard]     = useState([]);
  const [leaderboardType, setLeaderboardType] = useState('day');
  const [loadingBoard,    setLoadingBoard]    = useState(false);
  const [boardError,      setBoardError]      = useState(null);

  // ── Recognition splashes ───────────────────────────────────────────────────
  const [pendingRecognition, setPendingRecognition] = useState([]);
  const [loadingRecognition, setLoadingRecognition] = useState(false);
  // In-memory cache of just-dismissed keys ("marathonId_resultDate").
  // Prevents a concurrent fetchPendingRecognition (triggered by app-resume)
  // from re-showing a recognition that the user already tapped "continue" on
  // but whose markRecognitionViewed DB write hasn't landed yet.
  const dismissedCacheRef = useRef(new Set());

  // ─────────────────────────────────────────────────────────────────────────
  const fetchMarathons = useCallback(async (status = null) => {
    if (!coachId) return;
    setLoadingList(true); setListError(null);
    try {
      // Append _t to bust any browser-level GET cache
      const res = await listMarathons({ coachId, status, _t: Date.now() });
      setMarathons(res.data || []);
    } catch (err) {
      setListError(err.message || 'Failed to load marathons');
    } finally {
      setLoadingList(false);
    }
  }, [coachId]);

  // Optimistic remove — immediately removes the lap from local state.
  // Uses Number() coercion so string/int ID mismatches don't silently fail.
  const removeMarathon = useCallback((id) => {
    setMarathons(prev => prev.filter(m => Number(m.id) !== Number(id)));
  }, []);

  const generateCard = useCallback(async ({ marathonId, cardType }) => {
    if (!coachId || !marathonId || !cardType) return;
    setLoadingCard(true); setCardError(null); setCardData(null); setShareUrl(null); setShareOpen(false);
    try {
      const res  = await getCardData({ marathonId, cardType, coachId });
      const data = res.data;
      const url  = buildShareUrl(SHARE_BASE_URL, data.shareToken);
      setCardData(data); setShareUrl(url); setShareOpen(true);
    } catch (err) {
      setCardError(err.message || 'Failed to generate card');
    } finally {
      setLoadingCard(false);
    }
  }, [coachId]);

  const closeShare = useCallback(() => setShareOpen(false), []);

  // ─────────────────────────────────────────────────────────────────────────
  const fetchMyLaps = useCallback(async () => {
    if (!userId) return;
    setLoadingLaps(true); setLapsError(null);
    try {
      const res = await getMyLaps(userId);
      setMyLaps(res.data || []);
    } catch (err) {
      setLapsError(err.message || 'Failed to load LAPs');
    } finally {
      setLoadingLaps(false);
    }
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async ({ marathonId, type = 'day', topN = 10 } = {}) => {
    if (!marathonId) return;
    setLoadingBoard(true); setBoardError(null); setLeaderboardType(type);
    try {
      const res = await getLeaderboard({ marathonId, type, topN });
      setLeaderboard(res.data?.entries || []);
    } catch (err) {
      setBoardError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  const fetchPendingRecognition = useCallback(async () => {
    if (!userId) return;
    setLoadingRecognition(true);
    try {
      const res = await getPendingRecognition(userId);
      // Only surface recognitions that have at least one winner — if all leaders
      // are null (results not yet computed / no one qualified) there is nothing
      // to show and we must not mark them as viewed.
      const withLeaders = (res.data || []).filter(
        r => r.dayLeader || r.lapLeader || r.communityLeader,
      );
      // Filter out any recognition the user already dismissed this session.
      // Protects against the race where app-resume re-fetches before the
      // markRecognitionViewed DB write has completed.
      const filtered = withLeaders.filter(
        r => !dismissedCacheRef.current.has(`${r.marathonId}_${r.resultDate}`),
      );
      setPendingRecognition(filtered);
    } catch {
      // Non-fatal — splash is best-effort
    } finally {
      setLoadingRecognition(false);
    }
  }, [userId]);

  const dismissRecognition = useCallback(async (viewedList) => {
    // 1. Clear the splash immediately (optimistic) so it disappears on tap.
    setPendingRecognition([]);

    if (!userId || !viewedList?.length) return;

    // 2. Add to in-memory cache so any concurrent fetchPendingRecognition
    //    (e.g. triggered by app-resume) cannot re-show these recognitions
    //    before the DB writes have landed.
    viewedList.forEach(v =>
      dismissedCacheRef.current.add(`${v.marathonId}_${v.resultDate}`)
    );

    // 3. Persist to DB.
    const results = await Promise.allSettled(
      viewedList.map(v => apiMarkViewed({ userId, marathonId: v.marathonId, resultDate: v.resultDate })),
    );

    results.forEach((r, i) => {
      // Always remove from the in-memory cache once the API has settled.
      // On success: the DB row is now the source of truth — the cache must not
      // keep blocking future fetches (e.g. after a user deletes the DB row in
      // testing, or on a new day when a fresh result_date is generated).
      // On failure: allow the splash to re-appear so the user can retry.
      dismissedCacheRef.current.delete(
        `${viewedList[i]?.marathonId}_${viewedList[i]?.resultDate}`
      );
      if (r.status === 'rejected') {
        console.error('[Marathon] markRecognitionViewed failed', {
          marathonId:  viewedList[i]?.marathonId,
          resultDate:  viewedList[i]?.resultDate,
          error:       r.reason?.message || r.reason,
        });
      }
    });
  }, [userId]);

  return {
    // Coach
    marathons, loadingList, listError, fetchMarathons, removeMarathon,
    cardData, shareUrl, loadingCard, cardError, shareOpen, generateCard, closeShare,
    // Member
    myLaps, loadingLaps, lapsError, fetchMyLaps,
    // Leaderboard
    leaderboard, leaderboardType, loadingBoard, boardError, fetchLeaderboard,
    // Recognition
    pendingRecognition, loadingRecognition, fetchPendingRecognition, dismissRecognition,
  };
}
