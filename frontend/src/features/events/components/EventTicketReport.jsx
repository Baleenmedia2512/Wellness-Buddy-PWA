import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getUserId } from '../../../shared/services/getUserId.js';
import { getEventTicketReport } from '../services/events.api.js';
import { downloadTicketReportCsv, downloadTicketReportExcel } from '../utils/ticketReportExport.js';

const SUMMARY = [
  ['ticketsSold', 'Tickets sold'],
  ['allowedQr', 'Allowed for entry'],
  ['entryScanned', 'Entry scanned'],
  ['foodScanned', 'Food scanned'],
  ['attended', 'Attended'],
  ['notAttended', 'Not attended'],
  ['expired', 'Expired QR'],
];

function statusClass(value) {
  if (value === 'Attended' || value === 'Entry scanned' || value === 'Food scanned') {
    return 'bg-emerald-100 text-emerald-900';
  }
  if (value === 'Allowed') return 'bg-sky-100 text-sky-900';
  if (value === 'Expired') return 'bg-rose-100 text-rose-800';
  return 'bg-gray-100 text-gray-700';
}

export default function EventTicketReport({ user, eventId, eventName, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportNote, setExportNote] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const userId = await getUserId(user);
        const data = await getEventTicketReport(userId, eventId);
        if (!live) return;
        setReport(data.report || null);
      } catch (err) {
        if (live) setError(err?.message || 'Could not load the ticket report.');
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [user, eventId]);

  const exportFile = async (kind) => {
    if (!report) return;
    setExporting(kind);
    setExportNote('');
    try {
      const result = kind === 'xlsx'
        ? await downloadTicketReportExcel(report)
        : await downloadTicketReportCsv(report);
      setExportNote(result?.mode === 'saved'
        ? 'The report file is ready to save.'
        : 'The report file is downloading.');
    } catch (err) {
      setExportNote(err?.message || 'Could not export the report.');
    } finally {
      setExporting('');
    }
  };

  return (
    <section className="fixed inset-0 z-[70] overflow-y-auto bg-gray-50 safe-top safe-bottom" aria-label="Ticket report">
      <div className="mx-auto max-w-lg px-4 py-4 pb-10">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <h2 className="mt-3 text-xl font-extrabold text-green-800">Ticket report</h2>
        <p className="mt-1 text-sm text-gray-600">{report?.eventName || eventName || 'Event'}</p>

        {loading ? <p className="mt-6 text-sm text-gray-500">Loading tickets…</p> : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}

        {report ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {SUMMARY.map(([key, label]) => (
                <div key={key} className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                  <dd className="text-lg font-bold text-emerald-950">{report[key] ?? 0}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={Boolean(exporting)}
                onClick={() => exportFile('xlsx')}
                className="flex-1 rounded-xl bg-emerald-800 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
              </button>
              <button
                type="button"
                disabled={Boolean(exporting)}
                onClick={() => exportFile('csv')}
                className="flex-1 rounded-xl border border-emerald-700 px-3 py-2.5 text-sm font-bold text-emerald-900 disabled:opacity-60"
              >
                {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
            {exportNote ? (
              <p className="mt-2 text-sm text-emerald-900" role="status">{exportNote}</p>
            ) : null}

            {report.rows.length === 0 ? (
              <p className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                No tickets sold yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {report.rows.map((row) => (
                  <li key={row.ticketNumber} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">{row.guestName}</p>
                        <p className="mt-1 text-sm text-gray-700">Ticket {row.ticketNumber}</p>
                        <p className="text-sm text-gray-700">QR {row.qrCode}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(row.qrStatus)}`}>
                        {row.qrStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(row.entryStatus)}`}>
                        {row.entryStatus}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(row.foodStatus)}`}>
                        {row.foodStatus}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(row.attendance)}`}>
                        {row.attendance}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">{row.qrNote}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
