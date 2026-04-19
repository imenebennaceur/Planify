import React, { useEffect, useMemo, useState } from 'react';
import { listMyStudents, saveEvaluation } from '../../lib/professorApi.js';

function fmtDefense(row) {
  if (!row || !row.defense_date) return '-';
  const parts = [row.defense_date, row.defense_time, row.defense_room].filter(Boolean);
  return parts.join(' - ');
}

export default function ProfStudents({ teacherEmail, onMessage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => rows.find((row) => row.student_email === selectedEmail) || null, [rows, selectedEmail]);

  async function load() {
    setLoading(true);
    const r = await listMyStudents({ teacher_email: teacherEmail, role: 'supervisor' });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load your supervised students.');
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
  }, [teacherEmail]);

  useEffect(() => {
    if (!selected) return;
    setGrade(selected.eval_grade === null || selected.eval_grade === undefined ? '' : String(selected.eval_grade));
    setComment(selected.eval_comment || '');
  }, [selected]);

  async function onSaveGrade() {
    if (!selected) return;
    const trimmedGrade = String(grade || '').trim();
    const parsed = trimmedGrade === '' ? null : Number(trimmedGrade);
    if (trimmedGrade !== '' && (Number.isNaN(parsed) || parsed < 0 || parsed > 20)) {
      setError('Please enter a valid grade between 0 and 20.');
      return;
    }

    setSaving(true);
    const result = await saveEvaluation({
      student_email: selected.student_email,
      evaluator_email: teacherEmail,
      evaluator_role: 'supervisor',
      grade: parsed,
      comment
    });
    setSaving(false);

    if (!result.ok) {
      setError((result.data && result.data.errors && result.data.errors[0]) || 'Unable to save supervisor grade.');
      return;
    }

    setError('');
    await load();
    alert('Supervisor grade saved.');
  }

  return (
    <div>
      <h2 className="title">My supervised students</h2>
      <p className="subtitle">Review assigned students, download files, message them, and enter supervisor grades.</p>

      <div className="toolbar">
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Project</th>
              <th>Report</th>
              <th>Thesis</th>
              <th>Defense</th>
              <th>Grade</th>
              <th style={{ width: 220 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.student_email || index} style={{ background: selectedEmail === row.student_email ? 'var(--surface-select)' : undefined }}>
                <td>{row.student_name}</td>
                <td>{row.student_email}</td>
                <td>{row.project_title || ''}</td>
                <td>{row.report_url ? <a href={row.report_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td>{row.memoire_url ? <a href={row.memoire_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                <td>{fmtDefense(row)}</td>
                <td>{row.eval_grade === null || row.eval_grade === undefined ? '-' : row.eval_grade}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" type="button" onClick={() => setSelectedEmail(row.student_email)}>
                      Grade
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => onMessage && onMessage({ email: row.student_email, name: row.student_name })}
                    >
                      Message
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: 14, color: 'var(--muted)' }}>
                  No supervised student assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <h3 className="title" style={{ fontSize: 16, textAlign: 'left' }}>
            Supervisor grading - {selected.student_name}
          </h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 10, maxWidth: 640 }}>
            <div className="field">
              <span className="icon" aria-hidden="true">
                {'\u{1F4DD}'}
              </span>
              <input
                type="number"
                min="0"
                max="20"
                step="0.25"
                placeholder="Grade / 20"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              />
            </div>
            <div className="field" style={{ gridTemplateColumns: '40px 1fr', alignItems: 'start' }}>
              <span className="icon" aria-hidden="true">
                {'\u{1F4AC}'}
              </span>
              <textarea
                value={comment}
                placeholder="Supervisor comment..."
                onChange={(event) => setComment(event.target.value)}
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
            <div className="toolbar" style={{ marginTop: 0 }}>
              <button className="primary" type="button" onClick={onSaveGrade} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn" type="button" onClick={() => setSelectedEmail('')}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
