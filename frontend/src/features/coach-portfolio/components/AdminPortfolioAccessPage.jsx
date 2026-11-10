import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { ADMIN_STATUS_OPTIONS } from '../domain/formOptions';
import {
  adminMarkPortfolioAccess,
  fetchAdminSubmissionDetail,
  fetchAdminSubmissions,
  fetchPortfolioStatus,
  publishAdminSubmission,
  updateAdminSubmissionStatus,
} from '../services/portfolioApi';
import { openPublicCoachUrl, resolvePublicCoachUrl } from '../utils/publicCoachUrl';

/**
 * Admin/developer: mark paid + review form submissions.
 */
export default function AdminPortfolioAccessPage({ requesterUserId, onClose }) {
  const [tab, setTab] = useState('access'); // access | submissions
  const [targetUserId, setTargetUserId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [list, setList] = useState([]);
  const [counts, setCounts] = useState(null);
  const [detail, setDetail] = useState(null);
  const [statusDraft, setStatusDraft] = useState('under_review');
  const [noteDraft, setNoteDraft] = useState('');

  const loadSubmissions = useCallback(async () => {
    if (requesterUserId == null) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await fetchAdminSubmissions({ requesterUserId });
      setList(data?.submissions || []);
      setCounts(data?.counts || null);
    } catch (err) {
      setMessage(err?.message || 'Could not load submissions');
    } finally {
      setBusy(false);
    }
  }, [requesterUserId]);

  useEffect(() => {
    if (tab === 'submissions') loadSubmissions();
  }, [tab, loadSubmissions]);

  const onLookup = async () => {
    const id = String(targetUserId || '').trim();
    if (!id) {
      setMessage('Enter a coach UserId');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await fetchPortfolioStatus(id);
      if (!data) {
        setLookup(null);
        setMessage('Could not load that account');
        return;
      }
      setLookup(data);
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  const onMark = async (paid) => {
    const id = String(targetUserId || '').trim();
    if (!id || requesterUserId == null) {
      setMessage('Sign in again, then enter a coach UserId');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await adminMarkPortfolioAccess({
        requesterUserId,
        targetUserId: id,
        paid,
      });
      setLookup(data);
      setMessage(paid ? 'Marked paid — form can open for this coach.' : 'Marked not paid — form locked.');
    } catch (error) {
      setMessage(error?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (userId) => {
    setBusy(true);
    setMessage('');
    try {
      const data = await fetchAdminSubmissionDetail({
        requesterUserId,
        targetUserId: userId,
      });
      setDetail(data);
      setStatusDraft(data?.status === 'draft' ? 'under_review' : data?.status || 'under_review');
      setNoteDraft(data?.adminNote || '');
    } catch (err) {
      setMessage(err?.message || 'Could not open submission');
    } finally {
      setBusy(false);
    }
  };

  const saveStatus = async () => {
    if (!detail?.userId) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await updateAdminSubmissionStatus({
        requesterUserId,
        targetUserId: detail.userId,
        status: statusDraft,
        adminNote: noteDraft,
      });
      setDetail(data);
      setMessage(
        data?.isPublished && data?.publicPath
          ? `Status updated · live at ${data.publicPath}`
          : 'Status updated',
      );
      await loadSubmissions();
    } catch (err) {
      setMessage(err?.message || 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    if (!detail?.userId) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await publishAdminSubmission({
        requesterUserId,
        targetUserId: detail.userId,
      });
      setDetail(data);
      setStatusDraft(data?.status || statusDraft);
      setMessage(
        data?.publicPath
          ? `Published · ${data.publicPath}`
          : 'Published',
      );
      await loadSubmissions();
    } catch (err) {
      setMessage(err?.message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const publicSiteUrl = resolvePublicCoachUrl(detail?.publicPath);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f7f5]">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onClose}
              ariaLabel="Go back"
              className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </TouchFeedbackButton>
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden />
                Coach Website Access
              </h1>
              <p className="text-xs text-gray-500">Paid unlock + form review</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === 'access' ? 'bg-emerald-600 text-white' : 'text-gray-700'}`}
              onClick={() => { setTab('access'); setDetail(null); }}
            >
              Mark Paid
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-semibold ${tab === 'submissions' ? 'bg-emerald-600 text-white' : 'text-gray-700'}`}
              onClick={() => setTab('submissions')}
            >
              Submissions
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {tab === 'access' ? (
          <>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <label className="block text-sm font-medium text-gray-800" htmlFor="portfolio-target-user-id">
                Coach UserId
              </label>
              <input
                id="portfolio-target-user-id"
                type="number"
                inputMode="numeric"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="e.g. 1108"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <TouchFeedbackButton
                onClick={onLookup}
                disabled={busy}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                ariaLabel="Check status"
              >
                Check status
              </TouchFeedbackButton>
            </div>

            {lookup ? (
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm space-y-2">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">{lookup.userName || 'Coach'}</span>
                  {' · '}UserId {lookup.userId}
                </p>
                <p className="text-sm text-gray-600">
                  Status:{' '}
                  <span className={lookup.paid ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                    {lookup.paid ? 'Paid (unlocked)' : 'Not paid (locked)'}
                  </span>
                </p>
                <div className="flex gap-2 pt-2">
                  <TouchFeedbackButton
                    onClick={() => onMark(true)}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    ariaLabel="Mark paid"
                  >
                    Mark Paid
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    onClick={() => onMark(false)}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 disabled:opacity-60"
                    ariaLabel="Mark not paid"
                  >
                    Mark Not Paid
                  </TouchFeedbackButton>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'submissions' && !detail ? (
          <>
            {counts ? (
              <p className="text-xs text-gray-500">
                Total {counts.total} · New {counts.new || 0} · Review {counts.under_review || 0} · Done {counts.completed || 0}
              </p>
            ) : null}
            <div className="space-y-2">
              {list.length === 0 && !busy ? (
                <p className="text-sm text-gray-500">No submissions yet.</p>
              ) : null}
              {list.map((row) => (
                <button
                  key={`${row.userId}-${row.status}`}
                  type="button"
                  onClick={() => openDetail(row.userId)}
                  className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">{row.userName || `User ${row.userId}`}</p>
                  <p className="text-xs text-gray-500">
                    UserId {row.userId} · {row.status}
                    {row.isPublished && row.publicSlug ? ` · /coach/${row.publicSlug}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'submissions' && detail ? (
          <div className="space-y-3">
            <TouchFeedbackButton
              onClick={() => setDetail(null)}
              className="text-sm font-semibold text-emerald-700"
            >
              ← Back to list
            </TouchFeedbackButton>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2 text-sm">
              <p className="font-semibold text-gray-900">{detail.userName || 'Coach'} · {detail.userId}</p>
              <p>Status: {detail.status}</p>
              <p>
                Site:{' '}
                {detail.isPublished && detail.publicPath
                  ? <span className="font-semibold text-emerald-700">Published</span>
                  : <span className="font-semibold text-amber-700">Not published</span>}
              </p>
              {publicSiteUrl ? (
                <a
                  href={publicSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => openPublicCoachUrl(detail.publicPath, e)}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700"
                >
                  Open {detail.publicPath}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <p className="text-xs text-gray-500">Approve or Publish to create /coach/&lt;city&gt;/&lt;area&gt;/&lt;display-name&gt;</p>
              )}
              <p>Name: {detail.form?.personal?.fullName || '—'}</p>
              <p>Center: {detail.form?.center?.centerName || '—'}</p>
              <p>City: {detail.form?.center?.city || '—'} / {detail.form?.center?.locality || '—'}</p>
              <p>Phone: {detail.form?.center?.businessPhone || '—'}</p>
              <p>Website name: {detail.form?.mediaBrand?.websiteDisplayName || '—'}</p>
              {detail.form?.personal?.profilePhoto ? (
                <img src={detail.form.personal.profilePhoto} alt="" className="h-20 w-20 rounded-xl object-cover" />
              ) : null}
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <label className="block text-sm font-medium text-gray-800">Update status</label>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                {ADMIN_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                placeholder="Admin note (optional)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <TouchFeedbackButton
                onClick={saveStatus}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save status
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={onPublish}
                disabled={busy}
                className="w-full rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-60"
              >
                {detail.isPublished ? 'Re-publish site' : 'Publish site now'}
              </TouchFeedbackButton>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="text-sm text-gray-600" role="status">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
