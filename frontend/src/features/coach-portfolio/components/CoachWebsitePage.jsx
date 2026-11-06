import React, { useEffect, useState } from 'react';
import { ArrowLeft, Globe2, ExternalLink } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { fetchMyPortfolioSubmission } from '../services/portfolioApi';
import CoachPortfolioForm from './CoachPortfolioForm';

/**
 * Coach website panel — self-serve edit + publish (no admin gate).
 */
export default function CoachWebsitePage({
  paid = true,
  selfServe = false,
  loading = false,
  userId,
  onClose,
  onRefresh,
}) {
  const unlocked = selfServe || paid;
  const [showForm, setShowForm] = useState(Boolean(selfServe && unlocked && userId != null));
  const [publicPath, setPublicPath] = useState(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userId == null) return;
      try {
        const data = await fetchMyPortfolioSubmission(userId);
        if (cancelled) return;
        setPublicPath(data?.publicPath || null);
        setIsPublished(data?.isPublished === true);
      } catch {
        if (!cancelled) {
          setPublicPath(null);
          setIsPublished(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId, showForm]);

  if (showForm && unlocked && userId != null) {
    return (
      <CoachPortfolioForm
        userId={userId}
        onClose={() => {
          if (selfServe) {
            onClose?.();
            return;
          }
          setShowForm(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f7f5]">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <TouchFeedbackButton
            onClick={onClose}
            ariaLabel="Go back"
            className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-gray-900">Website</h1>
            <p className="text-xs text-gray-500">Your public coach page</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <Globe2 className="h-6 w-6 text-emerald-700" aria-hidden />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Manage your website</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Edit content and photos anytime. Submit once to publish — no admin approval needed.
              </p>
              {isPublished && publicPath ? (
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-800"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Open live page · {publicPath}</span>
                </a>
              ) : null}
              <TouchFeedbackButton
                onClick={() => setShowForm(true)}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                ariaLabel="Open website panel"
              >
                {isPublished ? 'Edit website' : 'Set up website'}
              </TouchFeedbackButton>
            </>
          )}

          {typeof onRefresh === 'function' ? (
            <TouchFeedbackButton
              onClick={onRefresh}
              className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              ariaLabel="Refresh"
            >
              Refresh
            </TouchFeedbackButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
