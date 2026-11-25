import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  fetchAdminGbpDetail,
  fetchAdminGbpList,
  patchAdminGbpRequest,
} from '../services/gbpApi';
import { GBP_STATUS, statusLabel } from '../domain/gbp.rules';

const STATUS_OPTIONS = [
  GBP_STATUS.SUBMITTED,
  GBP_STATUS.IN_PROGRESS,
  GBP_STATUS.NEEDS_INFO,
  GBP_STATUS.LIVE,
  GBP_STATUS.CANCELLED,
];

export default function AdminGbpListingPage({ requesterUserId, onClose }) {
  const [list, setList] = useState([]);
  const [counts, setCounts] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [statusDraft, setStatusDraft] = useState(GBP_STATUS.IN_PROGRESS);
  const [mapsUrl, setMapsUrl] = useState('');
  const [opsNote, setOpsNote] = useState('');

  const load = useCallback(async () => {
    if (requesterUserId == null) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await fetchAdminGbpList({ requesterUserId });
      setList(Array.isArray(data?.requests) ? data.requests : []);
      setCounts(data?.counts || null);
    } catch (err) {
      setMessage(err?.message || 'Could not load queue');
    } finally {
      setBusy(false);
    }
  }, [requesterUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (requestId) => {
    setBusy(true);
    setMessage('');
    try {
      const data = await fetchAdminGbpDetail({ requesterUserId, requestId });
      setDetail(data);
      setStatusDraft(data?.status || GBP_STATUS.IN_PROGRESS);
      setMapsUrl(data?.mapsUrl || '');
      setOpsNote(data?.opsNote || '');
    } catch (err) {
      setMessage(err?.message || 'Could not load request');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!detail?.id) return;
    setBusy(true);
    setMessage('');
    try {
      const data = await patchAdminGbpRequest({
        requesterUserId,
        requestId: detail.id,
        status: statusDraft,
        mapsUrl,
        opsNote,
      });
      setDetail(data);
      setMessage('Updated');
      load();
    } catch (err) {
      setMessage(err?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f7f5]">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <TouchFeedbackButton
            onClick={() => {
              if (detail) {
                setDetail(null);
                return;
              }
              onClose();
            }}
            ariaLabel="Go back"
            className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-gray-900">
              {detail ? `Request #${detail.id}` : 'Map Business Queue'}
            </h1>
            <p className="text-xs text-gray-500">
              {detail ? statusLabel(detail.status) : 'Admin / developer — submitted Map Business requests'}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {message ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {message}
          </p>
        ) : null}

        {!detail ? (
          <>
            {counts ? (
              <p className="text-xs text-gray-500">
                Submitted {counts.submitted || 0} · In progress {counts.in_progress || 0} · Live {counts.live || 0}
              </p>
            ) : null}
            {busy && !list.length ? <p className="text-sm text-gray-500">Loading…</p> : null}
            {list.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openDetail(row.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-900">
                  #{row.id} · {row.businessName || 'Untitled'}
                </p>
                <p className="text-xs text-gray-500">
                  {statusLabel(row.status)} · User {row.userId} · {row.city || '—'}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  {row.photoCount || 0} photos · folder {row.mediaFolderKey || '—'}
                </p>
              </button>
            ))}
            {!busy && !list.length ? (
              <p className="text-sm text-gray-500">No requests yet.</p>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Business:</span> {detail.businessName}</p>
              <p><span className="font-medium">Category:</span> {detail.primaryCategory}</p>
              <p><span className="font-medium">Phone:</span> {detail.phone}</p>
              <p><span className="font-medium">Address:</span> {[detail.streetAddress, detail.area, detail.city, detail.state, detail.pincode].filter(Boolean).join(', ')}</p>
              <p><span className="font-medium">Hours:</span> {(detail.workingDays || []).join(', ')} · {detail.openingTime}–{detail.closingTime}</p>
              <p><span className="font-medium">Website:</span> {detail.websiteUrl || '—'}</p>
              <p><span className="font-medium">Folder:</span> {detail.mediaFolderKey || '—'}</p>
              <p className="whitespace-pre-wrap"><span className="font-medium">Description:</span> {detail.description || '—'}</p>
            </section>

            {(detail.mediaFiles || []).length ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Media</p>
                {(detail.mediaFiles || []).map((f) => (
                  <div key={f.key} className="text-xs text-gray-600">
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700">
                        {f.kind} — open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>{f.kind} — {f.key}</span>
                    )}
                  </div>
                ))}
              </section>
            ) : null}

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600">Status</span>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600">Maps / GBP URL</span>
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600">Ops note (shown on Needs info)</span>
                <textarea
                  className="w-full min-h-[72px] rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={opsNote}
                  onChange={(e) => setOpsNote(e.target.value)}
                />
              </label>
              <TouchFeedbackButton
                type="button"
                disabled={busy}
                onClick={onSave}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Save status
              </TouchFeedbackButton>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
