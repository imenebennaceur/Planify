import React, { useEffect, useState } from 'react';
import { listMySchedule } from '../../lib/professorApi.js';

export default function ProfSchedule({ teacherEmail }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await listMySchedule({ teacher_email: teacherEmail, role: 'supervisor' });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load schedule.');
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

  return (
    <div>
      <h2 className="title">My defense schedule</h2>
      <p className="subtitle">View dates, rooms, and participants</p>
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
              <th>Date</th>
              <th>Time</th>
              <th>Room</th>
              <th>Student</th>
              <th>Supervisors</th>
              <th>Jury</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.student_email || i}-${r.defense_date}-${r.defense_time || ''}`}>
                <td>{r.defense_date}</td>
                <td>{r.defense_time || ''}</td>
                <td>{r.defense_room || ''}</td>
                <td>{r.student_name}</td>
                <td>{Array.isArray(r.supervisors) ? r.supervisors.join(', ') : r.supervisors}</td>
                <td>{Array.isArray(r.juries) ? r.juries.join(', ') : r.juries}</td>
                <td>{r.project_title || ''}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: 'var(--muted)' }}>
                  No schedule found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

