import React, { useEffect, useState } from 'react';
import { listMyStudents } from '../../lib/professorApi.js';
import { listNotifications } from '../../lib/notificationsApi.js';
import DefenseCalendar from '../../components/calendar/DefenseCalendar.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function parseTimeStart(v) {
  const raw = String(v || '').trim();
  if (!raw) return '00:00';
  const first = raw.split('-')[0] || raw;
  const hhmm = first.trim();
  return /^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm : '00:00';
}

function parseDateTime(day, timeRange) {
  const d = String(day || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = parseTimeStart(timeRange);
  const date = new Date(`${d}T${t}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(day, locale) {
  const date = parseDateTime(day, '00:00');
  if (!date) return String(day || '-');
  try {
    return date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(day || '-');
  }
}

function formatTimestamp(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const ms = n < 1000000000000 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(locale);
  } catch {
    return d.toLocaleString();
  }
}

function daysUntil(day) {
  const date = parseDateTime(day, '00:00');
  if (!date) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startTarget - startToday) / (24 * 60 * 60 * 1000));
}

function roleLabel(role, isFrench) {
  if (role === 'jury') return 'Jury';
  return isFrench ? 'Encadrement' : 'Supervision';
}

function roleTone(role) {
  return role === 'jury'
    ? { bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.45)', color: '#92400e' }
    : { bg: 'rgba(37, 99, 235, 0.16)', border: 'rgba(37, 99, 235, 0.45)', color: '#1e3a8a' };
}

export default function ProfDashboard({ teacherEmail }) {
  const { isFrench, locale } = useLanguage();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [reportAlerts, setReportAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [supervisorCalendarRows, setSupervisorCalendarRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const labels = isFrench
    ? {
        title: 'Tableau de bord professeur',
        account: 'Compte',
        loading: 'Chargement...',
        refresh: 'Actualiser',
        updatedAt: 'Mis a jour',
        calendarTitle: 'Calendrier encadrement',
        calendarSubtitle: 'Dates de soutenance des etudiants que vous encadrez.',
        calendarEmpty: 'Aucune soutenance encadree planifiee pour le moment.',
        upcoming: 'Prochaines soutenances',
        noUpcoming: 'Aucune soutenance a venir.',
        supervised: 'Etudiants encadres',
        juryAssignments: 'Affectations jury',
        scheduled: 'Soutenances planifiees',
        pendingReports: 'Rapports en attente',
        overdueReports: 'Rapports en retard',
        enteredGrades: 'Evaluations saisies',
        reportAlerts: 'Alertes rapports',
        noPendingReports: 'Aucun rapport en attente.',
        noDeadline: 'Sans date limite',
        overdue: (d) => `En retard (${Math.abs(d)}j)`,
        dueToday: "Echeance aujourd'hui",
        dayLeft: (d) => `J-${d}`,
        deadline: 'Deadline',
        status: 'Statut',
        recentNotifications: 'Notifications recentes',
        noRecentNotifications: 'Aucune notification recente.',
        notification: 'Notification'
      }
    : {
        title: 'Professor Dashboard',
        account: 'Account',
        loading: 'Loading...',
        refresh: 'Refresh',
        updatedAt: 'Updated at',
        calendarTitle: 'Supervision calendar',
        calendarSubtitle: 'Defense dates for students you supervise.',
        calendarEmpty: 'No supervised defense is currently scheduled.',
        upcoming: 'Upcoming defenses',
        noUpcoming: 'No upcoming defense.',
        supervised: 'Supervised students',
        juryAssignments: 'Jury assignments',
        scheduled: 'Scheduled defenses',
        pendingReports: 'Pending reports',
        overdueReports: 'Overdue reports',
        enteredGrades: 'Entered evaluations',
        reportAlerts: 'Report alerts',
        noPendingReports: 'No pending report.',
        noDeadline: 'No deadline',
        overdue: (d) => `Overdue (${Math.abs(d)}d)`,
        dueToday: 'Due today',
        dayLeft: (d) => `D-${d}`,
        deadline: 'Deadline',
        status: 'Status',
        recentNotifications: 'Recent notifications',
        noRecentNotifications: 'No recent notification.',
        notification: 'Notification'
      };

  async function load() {
    setLoading(true);

    const [supRes, juryRes, notifRes] = await Promise.all([
      listMyStudents({ teacher_email: teacherEmail, role: 'supervisor' }),
      listMyStudents({ teacher_email: teacherEmail, role: 'jury' }),
      listNotifications({ email: teacherEmail, limit: 30 })
    ]);

    if (!supRes.ok) {
      setError(
        (supRes.data && supRes.data.errors && supRes.data.errors[0]) ||
          (isFrench ? 'Impossible de charger vos etudiants encadres.' : 'Unable to load your supervised students.')
      );
      setStats(null);
      setUpcoming([]);
      setReportAlerts([]);
      setNotifications([]);
      setLoading(false);
      return;
    }
    if (!juryRes.ok) {
      setError(
        (juryRes.data && juryRes.data.errors && juryRes.data.errors[0]) ||
          (isFrench ? 'Impossible de charger vos affectations jury.' : 'Unable to load your jury assignments.')
      );
      setStats(null);
      setUpcoming([]);
      setReportAlerts([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const supRows = Array.isArray(supRes.data) ? supRes.data : [];
    const juryRows = Array.isArray(juryRes.data) ? juryRes.data : [];
    const notifRows = notifRes.ok && Array.isArray(notifRes.data) ? notifRes.data : [];

    const scheduledSup = supRows.filter((r) => r.defense_date && r.defense_time).length;
    const scheduledJury = juryRows.filter((r) => r.defense_date && r.defense_time).length;
    const submittedReports = supRows.filter((r) => String(r.report_status || 'not_submitted') === 'submitted').length;
    const pendingReports = supRows.length - submittedReports;
    const evaluated = supRows.filter((r) => r.eval_grade !== null && r.eval_grade !== undefined).length;

    const pendingWithDeadline = supRows
      .filter((r) => String(r.report_status || 'not_submitted') !== 'submitted')
      .map((r) => ({
        ...r,
        daysRemaining: daysUntil(r.report_deadline)
      }));

    const overdueReports = pendingWithDeadline.filter((r) => r.daysRemaining !== null && r.daysRemaining < 0).length;
    const dueSoon = pendingWithDeadline.filter((r) => r.daysRemaining !== null && r.daysRemaining >= 0 && r.daysRemaining <= 7).length;

    const allDefenses = [...supRows.map((r) => ({ ...r, _role: 'supervisor' })), ...juryRows.map((r) => ({ ...r, _role: 'jury' }))]
      .filter((r) => r.defense_date && r.defense_time)
      .map((r) => ({
        role: r._role,
        student_email: r.student_email,
        student_name: r.student_name,
        project_title: r.project_title,
        defense_date: r.defense_date,
        defense_time: r.defense_time,
        defense_room: r.defense_room,
        sortDate: parseDateTime(r.defense_date, r.defense_time)
      }))
      .sort((a, b) => {
        const ta = a.sortDate ? a.sortDate.getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.sortDate ? b.sortDate.getTime() : Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return String(a.student_name || '').localeCompare(String(b.student_name || ''));
      });

    const now = Date.now();
    const nextDefenses = allDefenses.filter((r) => (r.sortDate ? r.sortDate.getTime() >= now - 60 * 60 * 1000 : true)).slice(0, 8);
    const supervisorOnly = supRows
      .filter((r) => r.defense_date && r.defense_time)
      .map((r) => ({
        student_email: r.student_email,
        student_name: r.student_name,
        project_title: r.project_title,
        defense_date: r.defense_date,
        defense_time: r.defense_time,
        defense_room: r.defense_room
      }));

    const prioritizedAlerts = pendingWithDeadline
      .slice()
      .sort((a, b) => {
        const ad = a.daysRemaining;
        const bd = b.daysRemaining;
        if (ad === null && bd === null) return String(a.student_name || '').localeCompare(String(b.student_name || ''));
        if (ad === null) return 1;
        if (bd === null) return -1;
        return ad - bd;
      })
      .slice(0, 8);

    const unreadCount = notifRows.reduce((sum, n) => sum + (n && !n.read_at ? 1 : 0), 0);
    const latestNotifs = notifRows.slice(0, 4);

    setError(notifRes.ok ? '' : isFrench ? 'Statistiques chargees, mais notifications indisponibles.' : 'Statistics loaded, but notifications are unavailable.');
    setStats({
      supervised: supRows.length,
      jury: juryRows.length,
      pendingReports,
      submittedReports,
      scheduledSup,
      scheduledJury,
      evaluated,
      overdueReports,
      dueSoon,
      unreadCount
    });
    setUpcoming(nextDefenses);
    setReportAlerts(prioritizedAlerts);
    setNotifications(latestNotifs);
    setSupervisorCalendarRows(supervisorOnly);
    setUpdatedAt(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [teacherEmail]);

  return (
    <div className="prof-dashboard">
      <h2 className="title">{labels.title}</h2>
      <p className="subtitle">
        {labels.account}: {teacherEmail}
      </p>

      <div className="toolbar">
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? labels.loading : labels.refresh}
        </button>
        {updatedAt ? (
          <span className="subtitle" style={{ margin: 0, alignSelf: 'center' }}>
            {labels.updatedAt}: {new Date(updatedAt).toLocaleTimeString(locale)}
          </span>
        ) : null}
      </div>

      {error && <div className="errors">{error}</div>}

      <DefenseCalendar
        className="prof-section prof-calendar"
        title={labels.calendarTitle}
        subtitle={labels.calendarSubtitle}
        rows={supervisorCalendarRows}
        emptyText={labels.calendarEmpty}
      />

      <section className="stat-card prof-box prof-section prof-upcoming" style={{ padding: 14, marginTop: 18 }}>
        <h3 className="title" style={{ fontSize: 16, textAlign: 'left', marginBottom: 8 }}>
          {labels.upcoming}
        </h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {!upcoming.length && (
            <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
              {labels.noUpcoming}
            </p>
          )}
          {upcoming.map((r, idx) => {
            const tone = roleTone(r.role);
            return (
              <div key={`${r.role}-${r.student_email || idx}-${r.defense_date}-${r.defense_time || ''}`} className="prof-inline-box" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong className="prof-inline-name" style={{ fontSize: 13 }}>
                    {r.student_name || r.student_email}
                  </strong>
                  <span
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${tone.border}`,
                      background: tone.bg,
                      color: tone.color,
                      fontWeight: 800,
                      fontSize: 11,
                      padding: '2px 8px'
                    }}
                  >
                    {roleLabel(r.role, isFrench)}
                  </span>
                </div>
                <p className="prof-inline-meta" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {formatDay(r.defense_date, locale)} - {r.defense_time || '--:--'} {r.defense_room ? `- ${r.defense_room}` : ''}
                </p>
                {r.project_title ? (
                  <p className="prof-inline-meta" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    {r.project_title}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.supervised}</p>
          <p className="stat-value">{stats ? stats.supervised : 0}</p>
        </div>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.juryAssignments}</p>
          <p className="stat-value">{stats ? stats.jury : 0}</p>
        </div>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.scheduled}</p>
          <p className="stat-value">{stats ? `${stats.scheduledSup} / ${stats.scheduledJury}` : '0 / 0'}</p>
        </div>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.pendingReports}</p>
          <p className="stat-value">{stats ? stats.pendingReports : 0}</p>
        </div>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.overdueReports}</p>
          <p className="stat-value">{stats ? stats.overdueReports : 0}</p>
        </div>
        <div className="stat-card prof-box prof-stat-card">
          <p className="stat-label">{labels.enteredGrades}</p>
          <p className="stat-value">{stats ? stats.evaluated : 0}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 18 }}>
        <section className="stat-card prof-box prof-section prof-alerts" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, textAlign: 'left', marginBottom: 8 }}>
            {labels.reportAlerts}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {!reportAlerts.length && (
              <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
                {labels.noPendingReports}
              </p>
            )}
            {reportAlerts.map((r, idx) => {
              const d = r.daysRemaining;
              const badge =
                d === null ? labels.noDeadline : d < 0 ? labels.overdue(d) : d === 0 ? labels.dueToday : labels.dayLeft(d);
              const isLate = d !== null && d < 0;
              const isSoon = d !== null && d >= 0 && d <= 7;
              const tone = isLate
                ? { bg: 'rgba(220, 38, 38, 0.14)', border: 'rgba(220, 38, 38, 0.36)', color: '#991b1b' }
                : isSoon
                  ? { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.36)', color: '#92400e' }
                  : { bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.36)', color: '#334155' };

              return (
                <div
                  key={`${r.student_email || idx}-${r.report_deadline || ''}`}
                  className="prof-inline-box"
                  style={{ padding: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong className="prof-inline-name" style={{ fontSize: 13 }}>
                      {r.student_name || r.student_email}
                    </strong>
                    <span
                      style={{
                        borderRadius: 999,
                        border: `1px solid ${tone.border}`,
                        background: tone.bg,
                        color: tone.color,
                        fontWeight: 800,
                        fontSize: 11,
                        padding: '2px 8px'
                      }}
                    >
                      {badge}
                    </span>
                  </div>
                  <p className="prof-inline-meta" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    {labels.deadline}: {r.report_deadline || '-'} - {labels.status}: {r.report_status || 'not_submitted'}
                  </p>
                  {r.project_title ? (
                    <p className="prof-inline-meta" style={{ margin: '4px 0 0', fontSize: 12 }}>
                      {r.project_title}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="stat-card prof-box prof-section prof-notifs" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, textAlign: 'left', marginBottom: 8 }}>
            {labels.recentNotifications}
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {!notifications.length && (
              <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
                {labels.noRecentNotifications}
              </p>
            )}
            {notifications.map((n, idx) => (
              <div
                key={`${n.delivery_id || idx}-${n.created_at || ''}`}
                className="prof-inline-box"
                style={{
                  background: n && !n.read_at ? 'var(--surface-unread)' : 'var(--surface-soft)',
                  padding: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong className="prof-inline-name" style={{ fontSize: 13 }}>
                    {n.title || labels.notification}
                  </strong>
                  <span className="prof-inline-time" style={{ fontSize: 11 }}>
                    {formatTimestamp(n.created_at, locale)}
                  </span>
                </div>
                <p className="prof-inline-meta" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {n.message || ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
