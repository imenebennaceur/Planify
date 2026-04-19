import React, { useEffect, useState } from 'react';
import { listNotifications, markAllNotificationsRead } from '../../lib/notificationsApi.js';

function fmtDate(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '';
  }
}

export default function NotificationsPanel({ email }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function load() {
    if (!email) return;
    setLoading(true);
    const r = await listNotifications({ email, limit: 50 });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load notifications.');
      setRows([]);
      setLoading(false);
      return;
    }
    setError('');
    setRows(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [email]);

  async function onMarkAllRead() {
    if (!email) return;
    setMarking(true);
    const r = await markAllNotificationsRead({ email });
    setMarking(false);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to mark as read.');
      return;
    }
    setError('');
    await load();
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div>
      <h2 className="title">Notifications</h2>
      <p className="subtitle">Messages and announcements {unread ? `(unread: ${unread})` : ''}</p>

      <div className="toolbar">
        <button className="primary" type="button" onClick={onMarkAllRead} disabled={marking || loading || !rows.length}>
          {marking ? 'Marking...' : 'Mark all as read'}
        </button>
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>Title</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n, i) => (
              <tr key={n.delivery_id || i} style={{ background: n.read_at ? undefined : 'var(--surface-unread)' }}>
                <td>{fmtDate(n.created_at)}</td>
                <td>{n.created_by || 'System'}</td>
                <td>{n.title || '-'}</td>
                <td style={{ maxWidth: 680, whiteSpace: 'pre-wrap' }}>{n.message}</td>
                <td>{n.read_at ? 'Read' : 'New'}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 14, color: 'var(--muted)' }}>
                  No notifications.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
