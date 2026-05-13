/**
 * educationDashboardService.js — async API I/O for the dashboard.
 *
 * All fetch calls use cache-busting + no-store headers to keep the
 * dashboard view in sync with the backend after delete/undo flows.
 */

const noCacheHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

const cacheBuster = () => Date.now();

export async function fetchEducationLogsPage({ apiBaseUrl, userId, limit, offset }) {
  const params = new URLSearchParams({
    userId, limit: String(limit), offset: String(offset),
    includeImage: 'false', _t: String(cacheBuster()),
  });
  const res = await fetch(`${apiBaseUrl}/api/education/logs?${params}`, {
    method: 'GET', headers: noCacheHeaders, cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch education logs');
  }
  const rows = Array.isArray(data.logs) ? data.logs : [];
  const hasMore = data.pagination ? !!data.pagination.hasMore : rows.length === limit;
  return { rows, hasMore };
}

export async function fetchEducationSummary({ apiBaseUrl, userId }) {
  const res = await fetch(
    `${apiBaseUrl}/api/education/summary?userId=${userId}&_t=${cacheBuster()}`,
    { method: 'GET', headers: noCacheHeaders, cache: 'no-store' },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? data.summary : null;
}

export async function deleteEducationLog({ apiBaseUrl, userId, logId }) {
  const res = await fetch(`${apiBaseUrl}/api/education/logs`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, logId }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete education log');
  }
  return data;
}

export async function undoEducationDelete({ apiBaseUrl, userId, logId }) {
  const res = await fetch(`${apiBaseUrl}/api/education/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: logId, userId }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to restore log');
  }
  return data;
}
