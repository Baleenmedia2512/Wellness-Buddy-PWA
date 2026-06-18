/**
 * useMarathon.js — Server-state hook for Marathon Recognition Engine.
 *
 * Manages:
 *   - Marathon list for a coach
 *   - Card data fetch + share workflow
 */
import { useState, useCallback } from 'react';
import { listMarathons, getCardData } from '../services/marathon.api.js';
import { buildShareUrl }              from '../domain/marathon.display.js';

const SHARE_BASE_URL = process.env.REACT_APP_PUBLIC_URL || 'https://app.wellnessvalley.com';

export function useMarathon({ coachId } = {}) {
  const [marathons,    setMarathons]    = useState([]);
  const [loadingList,  setLoadingList]  = useState(false);
  const [listError,    setListError]    = useState(null);

  const [cardData,     setCardData]     = useState(null);
  const [shareUrl,     setShareUrl]     = useState(null);
  const [loadingCard,  setLoadingCard]  = useState(false);
  const [cardError,    setCardError]    = useState(null);
  const [shareOpen,    setShareOpen]    = useState(false);

  // ── Load marathon list ─────────────────────────────────────────────────────
  const fetchMarathons = useCallback(async (status = null) => {
    if (!coachId) return;
    setLoadingList(true);
    setListError(null);
    try {
      const res = await listMarathons({ coachId, status });
      setMarathons(res.data || []);
    } catch (err) {
      setListError(err.message || 'Failed to load marathons');
    } finally {
      setLoadingList(false);
    }
  }, [coachId]);

  // ── Generate a card + open share sheet ────────────────────────────────────
  const generateCard = useCallback(async ({ marathonId, cardType }) => {
    if (!coachId || !marathonId || !cardType) return;
    setLoadingCard(true);
    setCardError(null);
    setCardData(null);
    setShareUrl(null);
    setShareOpen(false);

    try {
      const res   = await getCardData({ marathonId, cardType, coachId });
      const data  = res.data;
      const url   = buildShareUrl(SHARE_BASE_URL, data.shareToken);

      setCardData(data);
      setShareUrl(url);
      setShareOpen(true);
    } catch (err) {
      setCardError(err.message || 'Failed to generate card');
    } finally {
      setLoadingCard(false);
    }
  }, [coachId]);

  const closeShare = useCallback(() => {
    setShareOpen(false);
  }, []);

  return {
    // list
    marathons,
    loadingList,
    listError,
    fetchMarathons,
    // card generation
    cardData,
    shareUrl,
    loadingCard,
    cardError,
    shareOpen,
    generateCard,
    closeShare,
  };
}
