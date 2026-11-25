import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, MapPinned, Plus } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { fetchGbpMine } from '../services/gbpApi';
import { statusLabel } from '../domain/gbp.rules';
import GbpListingForm from './GbpListingForm';

/**
 * Hub — Create new opens form; existing center cards open edit / show Live link.
 */
export default function GbpListingPage({ userId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [websites, setWebsites] = useState([]);
  const [categories, setCategories] = useState([]);
  const [phoneHint, setPhoneHint] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [activeCenterId, setActiveCenterId] = useState(null);
  const [activeCenterName, setActiveCenterName] = useState('');
  const [activeRequest, setActiveRequest] = useState(null);

  const load = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchGbpMine(userId);
      setWebsites(Array.isArray(data?.websites) ? data.websites : []);
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
      setPhoneHint(String(data?.phoneHint || ''));
    } catch (err) {
      setWebsites([]);
      setMessage(err?.message || 'Could not load listings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = (opts = {}) => {
    setFormOpen(false);
    setCreateMode(false);
    setActiveCenterId(null);
    setActiveCenterName('');
    setActiveRequest(null);
    setMessage(typeof opts?.message === 'string' ? opts.message : '');
    load();
  };

  if (formOpen && userId != null) {
    return (
      <GbpListingForm
        userId={userId}
        centerId={createMode ? null : activeCenterId}
        centerName={createMode ? '' : activeCenterName}
        createMode={createMode}
        availableCenters={websites}
        initialRequest={activeRequest}
        categories={categories}
        phoneHint={phoneHint}
        onClose={closeForm}
      />
    );
  }

  const withRequest = websites.filter((row) => row.hasRequest);

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
            <h1 className="text-base font-bold text-gray-900">Google Map Business</h1>
            <p className="text-xs text-gray-500">Request a Google Maps business for your center</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {message ? (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
            <MapPinned className="h-5 w-5 text-emerald-700" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Create &amp; submit</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Fill the same details Google asks for a Business Profile, upload photos, then submit.
            Our team creates the Map Business on Google Maps.
          </p>
          <TouchFeedbackButton
            type="button"
            onClick={() => {
              setMessage('');
              setCreateMode(true);
              setActiveCenterId(null);
              setActiveCenterName('');
              setActiveRequest(null);
              setFormOpen(true);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
            ariaLabel="Create new listing request"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create new
          </TouchFeedbackButton>
        </div>

        {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}

        {!loading && websites.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Register a nutrition center first. Then tap Create new.
          </div>
        ) : null}

        {!loading
          ? withRequest.map((row) => {
            const req = row.request;
            const mapsUrl = req?.mapsUrl;
            return (
              <div
                key={row.centerId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                    <MapPinned className="h-4 w-4 text-emerald-700" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {req?.businessName || row.centerName || 'Center'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[row.centerName, req?.city].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      {statusLabel(req?.status)}
                      {req?.photoCount != null ? ` · ${req.photoCount} photos` : ''}
                    </p>
                    {req?.opsNote && req.status === 'needs_info' ? (
                      <p className="mt-1 text-xs text-amber-700">{req.opsNote}</p>
                    ) : null}
                  </div>
                </div>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                  >
                    Open in Maps
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
                {req?.canEdit !== false && (req?.status === 'draft' || req?.status === 'needs_info') ? (
                  <TouchFeedbackButton
                    type="button"
                    onClick={() => {
                      setCreateMode(false);
                      setActiveCenterId(row.centerId);
                      setActiveCenterName(row.centerName || '');
                      setActiveRequest(req);
                      setFormOpen(true);
                    }}
                    className="mt-1 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    ariaLabel="Edit listing request"
                  >
                    Edit request
                  </TouchFeedbackButton>
                ) : null}
              </div>
            );
          })
          : null}
      </div>
    </div>
  );
}
