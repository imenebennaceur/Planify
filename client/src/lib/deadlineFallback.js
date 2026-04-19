const STORAGE_KEY = 'planify_global_deadlines_v1';

function toIsoDay(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : '';
}

export function readDeadlineFallback() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { report_deadline: '', memoire_deadline: '', updated_at: null, updated_by: '' };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { report_deadline: '', memoire_deadline: '', updated_at: null, updated_by: '' };
    const parsed = JSON.parse(raw);
    return {
      report_deadline: toIsoDay(parsed && parsed.report_deadline),
      memoire_deadline: toIsoDay(parsed && parsed.memoire_deadline),
      updated_at: Number((parsed && parsed.updated_at) || 0) || null,
      updated_by: String((parsed && parsed.updated_by) || '').trim()
    };
  } catch {
    return { report_deadline: '', memoire_deadline: '', updated_at: null, updated_by: '' };
  }
}

export function writeDeadlineFallback({ report_deadline, memoire_deadline, updated_by = '' }) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const payload = {
      report_deadline: toIsoDay(report_deadline),
      memoire_deadline: toIsoDay(memoire_deadline),
      updated_at: Date.now(),
      updated_by: String(updated_by || '').trim()
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode/quota/security).
  }
}

export function isMissingDeadlineRouteError(response) {
  const msg =
    String(
      (response && response.data && response.data.errors && response.data.errors[0]) ||
        ''
    )
      .toLowerCase()
      .trim();
  const status = Number((response && response.status) || 0);
  return status === 404 || msg.includes('http 404') || msg.includes('cannot get /api/admin/document-deadlines');
}
