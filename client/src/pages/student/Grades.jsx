import React, { useEffect, useMemo, useState } from 'react';
import { getStudentFinalGrade } from '../../lib/studentApi.js';
import { listNotifications } from '../../lib/notificationsApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '-';
  }
}

function isGradeNotification(row) {
  const text = `${String((row && row.title) || '')} ${String((row && row.message) || '')}`.toLowerCase();
  return (
    text.includes('final grade') ||
    text.includes('grade published') ||
    text.includes('note finale') ||
    text.includes('note publiee') ||
    text.includes('grade finale')
  );
}

export default function StudentGrades({ email, onOpenNotifications }) {
  const { isFrench } = useLanguage();
  const copy = isFrench
    ? {
        title: 'Mes notes',
        subtitle: 'Consultez vos notes encadrant, jury, la note finale et les alertes associees.',
        loading: 'Chargement...',
        refresh: 'Actualiser',
        finalGradeTitle: 'Note finale',
        supervisorGrade: 'Note encadrant',
        juryGrade: 'Note jury',
        finalPending: 'La note finale attend la publication administrateur.',
        notPublished: 'La note finale n’est pas encore publiee.',
        published: 'Publiee',
        alertsTitle: 'Alertes de note',
        noAlerts: 'Aucune alerte de note pour le moment.',
        openNotifications: 'Voir toutes les notifications',
        loadError: 'Impossible de charger les notes.'
      }
    : {
        title: 'My grades',
        subtitle: 'See your supervisor grade, jury grade, final grade, and related alerts.',
        loading: 'Loading...',
        refresh: 'Refresh',
        finalGradeTitle: 'Final grade',
        supervisorGrade: 'Supervisor grade',
        juryGrade: 'Jury grade',
        finalPending: 'Final grade is waiting for administrator publication.',
        notPublished: 'Final grade is not published yet.',
        published: 'Published',
        alertsTitle: 'Grade alerts',
        noAlerts: 'No grade alert for now.',
        openNotifications: 'Open all notifications',
        loadError: 'Unable to load grades.'
      };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finalGrade, setFinalGrade] = useState(null);
  const [notifications, setNotifications] = useState([]);

  async function load() {
    setLoading(true);
    const [gradeRes, notifRes] = await Promise.all([getStudentFinalGrade({ email }), listNotifications({ email, limit: 40 })]);

    if (gradeRes.ok) {
      setFinalGrade(gradeRes.data || null);
    } else {
      setFinalGrade(null);
    }

    if (notifRes.ok) {
      setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
    } else {
      setNotifications([]);
    }

    const errors = [];
    if (!gradeRes.ok) errors.push((gradeRes.data && gradeRes.data.errors && gradeRes.data.errors[0]) || copy.loadError);
    if (!notifRes.ok) errors.push((notifRes.data && notifRes.data.errors && notifRes.data.errors[0]) || copy.loadError);
    setError(errors.filter(Boolean).slice(0, 1).join('\n'));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [email, isFrench]);

  const gradeAlerts = useMemo(() => notifications.filter(isGradeNotification).slice(0, 8), [notifications]);

  return (
    <section className="student-grades-shell">
      <header className="student-grades-head">
        <h2 className="title">{copy.title}</h2>
        <p className="subtitle">{copy.subtitle}</p>
      </header>

      <div className="toolbar">
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? copy.loading : copy.refresh}
        </button>
        <button className="primary" type="button" onClick={onOpenNotifications}>
          {copy.openNotifications}
        </button>
      </div>

      {error ? <div className="errors">{error}</div> : null}

      <div className="student-grades-grid">
        <article className="glass-card student-grades-card student-grades-summary-card">
          <h3 className="glass-card-title">{copy.finalGradeTitle}</h3>
          {finalGrade ? (
            <div className="student-notif-list" style={{ marginTop: 10 }}>
              <div className="student-notif-item student-grades-grade-item">
                <span className="student-notif-ico tone-2" aria-hidden="true">
                  {'\u{1F4DD}'}
                </span>
                <div className="student-notif-copy">
                  <strong className="student-grades-value">
                    {copy.supervisorGrade}: {finalGrade.supervisor_grade === null || finalGrade.supervisor_grade === undefined ? '-' : `${Number(finalGrade.supervisor_grade).toFixed(2)} / 20`}
                  </strong>
                </div>
              </div>
              <div className="student-notif-item student-grades-grade-item">
                <span className="student-notif-ico tone-3" aria-hidden="true">
                  {'\u2696\uFE0F'}
                </span>
                <div className="student-notif-copy">
                  <strong className="student-grades-value">
                    {copy.juryGrade}: {finalGrade.jury_grade === null || finalGrade.jury_grade === undefined ? '-' : `${Number(finalGrade.jury_grade).toFixed(2)} / 20`}
                  </strong>
                </div>
              </div>
              <div className="student-notif-item student-grades-grade-item">
                <span className="student-notif-ico tone-1" aria-hidden="true">
                  {'\u{1F393}'}
                </span>
                <div className="student-notif-copy">
                  <strong className="student-grades-value">
                    {finalGrade.grade === null || finalGrade.grade === undefined ? '-' : `${Number(finalGrade.grade).toFixed(2)} / 20`} {finalGrade.mention ? `- ${finalGrade.mention}` : ''}
                  </strong>
                  <p>
                    {finalGrade.published ? copy.published : copy.finalPending}
                    {finalGrade.published && finalGrade.published_at ? ` - ${fmtDate(finalGrade.published_at)}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="glass-card-sub">{copy.notPublished}</p>
          )}
        </article>

        <article className="glass-card student-grades-card student-grades-alerts-card">
          <h3 className="glass-card-title">{copy.alertsTitle}</h3>
          <div className="student-notif-list" style={{ marginTop: 10 }}>
            {gradeAlerts.map((n, idx) => (
              <button
                key={n.delivery_id || idx}
                className="student-notif-item student-grades-alert-item"
                type="button"
                onClick={onOpenNotifications}
              >
                <span className="student-notif-ico tone-2" aria-hidden="true">
                  {'\u{1F514}'}
                </span>
                <div className="student-notif-copy">
                  <strong>{n.title || copy.finalGradeTitle}</strong>
                  <p>{n.message || ''}</p>
                </div>
                <span className="student-notif-age">{fmtDate(n.created_at)}</span>
              </button>
            ))}
            {!gradeAlerts.length ? <p className="glass-card-sub">{copy.noAlerts}</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
