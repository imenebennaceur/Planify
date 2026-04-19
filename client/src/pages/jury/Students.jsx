import React, { useEffect, useMemo, useState } from 'react';
import { listMySchedule, listMyStudents, saveEvaluation } from '../../lib/professorApi.js';
import DefenseCalendar from '../../components/calendar/DefenseCalendar.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function normalizeCalendarRow(row, role) {
  if (!row) return null;
  const defense_date = String(row.defense_date || '').trim();
  const defense_time = String(row.defense_time || '').trim();
  if (!defense_date || !defense_time) return null;
  return {
    student_email: String(row.student_email || '').trim(),
    student_name: String(row.student_name || '').trim(),
    project_title: String(row.project_title || '').trim(),
    defense_date,
    defense_time,
    defense_room: String(row.defense_room || '').trim(),
    role
  };
}

export default function JuryStudents({ teacherEmail }) {
  const { isFrench } = useLanguage();
  const [rows, setRows] = useState([]);
  const [calendarRows, setCalendarRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [view, setView] = useState('calendar');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = isFrench
    ? {
        title: 'Mes etudiants (jury)',
        subtitle: 'Liste simple pour preparer la soutenance et saisir la note jury.',
        loading: 'Chargement...',
        refresh: 'Actualiser',
        calendarTitle: 'Calendrier jury + encadrement',
        calendarSubtitle: 'Dates qui vous concernent comme jury et comme encadrant.',
        calendarEmpty: 'Aucune date trouvee pour vos roles jury/encadrement.',
        calendarTab: 'Calendrier',
        listTab: 'Liste jury',
        columns: ['Etudiant', 'Projet', 'Date', 'Heure', 'Salle', 'Encadrant(s)', 'Rapport', 'Memoire', 'Note', 'Action'],
        open: 'Ouvrir',
        gradeAction: 'Noter',
        noRows: 'Aucune affectation jury trouvee.',
        editorTitle: 'Notation jury',
        gradePlaceholder: 'Note / 20',
        commentPlaceholder: 'Commentaire jury...',
        save: 'Enregistrer',
        saving: 'Enregistrement...',
        close: 'Fermer',
        loadJuryError: 'Impossible de charger vos soutenances (jury).',
        loadSupCalendarError: 'Calendrier encadrement indisponible.',
        saveError: "Impossible d'enregistrer la note jury.",
        saved: 'Note jury enregistree.',
        invalidGrade: 'Veuillez saisir une note valide.'
      }
    : {
        title: 'My students (jury)',
        subtitle: 'Simple list to prepare each defense and enter jury grade.',
        loading: 'Loading...',
        refresh: 'Refresh',
        calendarTitle: 'Jury + supervision calendar',
        calendarSubtitle: 'Dates where you are involved as jury and as supervisor.',
        calendarEmpty: 'No date found for your jury/supervision roles.',
        calendarTab: 'Calendar',
        listTab: 'Jury list',
        columns: ['Student', 'Project', 'Date', 'Time', 'Room', 'Supervisor(s)', 'Report', 'Thesis', 'Grade', 'Action'],
        open: 'Open',
        gradeAction: 'Grade',
        noRows: 'No jury assignment found.',
        editorTitle: 'Jury grading',
        gradePlaceholder: 'Grade / 20',
        commentPlaceholder: 'Jury comment...',
        save: 'Save',
        saving: 'Saving...',
        close: 'Close',
        loadJuryError: 'Unable to load your jury defenses.',
        loadSupCalendarError: 'Supervision calendar is unavailable.',
        saveError: 'Unable to save jury grade.',
        saved: 'Jury grade saved.',
        invalidGrade: 'Please enter a valid grade.'
      };

  const selected = useMemo(() => rows.find((row) => row.student_email === selectedEmail) || null, [rows, selectedEmail]);

  async function load() {
    setLoading(true);
    const [juryRes, supScheduleRes] = await Promise.all([
      listMyStudents({ teacher_email: teacherEmail, role: 'jury' }),
      listMySchedule({ teacher_email: teacherEmail, role: 'supervisor' })
    ]);

    if (!juryRes.ok) {
      setError((juryRes.data && juryRes.data.errors && juryRes.data.errors[0]) || copy.loadJuryError);
      setRows([]);
      setCalendarRows([]);
      setCalendarError('');
      setLoading(false);
      return;
    }

    const juryRows = Array.isArray(juryRes.data) ? juryRes.data : [];
    const juryCalendar = juryRows.map((row) => normalizeCalendarRow(row, 'jury')).filter(Boolean);
    const supCalendarSource = supScheduleRes.ok && Array.isArray(supScheduleRes.data) ? supScheduleRes.data : [];
    const supCalendar = supCalendarSource.map((row) => normalizeCalendarRow(row, 'supervisor')).filter(Boolean);
    const mergedMap = new Map();

    [...juryCalendar, ...supCalendar].forEach((row) => {
      const key = `${row.student_email}|${row.defense_date}|${row.defense_time}|${row.defense_room}`;
      if (!mergedMap.has(key)) mergedMap.set(key, row);
    });

    const mergedCalendar = Array.from(mergedMap.values()).sort(
      (a, b) =>
        String(a.defense_date).localeCompare(String(b.defense_date)) ||
        String(a.defense_time).localeCompare(String(b.defense_time)) ||
        String(a.student_name || a.student_email).localeCompare(String(b.student_name || b.student_email))
    );

    if (!supScheduleRes.ok) {
      setCalendarError((supScheduleRes.data && supScheduleRes.data.errors && supScheduleRes.data.errors[0]) || copy.loadSupCalendarError);
    } else {
      setCalendarError('');
    }

    setError('');
    setRows(juryRows);
    setCalendarRows(mergedCalendar);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [teacherEmail, isFrench]);

  useEffect(() => {
    if (!selected) return;
    setGrade(selected.eval_grade === null || selected.eval_grade === undefined ? '' : String(selected.eval_grade));
    setComment(selected.eval_comment || '');
  }, [selected]);

  async function onSave() {
    if (!selected) return;
    const trimmedGrade = String(grade || '').trim();
    const parsed = trimmedGrade === '' ? null : Number(trimmedGrade);
    if (trimmedGrade !== '' && Number.isNaN(parsed)) {
      setError(copy.invalidGrade);
      return;
    }

    setSaving(true);
    const result = await saveEvaluation({
      student_email: selected.student_email,
      evaluator_email: teacherEmail,
      evaluator_role: 'jury',
      grade: parsed,
      comment
    });
    setSaving(false);

    if (!result.ok) {
      setError((result.data && result.data.errors && result.data.errors[0]) || copy.saveError);
      return;
    }

    setError('');
    await load();
    alert(copy.saved);
  }

  return (
    <div>
      <h2 className="title">{copy.title}</h2>
      <p className="subtitle">{copy.subtitle}</p>

      <div className="toolbar">
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? copy.loading : copy.refresh}
        </button>
      </div>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className={view === 'calendar' ? 'primary' : 'btn'} type="button" onClick={() => setView('calendar')}>
          {copy.calendarTab}
        </button>
        <button className={view === 'list' ? 'primary' : 'btn'} type="button" onClick={() => setView('list')}>
          {copy.listTab}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}
      {view === 'calendar' && calendarError && <div className="errors">{calendarError}</div>}

      {view === 'calendar' ? (
        <DefenseCalendar title={copy.calendarTitle} subtitle={copy.calendarSubtitle} rows={calendarRows} emptyText={copy.calendarEmpty} />
      ) : null}

      {view === 'list' ? (
        <>
          <div style={{ marginTop: 18, overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.columns[0]}</th>
                  <th>{copy.columns[1]}</th>
                  <th>{copy.columns[2]}</th>
                  <th>{copy.columns[3]}</th>
                  <th>{copy.columns[4]}</th>
                  <th>{copy.columns[5]}</th>
                  <th>{copy.columns[6]}</th>
                  <th>{copy.columns[7]}</th>
                  <th>{copy.columns[8]}</th>
                  <th style={{ width: 120 }}>{copy.columns[9]}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.student_email || index} style={{ background: selectedEmail === row.student_email ? 'var(--surface-select)' : undefined }}>
                    <td>{row.student_name || '-'}</td>
                    <td>{row.project_title || '-'}</td>
                    <td>{row.defense_date || '-'}</td>
                    <td>{row.defense_time || '-'}</td>
                    <td>{row.defense_room || '-'}</td>
                    <td>{Array.isArray(row.supervisors) && row.supervisors.length ? row.supervisors.join(', ') : '-'}</td>
                    <td>{row.report_url ? <a href={row.report_url} target="_blank" rel="noreferrer">{copy.open}</a> : '-'}</td>
                    <td>{row.memoire_url ? <a href={row.memoire_url} target="_blank" rel="noreferrer">{copy.open}</a> : '-'}</td>
                    <td>{row.eval_grade === null || row.eval_grade === undefined ? '-' : row.eval_grade}</td>
                    <td>
                      <button className="btn" type="button" onClick={() => setSelectedEmail(row.student_email)}>
                        {copy.gradeAction}
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && !loading && (
                  <tr>
                    <td colSpan={10} style={{ padding: 14, color: 'var(--muted)' }}>
                      {copy.noRows}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div style={{ marginTop: 16 }}>
              <h3 className="title" style={{ fontSize: 16, textAlign: 'left' }}>
                {copy.editorTitle} - {selected.student_name}
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
                    placeholder={copy.gradePlaceholder}
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
                    placeholder={copy.commentPlaceholder}
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
                  <button className="primary" type="button" onClick={onSave} disabled={saving}>
                    {saving ? copy.saving : copy.save}
                  </button>
                  <button className="btn" type="button" onClick={() => setSelectedEmail('')}>
                    {copy.close}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
