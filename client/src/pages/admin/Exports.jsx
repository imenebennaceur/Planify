import React, { useEffect, useState } from 'react';
import { listEvaluations, listExportHistory, listGrades, listReports, listSchedule, listStudents, listTeachers, logExport } from '../../lib/adminApi.js';

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function makeCsv(headers, rows) {
  const sep = ';';
  const lines = [];
  lines.push(headers.map(csvEscape).join(sep));
  for (const r of rows) lines.push(r.map(csvEscape).join(sep));
  // BOM for Excel + UTF-8
  return '\ufeff' + lines.join('\r\n');
}

function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openPrintTable({ title, headers, rows }) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert('Popup blocked by your browser. Allow popups and try again.');
    return;
  }
  const now = new Date().toLocaleString();
  const thead = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 6px; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
        @media print {
          body { padding: 0; }
          .meta { margin-bottom: 10px; }
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Generated on ${escapeHtml(now)} — use “Print” then “Save as PDF”.</div>
      <table>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
      <script>
        setTimeout(() => { try { window.focus(); window.print(); } catch (e) {} }, 200);
      </script>
    </body>
  </html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default function AdminExports({ adminEmail }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    const r = await listExportHistory(12);
    if (r.ok) setHistory(Array.isArray(r.data) ? r.data : []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function registerExport(type, filePath) {
    await logExport({ type, file_path: filePath, generated_by: adminEmail || '' });
    await loadHistory();
  }

  async function exportSchedule(kind) {
    setBusy(`schedule:${kind}`);
    const r = await listSchedule();
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load schedule.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Date', 'Time', 'Room', 'Student', 'Email', 'Supervisors', 'Juries', 'Title'];
    const data = rows.map((x) => [
      x.day || '',
      x.time || '',
      x.room || '',
      x.student || '',
      x.student_email || '',
      Array.isArray(x.supervisors) ? x.supervisors.join(', ') : x.supervisors || '',
      Array.isArray(x.juries) ? x.juries.join(', ') : x.juries || '',
      x.title || ''
    ]);
    if (kind === 'csv') {
      downloadText('defense_schedule.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
      await registerExport('schedule_csv', 'defense_schedule.csv');
    } else {
      openPrintTable({ title: 'Full defense schedule', headers, rows: data });
      await registerExport('schedule_pdf', 'print:defense_schedule');
    }
  }

  async function exportStudents(kind) {
    setBusy(`students:${kind}`);
    const r = await listStudents();
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load students.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Email', 'Student ID', 'Last name', 'First name', 'Level', 'Specialty', 'Project title'];
    const data = rows.map((x) => [
      x.user_email || '',
      x.student_id || '',
      x.last_name || '',
      x.first_name || '',
      x.level || '',
      x.speciality || '',
      x.project_title || ''
    ]);
    if (kind === 'csv') {
      downloadText('students_list.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
      await registerExport('students_csv', 'students_list.csv');
    } else {
      openPrintTable({ title: 'Students list', headers, rows: data });
      await registerExport('students_pdf', 'print:students_list');
    }
  }

  async function exportTeachers(kind) {
    setBusy(`teachers:${kind}`);
    const r = await listTeachers();
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load professors.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Email', 'Staff ID', 'Last name', 'First name', 'Specialty'];
    const data = rows.map((x) => [
      x.user_email || '',
      x.teacher_id || '',
      x.last_name || '',
      x.first_name || '',
      x.speciality || ''
    ]);
    if (kind === 'csv') {
      downloadText('professors_juries.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
      await registerExport('teachers_csv', 'professors_juries.csv');
    } else {
      openPrintTable({ title: 'Professors / juries list', headers, rows: data });
      await registerExport('teachers_pdf', 'print:professors_juries');
    }
  }

  async function exportReports(kind) {
    setBusy(`reports:${kind}`);
    const r = await listReports('all');
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load reports.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Student', 'Email', 'Status', 'Deadline', 'Report URL', 'Thesis URL', 'Defense'];
    const data = rows.map((x) => [
      x.student_name || '',
      x.student_email || '',
      x.status === 'submitted' ? 'Submitted' : 'Not submitted',
      x.deadline || '',
      x.report_url || '',
      x.memoire_url || '',
      [x.defense_date, x.defense_time, x.defense_room].filter(Boolean).join(' — ')
    ]);
    if (kind === 'csv') {
      downloadText('reports.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
      await registerExport('reports_csv', 'reports.csv');
    } else {
      openPrintTable({ title: 'Reports', headers, rows: data });
      await registerExport('reports_pdf', 'print:reports');
    }
  }

  async function exportGrades(kind) {
    setBusy(`grades:${kind}`);
    const r = await listGrades();
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load grades.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Student', 'Email', 'Average', 'Grades count', 'Category'];
    const label = (b) =>
      b === 'tresBien'
        ? 'Excellent'
        : b === 'bien'
          ? 'Good'
          : b === 'assezBien'
            ? 'Fairly good'
            : b === 'passable'
              ? 'Pass'
              : b === 'insuffisant'
                ? 'Fail'
                : '-';
    const data = rows.map((x) => [
      x.student_name || '',
      x.student_email || '',
      x.avg_grade === null || x.avg_grade === undefined ? '' : Number(x.avg_grade).toFixed(2),
      x.grades_count || 0,
      label(x.bucket)
    ]);
    if (kind === 'csv') {
      downloadText('grades_averages.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
      await registerExport('grades_csv', 'grades_averages.csv');
    } else {
      openPrintTable({ title: 'Grades — averages per student', headers, rows: data });
      await registerExport('grades_pdf', 'print:grades_averages');
    }
  }

  async function exportEvaluationsCsv() {
    setBusy('evaluations:csv');
    const r = await listEvaluations();
    setBusy('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load evaluations.');
      return;
    }
    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const headers = ['Student (email)', 'Evaluator (email)', 'Role', 'Grade', 'Comment', 'Updated at'];
    const data = rows.map((x) => [
      x.student_email || '',
      x.evaluator_email || '',
      x.evaluator_role || '',
      x.grade === null || x.grade === undefined ? '' : x.grade,
      x.comment || '',
      x.updated_at ? new Date(Number(x.updated_at)).toLocaleString() : ''
    ]);
    downloadText('evaluations.csv', makeCsv(headers, data), 'text/csv;charset=utf-8');
    await registerExport('evaluations_csv', 'evaluations.csv');
  }

  const disabled = !!busy;

  return (
    <div>
      <h2 className="title">Export (PDF / Excel)</h2>
      <p className="subtitle">Export data: defenses, full schedule, grades, professors/juries, and students</p>

      {error && <div className="errors">{error}</div>}

      <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Schedule / defenses
          </p>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => exportSchedule('csv')} disabled={disabled}>
              Excel (CSV)
            </button>
            <button className="btn" type="button" onClick={() => exportSchedule('pdf')} disabled={disabled}>
              PDF (Print)
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Grades
          </p>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => exportGrades('csv')} disabled={disabled}>
              Averages (CSV)
            </button>
            <button className="btn" type="button" onClick={() => exportGrades('pdf')} disabled={disabled}>
              Averages (PDF)
            </button>
            <button className="btn" type="button" onClick={exportEvaluationsCsv} disabled={disabled}>
              Evaluations details (CSV)
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Students
          </p>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => exportStudents('csv')} disabled={disabled}>
              Excel (CSV)
            </button>
            <button className="btn" type="button" onClick={() => exportStudents('pdf')} disabled={disabled}>
              PDF (Print)
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Professors / juries
          </p>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => exportTeachers('csv')} disabled={disabled}>
              Excel (CSV)
            </button>
            <button className="btn" type="button" onClick={() => exportTeachers('pdf')} disabled={disabled}>
              PDF (Print)
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Reports
          </p>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => exportReports('csv')} disabled={disabled}>
              Excel (CSV)
            </button>
            <button className="btn" type="button" onClick={() => exportReports('pdf')} disabled={disabled}>
              PDF (Print)
            </button>
          </div>
        </div>
      </div>

      {busy && (
        <p className="subtitle" style={{ textAlign: 'left', marginTop: 12 }}>
          Export in progress...
        </p>
      )}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>File / Target</th>
              <th>Generated at</th>
              <th>Generated by</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{row.type || '-'}</td>
                <td>{row.file_path || '-'}</td>
                <td>{row.generated_at ? new Date(Number(row.generated_at)).toLocaleString() : '-'}</td>
                <td>{row.generated_by || '-'}</td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td colSpan={4} style={{ padding: 14, color: 'var(--muted)' }}>
                  No export history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
