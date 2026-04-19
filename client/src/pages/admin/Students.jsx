import React, { useEffect, useState } from 'react';
import { listStudents, addStudent, deleteStudent, getAdminDocumentDeadlines, saveAdminDocumentDeadlines, saveReport } from '../../lib/adminApi.js';
import { isMissingDeadlineRouteError, readDeadlineFallback, writeDeadlineFallback } from '../../lib/deadlineFallback.js';

const emptyForm = {
  user_email: '',
  student_id: '',
  first_name: '',
  last_name: '',
  level: '',
  speciality: '',
  phone: '',
  registration_number: '',
  department: '',
  academic_year: '',
  project_title: ''
};

const emptyDeadlines = {
  report_deadline: '',
  memoire_deadline: '',
  updated_at: null,
  updated_by: ''
};

function show(v) {
  const value = String(v || '').trim();
  return value || 'Not provided';
}

function fileLink(url, label) {
  const href = String(url || '').trim();
  if (!href) return 'Not provided';
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function inferNames(row) {
  const parts = String((row && row.account_name) || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const inferredLast = parts.length ? parts.slice(-1).join(' ') : '';
  const inferredFirst = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  return {
    first_name: String((row && row.first_name) || '').trim() || inferredFirst,
    last_name: String((row && row.last_name) || '').trim() || inferredLast
  };
}

export default function AdminStudents() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deadlines, setDeadlines] = useState(emptyDeadlines);
  const [savingDeadlines, setSavingDeadlines] = useState(false);

  async function load() {
    setLoading(true);
    const [studentsRes, deadlinesRes] = await Promise.all([listStudents(), getAdminDocumentDeadlines()]);
    if (!studentsRes.ok) {
      setError((studentsRes.data && studentsRes.data.errors && studentsRes.data.errors[0]) || 'Unable to load students list.');
      setRows([]);
      setLoading(false);
      return;
    }
    const studentRows = Array.isArray(studentsRes.data) ? studentsRes.data : [];
    setRows(studentRows);

    if (!deadlinesRes.ok) {
      const local = readDeadlineFallback();
      const sampleWithDeadline = studentRows.find((row) => row && String((row.report_deadline || row.deadline) || '').trim());
      const inferredReport = String((sampleWithDeadline && (sampleWithDeadline.report_deadline || sampleWithDeadline.deadline)) || '').trim();
      const inCompatMode = isMissingDeadlineRouteError(deadlinesRes);
      setError(inCompatMode ? '' : (deadlinesRes.data && deadlinesRes.data.errors && deadlinesRes.data.errors[0]) || 'Unable to load document deadlines.');
      setDeadlines({
        report_deadline: String(local.report_deadline || inferredReport || '').trim(),
        memoire_deadline: String(local.memoire_deadline || '').trim(),
        updated_at: local.updated_at || null,
        updated_by: String(local.updated_by || '').trim()
      });
      setLoading(false);
      return;
    }

    setError('');
    const nextDeadlines = {
      report_deadline: String((deadlinesRes.data && deadlinesRes.data.report_deadline) || '').trim(),
      memoire_deadline: String((deadlinesRes.data && deadlinesRes.data.memoire_deadline) || '').trim(),
      updated_at: (deadlinesRes.data && deadlinesRes.data.updated_at) || null,
      updated_by: String((deadlinesRes.data && deadlinesRes.data.updated_by) || '').trim()
    };
    setDeadlines(nextDeadlines);
    writeDeadlineFallback(nextDeadlines);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onChange(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onAdd(ev) {
    ev.preventDefault();
    if (!form.user_email || !form.first_name || !form.last_name) {
      setError('Please fill in email, first name, and last name.');
      return;
    }
    const normalizedEmail = String(form.user_email || '').trim().toLowerCase();

    const r = await addStudent({
      user_email: normalizedEmail,
      student_id: form.student_id,
      first_name: form.first_name,
      last_name: form.last_name,
      level: form.level,
      speciality: form.speciality,
      phone: form.phone,
      registration_number: form.registration_number,
      department: form.department,
      academic_year: form.academic_year,
      project_title: form.project_title
    });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to add student.');
      return;
    }

    setError('');
    await load();
    setForm(emptyForm);
    setEditingEmail('');
  }

  function onEditRow(row) {
    if (!row || !row.user_email) return;
    setEditingEmail(row.user_email);
    setForm({
      user_email: row.user_email || '',
      student_id: row.student_id || '',
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      level: row.level || '',
      speciality: row.speciality || '',
      phone: row.phone || '',
      registration_number: row.registration_number || '',
      department: row.department || '',
      academic_year: row.academic_year || '',
      project_title: row.project_title || ''
    });
    setShowForm(true);
  }

  function onCancelEdit() {
    setEditingEmail('');
    setForm(emptyForm);
  }

  function onDeadlineChange(key, value) {
    setDeadlines((prev) => ({ ...prev, [key]: value }));
  }

  async function onSaveDeadlines() {
    if (savingDeadlines) return;
    const reportDeadline = String(deadlines.report_deadline || '').trim();
    const memoireDeadline = String(deadlines.memoire_deadline || '').trim();
    if (reportDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(reportDeadline)) {
      setError('Please provide a valid report deadline (YYYY-MM-DD).');
      return;
    }
    if (memoireDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(memoireDeadline)) {
      setError('Please provide a valid thesis deadline (YYYY-MM-DD).');
      return;
    }
    setSavingDeadlines(true);
    try {
      const r = await saveAdminDocumentDeadlines({
        report_deadline: reportDeadline,
        memoire_deadline: memoireDeadline
      });
      if (r.ok) {
        const nextDeadlines = {
          report_deadline: String((r.data && r.data.report_deadline) || '').trim(),
          memoire_deadline: String((r.data && r.data.memoire_deadline) || '').trim(),
          updated_at: (r.data && r.data.updated_at) || null,
          updated_by: String((r.data && r.data.updated_by) || '').trim()
        };
        setError('');
        setDeadlines(nextDeadlines);
        writeDeadlineFallback(nextDeadlines);
        await load();
        return;
      }

      if (!isMissingDeadlineRouteError(r)) {
        setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to save document deadlines.');
        return;
      }

      // Compatibility mode for old backends without /api/admin/document-deadlines:
      // - persist deadlines locally for student UI
      // - propagate report deadline to each student report record
      writeDeadlineFallback({
        report_deadline: reportDeadline,
        memoire_deadline: memoireDeadline,
        updated_by: 'compat-admin'
      });

      const targets = (Array.isArray(rows) ? rows : []).filter((row) => row && row.user_email);
      const results = await Promise.all(
        targets.map((row) =>
          saveReport({
            user_email: String(row.user_email || '').toLowerCase(),
            status: String((row.report_status || 'not_submitted')).toLowerCase() === 'submitted' ? 'submitted' : 'not_submitted',
            deadline: reportDeadline,
            report_url: String(row.report_url || '').trim(),
            memoire_url: String(row.memoire_url || '').trim()
          })
        )
      );
      const failed = results.reduce((sum, item) => sum + (item && item.ok ? 0 : 1), 0);

      setDeadlines({
        report_deadline: reportDeadline,
        memoire_deadline: memoireDeadline,
        updated_at: Date.now(),
        updated_by: 'compat-admin'
      });
      setError(failed ? `Saved in compatibility mode, but ${failed} student records failed to update.` : '');
      await load();
    } finally {
      setSavingDeadlines(false);
    }
  }

  async function onDelete(email) {
    if (!email) return;
    const ok = confirm(`Delete student ${email}?`);
    if (!ok) return;
    const r = await deleteStudent(email);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to delete student.');
      return;
    }
    setError('');
    await load();
  }

  if (selectedRow) {
    const names = inferNames(selectedRow);
    return (
      <div>
        <h2 className="title">Student details</h2>
        <p className="subtitle">All information for {show(names.first_name)} {show(names.last_name)}</p>

        <div className="toolbar">
          <button className="btn" type="button" onClick={() => setSelectedRow(null)}>
            Back to list
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => {
              onEditRow(selectedRow);
              setSelectedRow(null);
            }}
          >
            Edit
          </button>
        </div>

        <section className="student-account-shell" style={{ marginTop: 12 }}>
          <article className="student-account-card">
            <div className="student-account-grid">
              <div className="student-account-item">
                <span className="student-account-label">Email</span>
                <strong className="student-account-value">{show(selectedRow.user_email)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Account Name</span>
                <strong className="student-account-value">{show(selectedRow.account_name)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Student ID</span>
                <strong className="student-account-value">{show(selectedRow.student_id)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">First Name</span>
                <strong className="student-account-value">{show(names.first_name)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Last Name</span>
                <strong className="student-account-value">{show(names.last_name)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Level</span>
                <strong className="student-account-value">{show(selectedRow.level)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Speciality</span>
                <strong className="student-account-value">{show(selectedRow.speciality)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Phone</span>
                <strong className="student-account-value">{show(selectedRow.phone)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Registration Number</span>
                <strong className="student-account-value">{show(selectedRow.registration_number)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Department</span>
                <strong className="student-account-value">{show(selectedRow.department)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Academic Year</span>
                <strong className="student-account-value">{show(selectedRow.academic_year)}</strong>
              </div>
              <div className="student-account-item student-account-item-wide">
                <span className="student-account-label">Project Title</span>
                <strong className="student-account-value">{show(selectedRow.project_title)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Fiche PFE</span>
                <strong className="student-account-value">{fileLink(selectedRow.report_url, 'Open file')}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Memoire</span>
                <strong className="student-account-value">{fileLink(selectedRow.memoire_url, 'Open file')}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Report Deadline</span>
                <strong className="student-account-value">{show(deadlines.report_deadline)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Thesis Deadline</span>
                <strong className="student-account-value">{show(deadlines.memoire_deadline)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Advisor Name</span>
                <strong className="student-account-value">{show(selectedRow.advisor_name)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Advisor Email</span>
                <strong className="student-account-value">{show(selectedRow.advisor_email)}</strong>
              </div>
              <div className="student-account-item">
                <span className="student-account-label">Profile Status</span>
                <strong className="student-account-value">{Number(selectedRow.profile_completed) ? 'Completed' : 'Incomplete'}</strong>
              </div>
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h2 className="title">Students</h2>
      <p className="subtitle">Manage the students list and their information</p>
      <div className="admin-deadlines-panel">
        <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
          Global document deadlines
        </p>
        <div className="admin-deadline-grid">
          <div className="admin-deadline-card report">
            <div className="admin-deadline-head">
              <span className="admin-deadline-chip report">Report</span>
              <strong>Report deadline</strong>
            </div>
            <div className="field admin-deadline-field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                F
              </span>
              <input
                type="date"
                aria-label="Report deadline"
                value={deadlines.report_deadline}
                onChange={(e) => onDeadlineChange('report_deadline', e.target.value)}
              />
            </div>
          </div>
          <div className="admin-deadline-card memoire">
            <div className="admin-deadline-head">
              <span className="admin-deadline-chip memoire">Thesis</span>
              <strong>Thesis deadline</strong>
            </div>
            <div className="field admin-deadline-field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                M
              </span>
              <input
                type="date"
                aria-label="Thesis deadline"
                value={deadlines.memoire_deadline}
                onChange={(e) => onDeadlineChange('memoire_deadline', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <button className="primary" type="button" onClick={onSaveDeadlines} disabled={savingDeadlines}>
            {savingDeadlines ? 'Saving...' : 'Save deadlines for all students'}
          </button>
        </div>
        {deadlines.updated_at ? (
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Last update: {new Date(Number(deadlines.updated_at)).toLocaleString()}
          </p>
        ) : null}
      </div>
      <div className="toolbar">
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Hide form' : 'Add a student'}
        </button>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onAdd} style={{ marginTop: 12 }}>
          <div className="field">
            <span className="icon" aria-hidden="true">
              ✉️
            </span>
            <input
              placeholder="Email address"
              value={form.user_email}
              onChange={(e) => onChange('user_email', e.target.value)}
              readOnly={!!editingEmail}
            />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              🆔
            </span>
            <input placeholder="Student ID" value={form.student_id} onChange={(e) => onChange('student_id', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              👤
            </span>
            <input placeholder="Last name" value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              👤
            </span>
            <input placeholder="First name" value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              🎚️
            </span>
            <input placeholder="Level" value={form.level} onChange={(e) => onChange('level', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              📚
            </span>
            <input placeholder="Specialty" value={form.speciality} onChange={(e) => onChange('speciality', e.target.value)} />
          </div>
          <div className="field">
            <span className="icon" aria-hidden="true">
              📝
            </span>
            <input placeholder="Project title" value={form.project_title} onChange={(e) => onChange('project_title', e.target.value)} />
          </div>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <button className="primary" type="submit">
              {editingEmail ? 'Update' : 'Add'}
            </button>
            {editingEmail ? (
              <button className="btn" type="button" onClick={onCancelEdit}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}

      {error && <div className="errors">{error}</div>}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Student ID</th>
              <th>Last name</th>
              <th>First name</th>
              <th>Level</th>
              <th>Specialty</th>
              <th>Project title</th>
              <th>Report deadline</th>
              <th>Thesis deadline</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const names = inferNames(r);
              return (
                <tr
                  key={r.user_email || i}
                  onClick={() => setSelectedRow(r)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{r.user_email}</td>
                  <td>{r.student_id || ''}</td>
                  <td>{names.last_name}</td>
                  <td>{names.first_name}</td>
                  <td>{r.level}</td>
                  <td>{r.speciality}</td>
                  <td>{r.project_title}</td>
                  <td>{deadlines.report_deadline || '-'}</td>
                  <td>{deadlines.memoire_deadline || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEditRow(r);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDelete(r.user_email);
                        }}
                        aria-label={`Delete ${r.user_email}`}
                      >
                        x
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={10} style={{ padding: 14, color: 'var(--muted)' }}>
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



