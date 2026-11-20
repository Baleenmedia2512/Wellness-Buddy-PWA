import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Globe2, ExternalLink, MapPin, Plus } from 'lucide-react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { APP_VERSION } from '../../../config/version';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { dismissNetworkFailure } from '../../../shared/services/networkNotice.js';
import { fetchMyWebsites } from '../services/portfolioApi';
import {
  confirmPendingPortfolioSiteOrder,
  fetchPortfolioSiteCredits,
} from '../services/portfolioSiteApi';
import { openPortfolioSiteCheckout } from '../openPortfolioSiteCheckout';
import { publicWebsiteUrl } from '../domain/publicWebsiteUrl';
import { usesPortfolioSiteSlots } from '../domain/portfolio.rules';
import CoachPortfolioForm from './CoachPortfolioForm';

function formatExpiry(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function friendlyLoadError(err) {
  const raw = String(err?.message || '');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw)) {
    return 'Could not load websites. Check your connection and try again.';
  }
  return raw || 'Could not load websites';
}

function friendlyPayError(err) {
  const raw = String(err?.message || '');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw)) {
    return 'Payment could not start. Check your connection and try again.';
  }
  return raw || 'Payment could not start';
}

/**
 * My Websites hub — Create New opens a fresh form; existing rows open edit.
 * Next-release: create/renew requires ₹399/yr site credit (center optional).
 */
export default function CoachWebsitePage({
  userId,
  onClose,
}) {
  const siteSlots = usesPortfolioSiteSlots(APP_VERSION.VERSION);
  const checkoutOn = isFlagEnabled('ff.portfolio-site-checkout');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [websites, setWebsites] = useState([]);
  const [unusedCredits, setUnusedCredits] = useState(0);
  const [priceLabel, setPriceLabel] = useState('₹399');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [activeCenterId, setActiveCenterId] = useState(null);
  const [activeCenterName, setActiveCenterName] = useState('');
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  const load = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    setMessage('');
    try {
      if (siteSlots) {
        await confirmPendingPortfolioSiteOrder(userId).catch(() => null);
      }
      let data = { websites: [], unusedCredits: undefined };
      try {
        data = await fetchMyWebsites(userId);
        setWebsites(Array.isArray(data?.websites) ? data.websites : []);
      } catch (listErr) {
        setWebsites([]);
        setMessage(friendlyLoadError(listErr));
      }
      if (siteSlots) {
        try {
          const credits = data?.unusedCredits != null
            ? data
            : await fetchPortfolioSiteCredits(userId);
          setUnusedCredits(Number(credits?.unusedCredits) || 0);
          const base = Number(credits?.priceBaseInr);
          if (Number.isFinite(base) && base > 0) {
            setPriceLabel(`₹${base}`);
          }
        } catch {
          // Credits are internal — never block the hub or surface raw fetch errors.
          setUnusedCredits(0);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, siteSlots]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = (opts = {}) => {
    setFormOpen(false);
    setCreateMode(false);
    setActiveCenterId(null);
    setActiveCenterName('');
    setActiveSubmissionId(null);
    setMessage(typeof opts?.message === 'string' ? opts.message : '');
    load();
  };

  const startCheckout = async ({ kind = 'credit', submissionId = null, centerId = null } = {}) => {
    if (!checkoutOn) {
      setMessage('Website checkout is not available right now.');
      return false;
    }
    setPaying(true);
    setMessage('');
    try {
      await openPortfolioSiteCheckout({
        userId,
        kind,
        submissionId,
        centerId,
      });
      const confirmed = await confirmPendingPortfolioSiteOrder(userId);
      if (confirmed?.paid === true) {
        setMessage(kind === 'renew'
          ? 'Renewed for one year.'
          : 'Payment successful. You can create a website now.');
        await load();
        return true;
      }
      setMessage('Payment started. If you already paid, pull to refresh in a moment.');
      await load();
      return false;
    } catch (err) {
      try {
        dismissNetworkFailure();
      } catch {
        // ignore
      }
      setMessage(friendlyPayError(err));
      return false;
    } finally {
      setPaying(false);
    }
  };

  const onCreateNew = async () => {
    setMessage('');
    if (siteSlots && unusedCredits < 1) {
      const paid = await startCheckout({ kind: 'credit' });
      if (!paid) return;
    }
    // Center optional — freestyle form works with typed City/Area.
    setCreateMode(true);
    setActiveCenterId(null);
    setActiveCenterName('');
    setActiveSubmissionId(null);
    setFormOpen(true);
  };

  const savedSites = websites.filter((row) => row.hasWebsite);

  if (formOpen && userId != null) {
    return (
      <CoachPortfolioForm
        userId={userId}
        centerId={createMode ? null : activeCenterId}
        centerName={createMode ? '' : activeCenterName}
        submissionId={createMode ? null : activeSubmissionId}
        createMode={createMode}
        availableCenters={websites}
        onClose={closeForm}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f4f7f5]">
      <div className="border-b border-gray-200/80 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <TouchFeedbackButton
            onClick={onClose}
            ariaLabel="Go back"
            className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-gray-900">Digital Portfolio</h1>
            <p className="text-xs text-gray-500">Paid module · one page per center you own</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 py-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
            <Globe2 className="h-5 w-5 text-emerald-700" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Create &amp; publish</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            {siteSlots
              ? `Each website is ${priceLabel} for one year. Center is optional — you can buy and publish without one.`
              : 'Create New opens a blank form. Pick a center if you have one, or enter City and Area, then publish with coach OTP.'}
          </p>
          <TouchFeedbackButton
            type="button"
            onClick={onCreateNew}
            disabled={paying || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            ariaLabel="Create new website"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {paying
              ? 'Opening payment…'
              : (siteSlots && unusedCredits < 1
                ? `Buy website · ${priceLabel}/yr`
                : 'Create new')}
          </TouchFeedbackButton>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : null}

        {!loading && savedSites.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            No websites yet. Tap Buy website to get started — a nutrition center is not required.
          </div>
        ) : null}

        {!loading
          ? savedSites.map((row) => {
            const submissionId = row.submissionId ?? row.submission?.id ?? null;
            const expiryLabel = formatExpiry(row.expiresAt);
            const needsRenew = siteSlots && row.entitlementActive === false;
            return (
              <div
                key={row.centerId != null ? `c-${row.centerId}` : `s-${submissionId || row.publicPath}`}
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
                        || (row.freestyle || row.legacy
                          ? 'No center — place from map'
                          : 'Place from center GPS')}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {row.isPublished
                        ? `Live · ${row.publicPath}`
                        : 'Draft saved — publish when ready'}
                    </p>
                    {siteSlots && expiryLabel ? (
                      <p className={`mt-0.5 text-xs ${needsRenew ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
                        {needsRenew ? `Ended ${expiryLabel}` : `Valid until ${expiryLabel}`}
                      </p>
                    ) : null}
                    {row.isPublished && row.publicPath && !needsRenew ? (
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
                    {needsRenew && submissionId != null ? (
                      <TouchFeedbackButton
                        onClick={() => startCheckout({
                          kind: 'renew',
                          submissionId,
                          centerId: row.centerId,
                        })}
                        disabled={paying}
                        className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        ariaLabel={`Renew website for ${row.centerName || 'saved form'}`}
                      >
                        {paying ? 'Opening payment…' : `Renew · ${priceLabel}/yr`}
                      </TouchFeedbackButton>
                    ) : null}
                    <TouchFeedbackButton
                      onClick={() => {
                        setCreateMode(false);
                        setActiveCenterId(row.centerId);
                        setActiveCenterName(row.centerName || '');
                        // Always pass Id so City/Area uniqueness excludes this row (not self-"taken").
                        setActiveSubmissionId(submissionId);
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
            );
          })
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
