import React, { useEffect, useState } from 'react';
import { listNotificationBatches, sendNotification } from '../../lib/adminApi.js';

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '-';
  }
}

export default function AdminNotifications({ adminEmail, onHistoryLoaded }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [targetType, setTargetType] = useState('role');
  const [targetRole, setTargetRole] = useState('student');
  const [targetEmail, setTargetEmail] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    const r = await listNotificationBatches(50);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load history.');
      setRows([]);
      setLoading(false);
      return;
    }
    setError('');
    const nextRows = Array.isArray(r.data) ? r.data : [];
    setRows(nextRows);
    if (typeof onHistoryLoaded === 'function') onHistoryLoaded(nextRows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSend(ev) {
    ev.preventDefault();
    const msg = message.trim();
    if (!msg) {
      setError('Please enter a message.');
      return;
    }

    let target_value = '';
    if (targetType === 'email') {
      target_value = targetEmail.trim();
      if (!target_value) {
        setError('Please enter an email.');
        return;
      }
    } else {
      target_value = targetRole;
    }

    setSending(true);
    const r = await sendNotification({
      title: title.trim(),
      message: msg,
      target_type: targetType,
      target_value,
      created_by: adminEmail || ''
    });
    setSending(false);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to send notification.');
      return;
    }

    setError('');
    setTitle('');
    setMessage('');
    setTargetEmail('');
    await load();
    alert('Notification sent');
  }

  const roleLabel =
    targetRole === 'student' ? 'All students' : targetRole === 'professor' ? 'All professors' : 'Students + professors';

  return (
    <div>
      <h2 className="title">Notifications</h2>
      <p className="subtitle">Send notifications (students / professors) and view history</p>

      <form onSubmit={onSend} style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 10 }}>
          <div className="field select" style={{ margin: 0 }}>
            <span className="icon" aria-hidden="true">
              🎯
            </span>
            <select
              value={targetType === 'role' ? `role:${targetRole}` : 'email'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'email') {
                  setTargetType('email');
                } else if (v.startsWith('role:')) {
                  setTargetType('role');
                  setTargetRole(v.slice('role:'.length));
                }
              }}
            >
              <option value="role:student">All students</option>
              <option value="role:professor">All professors</option>
              <option value="role:all">Students + professors</option>
              <option value="email">Specific email</option>
            </select>
            <span className="chevron" aria-hidden="true">
              ▾
            </span>
          </div>

          {targetType === 'email' ? (
            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                @
              </span>
              <input value={targetEmail} placeholder="recipient@example.com" onChange={(e) => setTargetEmail(e.target.value)} />
            </div>
          ) : (
            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                👥
              </span>
              <input value={roleLabel} readOnly />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <span className="icon" aria-hidden="true">
              🏷️
            </span>
            <input value={title} placeholder="Title (optional)" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, gridTemplateColumns: '40px 1fr', alignItems: 'start' }}>
            <span className="icon" aria-hidden="true">
              ✉️
            </span>
            <textarea
              value={message}
              placeholder="Your message..."
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                minHeight: 90,
                border: 0,
                outline: 0,
                resize: 'vertical',
                padding: '12px 0 4px',
                background: 'transparent',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="primary" type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send'}
          </button>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </form>

      {error && <div className="errors">{error}</div>}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Target</th>
              <th>Title</th>
              <th>Message</th>
              <th>Recipients</th>
              <th>Read</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  {r.target_type}:{r.target_value}
                </td>
                <td>{r.title || '-'}</td>
                <td style={{ maxWidth: 520, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</td>
                <td>{r.recipients || 0}</td>
                <td>{r.read_count || 0}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: 'var(--muted)' }}>
                  No notifications sent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
