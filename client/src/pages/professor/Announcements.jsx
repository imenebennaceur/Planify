import React, { useEffect, useMemo, useState } from 'react';
import { listMyAnnouncements, listMyStudents, sendMyAnnouncement } from '../../lib/professorApi.js';

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '-';
  }
}

export default function ProfAnnouncements({ teacherEmail }) {
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [target, setTarget] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const options = useMemo(() => {
    const byEmail = new Map();
    for (const r of Array.isArray(students) ? students : []) {
      const email = String((r && r.student_email) || '').toLowerCase().trim();
      if (!email) continue;
      if (byEmail.has(email)) continue;
      byEmail.set(email, {
        email,
        name: String((r && r.student_name) || '').trim() || email
      });
    }
    return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  async function load() {
    setLoading(true);
    const [s, h] = await Promise.all([
      listMyStudents({ teacher_email: teacherEmail, role: 'all' }),
      listMyAnnouncements({ teacher_email: teacherEmail, limit: 50 })
    ]);

    const errs = [];
    if (!s.ok) errs.push((s.data && s.data.errors && s.data.errors[0]) || 'Impossible de charger la liste des etudiants.');
    if (!h.ok) errs.push((h.data && h.data.errors && h.data.errors[0]) || "Impossible de charger l'historique des annonces.");

    setStudents(s.ok && Array.isArray(s.data) ? s.data : []);
    setRows(h.ok && Array.isArray(h.data) ? h.data : []);
    setError(errs.join(' '));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [teacherEmail]);

  async function onSend(ev) {
    ev.preventDefault();
    const msg = String(message || '').trim();
    if (!msg) {
      setError('Veuillez saisir un message.');
      return;
    }
    if (!options.length) {
      setError('Aucun etudiant affecte.');
      return;
    }
    if (target !== 'all' && !options.some((o) => o.email === target)) {
      setError('Etudiant cible invalide.');
      return;
    }

    setSending(true);
    const r = await sendMyAnnouncement({
      teacher_email: teacherEmail,
      title: String(title || '').trim(),
      message: msg,
      student_email: target === 'all' ? '' : target
    });
    setSending(false);

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || "Impossible d'envoyer l'annonce.");
      return;
    }

    setError('');
    setTitle('');
    setMessage('');
    setTarget('all');
    await load();
    alert('Annonce envoyee');
  }

  return (
    <div>
      <h2 className="title">Annonces et conseils</h2>
      <p className="subtitle">Envoyer un message a vos etudiants (encadrement et jury)</p>

      <form onSubmit={onSend} style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="field select" style={{ margin: 0 }}>
            <span className="icon" aria-hidden="true">
              {'\u{1F4E3}'}
            </span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">Tous mes etudiants</option>
              {options.map((o) => (
                <option key={o.email} value={o.email}>
                  {o.name} ({o.email})
                </option>
              ))}
            </select>
            <span className="chevron" aria-hidden="true">
              {'\u25BE'}
            </span>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <span className="icon" aria-hidden="true">
              {'\u{1F3F7}\uFE0F'}
            </span>
            <input
              value={title}
              placeholder="Titre (optionnel)"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field" style={{ margin: 0, gridTemplateColumns: '40px 1fr', alignItems: 'start' }}>
            <span className="icon" aria-hidden="true">
              {'\u2709\uFE0F'}
            </span>
            <textarea
              value={message}
              placeholder="Votre annonce, conseil, rappel..."
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                minHeight: 96,
                border: 0,
                outline: 0,
                resize: 'vertical',
                padding: '12px 0 4px',
                background: 'transparent',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="primary" type="submit" disabled={sending || loading || !options.length}>
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>
      </form>

      {error && <div className="errors">{error}</div>}

      <div style={{ marginTop: 18, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Cible</th>
              <th>Titre</th>
              <th>Message</th>
              <th>Destinataires</th>
              <th>Lus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.target_type === 'email' ? r.target_value : 'Tous mes etudiants'}</td>
                <td>{r.title || '-'}</td>
                <td style={{ maxWidth: 520, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</td>
                <td>{r.recipients || 0}</td>
                <td>{r.read_count || 0}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: 'var(--muted)' }}>
                  Aucune annonce envoyee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
