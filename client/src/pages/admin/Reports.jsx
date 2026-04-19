import React, { useEffect, useMemo, useState } from 'react';
import { listReports, saveReport } from '../../lib/adminApi.js';

function fmtDefense(row) {
  if (!row || !row.defense_date) return '-';
  const parts = [row.defense_date, row.defense_time, row.defense_room].filter(Boolean);
  return parts.join(' - ');
}

export default function AdminReports() {
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingEmail, setEditingEmail] = useState('');
  const editing = useMemo(() => rows.find((row) => row.student_email === editingEmail) || null, [rows, editingEmail]);
  const [form, setForm] = useState({ status: 'not_submitted', deadline: '', report_url: '', memoire_url: '' });

  async function load(nextStatus) {
    const target = nextStatus || status;
    setLoading(true);
    const r = await listReports(target);

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load reports.');
      setRows([]);
      setLoading(false);
      return;
    }

    setError('');
    setRows(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load(status);
  }, [status]);

  useEffect(() => {
    if (!editing) return;
    setForm({
      status: editing.status || 'not_submitted',
      deadline: editing.deadline || '',
      report_url: editing.report_url || '',
      memoire_url: editing.memoire_url || ''
    });
  }, [editing]);

  function onFormChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    if (!editingEmail) return;
    const r = await saveReport({ user_email: editingEmail, ...form });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to save report.');
      return;
    }
    setError('');
    setEditingEmail('');
    await load(status);
    alert('Saved');
  }

  return (
    <div>
      <h2 className="title">Reports</h2>
      <p className="subtitle">View and update submissions (report / thesis)</p>

      <div className="toolbar">
        <div className="field select" style={{ width: 260, margin: 0 }}>
          <span className="icon" aria-hidden="true">
            R
          </span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="not_submitted">Not submitted</option>
          </select>
          <span className="chevron" aria-hidden="true">
            v
          </span>
        </div>
        <button className="btn" type="button" onClick={() => load(status)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}

      {editing && (
        <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Edit - {editing.student_name} ({editing.student_email})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div className="field select" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                S
              </span>
              <select value={form.status} onChange={(e) => onFormChange('status', e.target.value)}>
                <option value="not_submitted">Not submitted</option>
                <option value="submitted">Submitted</option>
              </select>
              <span className="chevron" aria-hidden="true">
                v
              </span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                D
              </span>
              <input value={form.deadline} placeholder="Deadline (e.g. 2026-06-15)" onChange={(e) => onFormChange('deadline', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                L
              </span>
              <input value={form.report_url} placeholder="Report URL" onChange={(e) => onFormChange('report_url', e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                L
              </span>
              <input value={form.memoire_url} placeholder="Thesis URL" onChange={(e) => onFormChange('memoire_url', e.target.value)} />
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="primary" type="button" onClick={onSave}>
              Save
            </button>
            <button className="btn" type="button" onClick={() => setEditingEmail('')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Report</th>
              <th>Thesis</th>
              <th>Defense</th>
              <th style={{ width: 90 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.student_email || index} style={{ background: row.status === 'submitted' ? 'var(--surface-success)' : undefined }}>
                <td>{row.student_name}</td>
                <td>{row.student_email}</td>
                <td>{row.status === 'submitted' ? 'Submitted' : 'Not submitted'}</td>
                <td>{row.deadline || '-'}</td>
                <td>{row.report_url ? <a href={row.report_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td>{row.memoire_url ? <a href={row.memoire_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td>{fmtDefense(row)}</td>
                <td>
                  <button className="btn" type="button" onClick={() => setEditingEmail(row.student_email)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: 14, color: 'var(--muted)' }}>
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
