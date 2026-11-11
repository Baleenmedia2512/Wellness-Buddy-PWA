import React, { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { isFlagEnabled } from '../../../config/featureFlags';
import { fetchHasTeamMembers } from '../../team/services/teamSearchService';
import { PORTFOLIO_FLAG } from '../domain/portfolio.rules';
import usePortfolioAccess from '../hooks/usePortfolioAccess';
import CoachWebsitePage from './CoachWebsitePage';

/**
 * Profile row for anyone with a CoachId downline — opens Coach Website gate.
 * Visibility is based on team members, not Role === coach.
 */
export default function CoachWebsiteButton({ userId }) {
  const [open, setOpen] = useState(false);
  const [hasDownline, setHasDownline] = useState(false);
  const [ready, setReady] = useState(false);
  const access = usePortfolioAccess(open ? userId : null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isFlagEnabled(PORTFOLIO_FLAG) || userId == null || String(userId).trim() === '') {
        if (!cancelled) {
          setHasDownline(false);
          setReady(true);
        }
        return;
      }
      try {
        const yes = await fetchHasTeamMembers(userId);
        if (!cancelled) setHasDownline(Boolean(yes));
      } catch {
        if (!cancelled) setHasDownline(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!isFlagEnabled(PORTFOLIO_FLAG)) return null;
  if (!ready || !hasDownline) return null;

  const onOpen = () => {
    if (userId == null || String(userId).trim() === '') return;
    setOpen(true);
  };

  return (
    <div>
      <TouchFeedbackButton
        onClick={onOpen}
        ariaLabel="Coach Website"
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
      >
        <div className="p-2 rounded-full bg-emerald-50">
          <Globe2 className="w-4 h-4 text-emerald-700" aria-hidden />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900">Coach Website</p>
          <p className="text-xs text-gray-400">
            Edit and publish from Paid Features
          </p>
        </div>
      </TouchFeedbackButton>
      {open ? (
        <CoachWebsitePage
          selfServe
          paid
          loading={access.loading}
          userId={userId}
          onClose={() => setOpen(false)}
          onRefresh={access.refresh}
        />
      ) : null}
    </div>
  );
}
