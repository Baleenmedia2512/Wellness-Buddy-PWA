/**
 * useMarathon.js — Server-state hook for Marathon Recognition Engine.
 *
 * v2 additions: myLaps, leaderboard, pendingRecognition
 */
import { useState, useCallback } from 'react';
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
      setPendingRecognition(withLeaders);
    } catch {
      // Non-fatal — splash is best-effort
    } finally {
      setLoadingRecognition(false);
    }
  }, [userId]);

  const dismissRecognition = useCallback(async (viewedList) => {
    if (!userId || !viewedList?.length) {
      setPendingRecognition([]);
      return;
    }
    // Mark as viewed in DB FIRST — before clearing state.
    // This ensures the API call completes even if the user closes the app
    // immediately after tapping Continue or Skip.
    const results = await Promise.allSettled(
      viewedList.map(v => apiMarkViewed({ userId, marathonId: v.marathonId, resultDate: v.resultDate })),
    );
    // Log any failures so they are visible in Supabase / console
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error('[Marathon] markRecognitionViewed failed', {
          marathonId:  viewedList[i]?.marathonId,
          resultDate:  viewedList[i]?.resultDate,
          error:       r.reason?.message || r.reason,
        });
      }
    });
    // Clear splash state AFTER the DB writes have settled
    setPendingRecognition([]);
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
