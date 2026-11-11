import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Globe2, ExternalLink, MapPin, Plus } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { fetchMyWebsites } from '../services/portfolioApi';
import { publicWebsiteUrl } from '../domain/publicWebsiteUrl';
import CoachPortfolioForm from './CoachPortfolioForm';

/**
 * My Websites hub — Create New opens a fresh form; existing rows open edit.
 */
export default function CoachWebsitePage({
  userId,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [websites, setWebsites] = useState([]);
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [activeCenterId, setActiveCenterId] = useState(null);
  const [activeCenterName, setActiveCenterName] = useState('');

  const load = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchMyWebsites(userId);
      setWebsites(Array.isArray(data?.websites) ? data.websites : []);
    } catch (err) {
      setWebsites([]);
      setMessage(err?.message || 'Could not load websites');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setCreateMode(false);
    setActiveCenterId(null);
    setActiveCenterName('');
    load();
  };

  if (formOpen && userId != null) {
    return (
      <CoachPortfolioForm
        userId={userId}
        centerId={createMode ? null : activeCenterId}
        centerName={createMode ? '' : activeCenterName}
        createMode={createMode}
        availableCenters={websites}
        onClose={closeForm}
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
            <h1 className="text-base font-bold text-gray-900">My Websites</h1>
            <p className="text-xs text-gray-500">One website per center you own</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
            <Globe2 className="h-5 w-5 text-emerald-700" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Create &amp; publish</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Create New opens a blank form. Pick City and Center from the dropdowns, then publish with coach OTP.
          </p>
          <TouchFeedbackButton
            type="button"
            onClick={() => {
              setMessage('');
              setCreateMode(true);
              setActiveCenterId(null);
              setActiveCenterName('');
              setFormOpen(true);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
            ariaLabel="Create new website"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create new
          </TouchFeedbackButton>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : null}

        {!loading && websites.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Register a nutrition center first. Then tap Create new.
          </div>
        ) : null}

        {!loading
          ? websites.filter((row) => row.hasWebsite).map((row) => (
            <div
              key={row.centerId != null ? `c-${row.centerId}` : `s-${row.submissionId || row.publicPath}`}
              className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <MapPin className="h-5 w-5 text-emerald-700" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {row.centerName || 'Saved website'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[row.city, row.locality].filter(Boolean).join(' · ')
                      || (row.legacy ? 'Previously saved form' : 'Place from center GPS')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {row.isPublished
                      ? `Live · ${row.publicPath}`
                      : 'Draft saved — publish when ready'}
                  </p>
                  {row.isPublished && row.publicPath ? (
                    <a
                      href={publicWebsiteUrl(row.publicPath)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open live page
                    </a>
                  ) : null}
                  <TouchFeedbackButton
                    onClick={() => {
                      setCreateMode(false);
                      setActiveCenterId(row.centerId);
                      setActiveCenterName(row.centerName || '');
                      setFormOpen(true);
                    }}
                    className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    ariaLabel={`Edit website for ${row.centerName || 'saved form'}`}
                  >
                    Edit website
                  </TouchFeedbackButton>
                </div>
              </div>
            </div>
          ))
          : null}


        {message ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
