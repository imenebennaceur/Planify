import React, { useEffect, useMemo, useState } from 'react';
import DefenseCalendar from '../../components/calendar/DefenseCalendar.jsx';
import { getDefense, getDocumentDeadlines, getReport, getStudentProfile, listSupervisors } from '../../lib/studentApi.js';
import { readDeadlineFallback } from '../../lib/deadlineFallback.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function toIsoDay(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : '';
}

function parseTimeRange(value) {
  const raw = String(value || '').trim();
  const parts = raw
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 2) return { start: parts[0], end: parts[1] };
  if (parts.length === 1) return { start: parts[0], end: '' };
  return { start: '', end: '' };
}

function formatLongDate(value, locale) {
  const day = toIsoDay(value);
  if (!day) return '';
  const dateObj = new Date(day);
  if (Number.isNaN(dateObj.getTime())) return day;
  try {
    const text = dateObj.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return day;
  }
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const item of values) {
    const key = String(item || '').trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out;
}

export default function DefenseInfo({ email }) {
  const { isFrench, locale } = useLanguage();
  const copy = useMemo(
    () =>
      isFrench
        ? {
            loading: 'Chargement des informations de soutenance...',
            title: 'Informations de soutenance',
            subtitle: "Retrouvez tous les details planifies par l'administration.",
            scheduleTitle: 'Planning officiel',
            scheduleSubtitle: 'Date, heure, salle et details administratifs.',
            participantsTitle: 'Participants',
            participantsSubtitle: 'Encadrants et membres du jury associes a votre soutenance.',
            calendarTitle: 'Calendrier de soutenance',
            calendarSubtitle: 'Soutenance + deadlines rapport/memoire.',
            noDefense: 'Aucune soutenance planifiee pour le moment.',
            noSupervisor: 'Aucun encadrant assigne.',
            noJury: 'Aucun jury assigne.',
            date: 'Date',
            time: 'Heure',
            room: 'Salle',
            studentClass: 'Classe / niveau',
            project: 'Projet',
            reportDeadline: 'Deadline rapport',
            memoireDeadline: 'Deadline memoire',
            supervisors: 'Encadrants',
            juries: 'Jury',
            notSet: 'Non defini',
            loadDefenseError: 'Impossible de charger la soutenance.',
            loadParticipantsError: 'Impossible de charger les participants.',
            loadProfileError: 'Impossible de charger le profil etudiant.',
            loadDeadlineError: 'Impossible de charger les deadlines.'
          }
        : {
            loading: 'Loading defense information...',
            title: 'Defense Information',
            subtitle: 'See all details planned by administration.',
            scheduleTitle: 'Official schedule',
            scheduleSubtitle: 'Date, time, room, and administrative details.',
            participantsTitle: 'Participants',
            participantsSubtitle: 'Supervisors and jury members assigned to your defense.',
            calendarTitle: 'Defense calendar',
            calendarSubtitle: 'Defense date + report/thesis deadlines.',
            noDefense: 'No defense is scheduled yet.',
            noSupervisor: 'No supervisor assigned.',
            noJury: 'No jury assigned.',
            date: 'Date',
            time: 'Time',
            room: 'Room',
            studentClass: 'Class / level',
            project: 'Project',
            reportDeadline: 'Report deadline',
            memoireDeadline: 'Thesis deadline',
            supervisors: 'Supervisors',
            juries: 'Jury',
            notSet: 'Not set',
            loadDefenseError: 'Unable to load defense.',
            loadParticipantsError: 'Unable to load participants.',
            loadProfileError: 'Unable to load student profile.',
            loadDeadlineError: 'Unable to load deadlines.'
          },
    [isFrench]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [defense, setDefense] = useState(null);
  const [profile, setProfile] = useState(null);
  const [supervisorNames, setSupervisorNames] = useState([]);
  const [juryNames, setJuryNames] = useState([]);
  const [deadlines, setDeadlines] = useState({ report_deadline: '', memoire_deadline: '' });

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      const [defenseRes, participantsRes, profileRes, reportRes, deadlinesRes] = await Promise.allSettled([
        getDefense({ email }),
        listSupervisors({ student_email: email, role: 'all' }),
        getStudentProfile({ email }),
        getReport({ email }),
        getDocumentDeadlines()
      ]);

      if (!active) return;

      const d = defenseRes.status === 'fulfilled' ? defenseRes.value : { ok: false, data: { errors: [copy.loadDefenseError] } };
      const p = participantsRes.status === 'fulfilled' ? participantsRes.value : { ok: false, data: { errors: [copy.loadParticipantsError] } };
      const sp = profileRes.status === 'fulfilled' ? profileRes.value : { ok: false, data: { errors: [copy.loadProfileError] } };
      const r = reportRes.status === 'fulfilled' ? reportRes.value : { ok: false, data: { errors: [copy.loadDeadlineError] } };
      const dd = deadlinesRes.status === 'fulfilled' ? deadlinesRes.value : { ok: false, data: { errors: [copy.loadDeadlineError] } };

      if (d.ok) setDefense(d.data || null);
      else setDefense(null);

      if (sp.ok) setProfile(sp.data || null);
      else setProfile(null);

      const participants = p.ok && Array.isArray(p.data) ? p.data : [];
      const supervisors = unique(
        participants
          .filter((row) => String(row && row.role).toLowerCase() === 'supervisor')
          .map((row) => String((row && (row.teacher_name || row.teacher_email)) || '').trim())
      );
      const juryFromAssignments = unique(
        participants
          .filter((row) => String(row && row.role).toLowerCase() === 'jury')
          .map((row) => String((row && (row.teacher_name || row.teacher_email)) || '').trim())
      );
      const juryFromDefense = unique(splitCsv(d && d.ok && d.data ? d.data.jury : ''));
      setSupervisorNames(supervisors);
      setJuryNames(unique([...juryFromAssignments, ...juryFromDefense]));

      const globalReportDeadline = String((dd.data && dd.data.report_deadline) || '').trim();
      const globalMemoireDeadline = String((dd.data && dd.data.memoire_deadline) || '').trim();
      const reportPayloadDeadline = String((r.data && (r.data.report_deadline || r.data.deadline)) || '').trim();
      const reportPayloadMemoireDeadline = String((r.data && r.data.memoire_deadline) || '').trim();
      const fallbackDeadlines = readDeadlineFallback();
      const fallbackReportDeadline = String((fallbackDeadlines && fallbackDeadlines.report_deadline) || '').trim();
      const fallbackMemoireDeadline = String((fallbackDeadlines && fallbackDeadlines.memoire_deadline) || '').trim();

      setDeadlines({
        report_deadline: globalReportDeadline || reportPayloadDeadline || fallbackReportDeadline,
        memoire_deadline: globalMemoireDeadline || reportPayloadMemoireDeadline || fallbackMemoireDeadline
      });

      const errors = [];
      if (!d.ok) errors.push((d.data && d.data.errors && d.data.errors[0]) || copy.loadDefenseError);
      if (!p.ok) errors.push((p.data && p.data.errors && p.data.errors[0]) || copy.loadParticipantsError);
      if (!sp.ok) errors.push((sp.data && sp.data.errors && sp.data.errors[0]) || copy.loadProfileError);
      if (!dd.ok && !r.ok && !fallbackReportDeadline && !fallbackMemoireDeadline) {
        errors.push((dd.data && dd.data.errors && dd.data.errors[0]) || copy.loadDeadlineError);
      }
      setError(errors.filter(Boolean).slice(0, 1).join('\n'));
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [copy.loadDeadlineError, copy.loadDefenseError, copy.loadParticipantsError, copy.loadProfileError, email]);

  const defenseDay = toIsoDay(defense && defense.date);
  const time = parseTimeRange(defense && defense.time);
  const classLabel =
    [String((profile && profile.level) || '').trim(), String((profile && profile.speciality) || '').trim()].filter(Boolean).join(' - ') || copy.notSet;
  const projectLabel = String((profile && profile.project_title) || '').trim() || copy.notSet;

  const displayDate = defenseDay ? formatLongDate(defenseDay, locale) : copy.notSet;
  const displayTime = time.start ? `${time.start}${time.end ? ` - ${time.end}` : ''}` : copy.notSet;
  const displayRoom = String((defense && defense.classroom) || '').trim() || copy.notSet;
  const reportDeadline = toIsoDay(deadlines && deadlines.report_deadline) || copy.notSet;
  const memoireDeadline = toIsoDay(deadlines && deadlines.memoire_deadline) || copy.notSet;

  const calendarRows = useMemo(() => {
    if (!defenseDay) return [];
    return [
      {
        defense_date: defenseDay,
        defense_time: String((defense && defense.time) || '').trim(),
        defense_room: String((defense && defense.classroom) || '').trim(),
        student_name: isFrench ? 'Ma soutenance' : 'My defense',
        project_title: String((profile && profile.project_title) || '').trim()
      }
    ];
  }, [defense && defense.classroom, defense && defense.time, defenseDay, isFrench, profile && profile.project_title]);

  const calendarMarkers = useMemo(() => {
    const rows = [];
    const reportDay = toIsoDay(deadlines && deadlines.report_deadline);
    const memoireDay = toIsoDay(deadlines && deadlines.memoire_deadline);
    if (reportDay) rows.push({ day: reportDay, kind: 'report_deadline', label: copy.reportDeadline });
    if (memoireDay) rows.push({ day: memoireDay, kind: 'memoire_deadline', label: copy.memoireDeadline });
    return rows;
  }, [copy.memoireDeadline, copy.reportDeadline, deadlines && deadlines.memoire_deadline, deadlines && deadlines.report_deadline]);

  const calendarLabelOverrides = useMemo(
    () => ({
      defensesCountTitle: (count) => (isFrench ? `${count} date(s) importante(s)` : `${count} important date(s)`),
      monthSummary: (count) => (isFrench ? `${count} evenement(s) ce mois` : `${count} event(s) this month`),
      allDates: (count) => (isFrench ? `Toutes les dates (${count})` : `All dates (${count})`),
      dayDefenses: (count) => (isFrench ? `${count} evenement(s)` : `${count} event(s)`),
      group: isFrench ? 'Element' : 'Item',
      noDateInList: isFrench ? 'Aucune date planifiee.' : 'No date scheduled.',
      emptyTextDefault: isFrench ? 'Aucune date planifiee.' : 'No date scheduled.'
    }),
    [isFrench]
  );

  if (loading) return <p className="subtitle">{copy.loading}</p>;

  return (
    <section className="student-defense-shell">
      <header className="student-defense-head">
        <h2 className="title student-defense-title">{copy.title}</h2>
        <p className="student-defense-subtitle">{copy.subtitle}</p>
      </header>

      {error ? <div className="errors">{error}</div> : null}

      <div className="student-defense-grid">
        <article className="glass-card student-defense-card">
          <header className="glass-card-header">
            <h3 className="glass-card-title">{copy.scheduleTitle}</h3>
          </header>
          <p className="glass-card-sub">{copy.scheduleSubtitle}</p>
          {!defenseDay ? (
            <p className="glass-card-sub">{copy.noDefense}</p>
          ) : (
            <div className="student-defense-kv">
              <div className="student-defense-kv-row">
                <span>{copy.date}</span>
                <strong>{displayDate}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.time}</span>
                <strong>{displayTime}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.room}</span>
                <strong>{displayRoom}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.studentClass}</span>
                <strong>{classLabel}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.project}</span>
                <strong>{projectLabel}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.reportDeadline}</span>
                <strong>{reportDeadline}</strong>
              </div>
              <div className="student-defense-kv-row">
                <span>{copy.memoireDeadline}</span>
                <strong>{memoireDeadline}</strong>
              </div>
            </div>
          )}
        </article>

        <article className="glass-card student-defense-card">
          <header className="glass-card-header">
            <h3 className="glass-card-title">{copy.participantsTitle}</h3>
          </header>
          <p className="glass-card-sub">{copy.participantsSubtitle}</p>

          <div className="student-defense-members">
            <div className="student-defense-members-group">
              <h4>{copy.supervisors}</h4>
              {supervisorNames.length ? (
                <ul>
                  {supervisorNames.map((name) => (
                    <li key={`sup-${name}`}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p>{copy.noSupervisor}</p>
              )}
            </div>

            <div className="student-defense-members-group">
              <h4>{copy.juries}</h4>
              {juryNames.length ? (
                <ul>
                  {juryNames.map((name) => (
                    <li key={`jury-${name}`}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p>{copy.noJury}</p>
              )}
            </div>
          </div>
        </article>
      </div>

      <article className="glass-card student-defense-card">
        <header className="glass-card-header">
          <h3 className="glass-card-title">{copy.calendarTitle}</h3>
        </header>
        <p className="glass-card-sub">{copy.calendarSubtitle}</p>
        <DefenseCalendar
          title={copy.calendarTitle}
          subtitle={copy.calendarSubtitle}
          rows={calendarRows}
          markers={calendarMarkers}
          emptyText={copy.noDefense}
          labelOverrides={calendarLabelOverrides}
          className="student-defense-calendar"
        />
      </article>
    </section>
  );
}
