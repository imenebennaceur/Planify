import React, { useEffect, useState } from 'react';
import { listFinalGrades, publishFinalGrade } from '../../lib/adminApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '-';
  }
}

export default function AdminFinalGrades({ adminEmail }) {
  const { isFrench } = useLanguage();
  const copy = isFrench
    ? {
        title: 'Notes finales',
        subtitle: "Reception des notes encadrant et jury, calcul de la note finale puis publication a l'etudiant.",
        refresh: 'Actualiser',
        loadError: 'Impossible de charger les notes finales.',
        publishError: 'Impossible de mettre a jour la publication.',
        publishAll: 'Publier toutes les notes calculees',
        publishingAll: 'Publication...',
        tableTitle: 'Publication des notes finales',
        tableSubtitle: 'La note finale = (note encadrant + note jury) / 2.',
        tableCols: ['Etudiant', 'Email', 'Encadrant', 'Jury', 'Note finale', 'Mention', 'Publication', 'Action'],
        published: 'Publiee',
        notPublished: 'Non publiee',
        publish: 'Publier',
        unpublish: 'Retirer',
        saving: 'Sauvegarde...',
        pending: 'En attente',
        noData: 'Aucune donnee de note finale.'
      }
    : {
        title: 'Final Grades',
        subtitle: '',
        refresh: 'Refresh',
        loadError: 'Unable to load final grades.',
        publishError: 'Unable to update publication.',
        publishAll: 'Publish all computed grades',
        publishingAll: 'Publishing...',
        tableTitle: 'Final grade publication',
        tableSubtitle: 'Final grade = (supervisor grade + jury grade) / 2.',
        tableCols: ['Student', 'Email', 'Supervisor', 'Jury', 'Final Grade', 'Mention', 'Publication', 'Action'],
        published: 'Published',
        notPublished: 'Not published',
        publish: 'Publish',
        unpublish: 'Unpublish',
        saving: 'Saving...',
        pending: 'Pending',
        noData: 'No final-grade data.'
      };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishingTarget, setPublishingTarget] = useState('');

  async function load() {
    setLoading(true);
    const r = await listFinalGrades();
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || copy.loadError);
      setRows([]);
      setLoading(false);
      return;
    }
    setError('');
    const nextRows = Array.isArray(r.data) ? r.data : [];
    setRows(nextRows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [isFrench]);

  async function onPublish(student_email, published) {
    setPublishingTarget(student_email || '');
    const r = await publishFinalGrade({
      student_email,
      published,
      published_by: String(adminEmail || '').trim().toLowerCase()
    });
    setPublishingTarget('');

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || copy.publishError);
      return;
    }
    setError('');
    await load();
  }

  async function onPublishAllGraded() {
    setPublishingTarget('all');
    const r = await publishFinalGrade({
      student_email: 'all',
      published: true,
      published_by: String(adminEmail || '').trim().toLowerCase()
    });
    setPublishingTarget('');
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || copy.publishError);
      return;
    }
    setError('');
    await load();
  }

  return (
    <div className="admin-final-grades-shell">
      <h2 className="title">{copy.title}</h2>
      <p className="subtitle">{copy.subtitle}</p>

      <div className="admin-final-grades-publication-head" style={{ marginTop: 24 }}>
        <h3 className="title" style={{ fontSize: 18, textAlign: 'left' }}>
          {copy.tableTitle}
        </h3>
        <p className="subtitle" style={{ textAlign: 'left' }}>
          {copy.tableSubtitle}
        </p>

        <div className="toolbar" style={{ marginTop: 10 }}>
          <button className="primary" type="button" onClick={onPublishAllGraded} disabled={publishingTarget === 'all' || loading}>
            {publishingTarget === 'all' ? copy.publishingAll : copy.publishAll}
          </button>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? copy.saving : copy.refresh}
          </button>
        </div>
      </div>

      {error && <div className="errors">{error}</div>}

      <div className="admin-final-grades-table-wrap" style={{ marginTop: 12, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{copy.tableCols[0]}</th>
              <th>{copy.tableCols[1]}</th>
              <th>{copy.tableCols[2]}</th>
              <th>{copy.tableCols[3]}</th>
              <th>{copy.tableCols[4]}</th>
              <th>{copy.tableCols[5]}</th>
              <th>{copy.tableCols[6]}</th>
              <th style={{ width: 140 }}>{copy.tableCols[7]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.student_email || index}>
                <td>{row.student_name}</td>
                <td>{row.student_email}</td>
                <td className="admin-final-grades-average">
                  {row.supervisor_grade === null || row.supervisor_grade === undefined ? copy.pending : Number(row.supervisor_grade).toFixed(2)}
                </td>
                <td className="admin-final-grades-average">
                  {row.jury_grade === null || row.jury_grade === undefined ? copy.pending : Number(row.jury_grade).toFixed(2)}
                </td>
                <td className="admin-final-grades-average">
                  {row.final_grade === null || row.final_grade === undefined ? '-' : Number(row.final_grade).toFixed(2)}
                </td>
                <td>{row.mention || '-'}</td>
                <td>
                  {row.published ? (
                    <>
                      <span className="admin-final-grades-status is-published">{copy.published}</span>
                      <br />
                      <span className="admin-final-grades-publish-meta" style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {fmtDate(row.published_at)}
                        {row.published_by ? ` - ${row.published_by}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="admin-final-grades-status is-draft">{copy.notPublished}</span>
                  )}
                </td>
                <td>
                  <button
                    className={row.published ? 'btn' : 'primary'}
                    type="button"
                    disabled={
                      publishingTarget === row.student_email ||
                      (!row.published && (row.final_grade === null || row.final_grade === undefined))
                    }
                    onClick={() => onPublish(row.student_email, !row.published)}
                  >
                    {publishingTarget === row.student_email ? copy.saving : row.published ? copy.unpublish : copy.publish}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: 14, color: 'var(--muted)' }}>
                  {copy.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
