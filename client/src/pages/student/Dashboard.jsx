import React, { useEffect, useMemo, useState } from 'react';
import {
  generateStudentConvocation,
  getDefense,
  getDocumentDeadlines,
  getReport,
  getStudentConvocation,
  getStudentFinalGrade,
  listSupervisors
} from '../../lib/studentApi.js';
import { listNotifications } from '../../lib/notificationsApi.js';
import DefenseCalendar from '../../components/calendar/DefenseCalendar.jsx';
import { readDeadlineFallback } from '../../lib/deadlineFallback.js';

function parseTimeRange(v) {
  const raw = String(v || '').trim();
  const parts = raw
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 2) return { start: parts[0], end: parts[1] };
  if (parts.length === 1) return { start: parts[0], end: '' };
  return { start: '', end: '' };
}

function fmtLongDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr || '');
  try {
    const text = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return d.toLocaleDateString();
  }
}

function daysUntil(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfTarget - startOfToday) / (24 * 60 * 60 * 1000));
}

function reminderTextFromDays(delta) {
  if (delta === null) return '';
  if (delta < 0) return 'Soutenance passee';
  if (delta === 0) return "Rappel aujourd'hui";
  if (delta === 1) return 'Rappel demain';
  return `Rappel dans ${delta} jours`;
}

function toIsoDay(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : '';
}

function toIcsDateTimeLocal(dateObj) {
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${dateObj.getFullYear()}${pad2(dateObj.getMonth() + 1)}${pad2(dateObj.getDate())}T${pad2(dateObj.getHours())}${pad2(dateObj.getMinutes())}00`;
}

function buildIcs({ title, description, location, start, end }) {
  const uid = `${Date.now()}@monpfe`;
  const dtstamp = toIcsDateTimeLocal(new Date());
  const dtstart = toIcsDateTimeLocal(start);
  const dtend = toIcsDateTimeLocal(end);
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//monpfe//planify//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
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

function openPrintInvitation({ studentEmail, date, time, room, supervisors, juries }) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert('Popup blocked by your browser. Allow popups and try again.');
    return;
  }
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const now = new Date().toLocaleString();
  const supText = (supervisors || []).join(', ') || '-';
  const juryText = (juries || []).join(', ') || '-';
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Convocation</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
        .meta { color: #6b7280; font-size: 12px; margin: 6px 0 18px; }
        h1 { font-size: 18px; margin: 0; }
        .box { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
        .row { display: grid; grid-template-columns: 160px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eef2f8; }
        .row:last-child { border-bottom: 0; }
        .k { color: #374151; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
        .v { font-weight: 700; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Convocation de soutenance</h1>
      <div class="meta">Genere le ${esc(now)} - utilisez "Imprimer" puis "Enregistrer en PDF".</div>
      <div class="box">
        <div class="row"><div class="k">Etudiant</div><div class="v">${esc(studentEmail)}</div></div>
        <div class="row"><div class="k">Date</div><div class="v">${esc(date)}</div></div>
        <div class="row"><div class="k">Heure</div><div class="v">${esc(time)}</div></div>
        <div class="row"><div class="k">Salle</div><div class="v">${esc(room)}</div></div>
        <div class="row"><div class="k">Encadrant(s)</div><div class="v">${esc(supText)}</div></div>
        <div class="row"><div class="k">Jury</div><div class="v">${esc(juryText)}</div></div>
      </div>
      <script>
        setTimeout(() => { try { window.focus(); window.print(); } catch (e) {} }, 200);
      </script>
    </body>
  </html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function parseJuryEntry(value, index) {
  const raw = String(value || '').trim();
  if (!raw) return { name: 'Membre a confirmer', role: '' };
  const match = raw.match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { name: match[1].trim(), role: match[2].trim() };
  const fallbackRoles = ['President', 'Rapporteur', 'Examinateur', 'Membre'];
  return { name: raw, role: fallbackRoles[index] || 'Membre' };
}

function normalizeTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 1000000000000 ? n * 1000 : n;
}

function timeAgoText(value) {
  const ts = normalizeTimestamp(value);
  if (!ts) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "a l'instant";
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? 's' : ''}`;
}

function initialsFromName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function Glyph({ kind }) {
  if (kind === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
      </svg>
    );
  }
  if (kind === 'menu') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  }
  if (kind === 'cap') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10 12 5l10 5-10 5z" />
        <path d="M6 12v4c0 1 3 3 6 3s6-2 6-3v-4" />
      </svg>
    );
  }
  if (kind === 'dots') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="18" cy="12" r="1.4" />
      </svg>
    );
  }
  if (kind === 'download') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M4 20h16" />
      </svg>
    );
  }
  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v3M16 2v3M4 8h16" />
        <rect x="3" y="5" width="18" height="16" rx="3" />
      </svg>
    );
  }
  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 13 4 4L19 7" />
      </svg>
    );
  }
  if (kind === 'chevron-left') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
    );
  }
  if (kind === 'chevron-right') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }
  if (kind === 'msg') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 10h8M8 13h5" />
      </svg>
    );
  }
  if (kind === 'bell') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    );
  }
  if (kind === 'file') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

export default function Dashboard({ email, onOpenReport, onOpenMessaging, onOpenNotifications }) {
  const [defense, setDefense] = useState(null);
  const [documentDeadlines, setDocumentDeadlines] = useState({ report_deadline: '', memoire_deadline: '' });
  const [supervisors, setSupervisors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [finalGrade, setFinalGrade] = useState(null);
  const [convocation, setConvocation] = useState(null);
  const [convocationBusy, setConvocationBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [dRes, rRes, sRes, nRes, fgRes, ddRes, cRes] = await Promise.allSettled([
      getDefense({ email }),
      getReport({ email }),
      listSupervisors({ student_email: email }),
      listNotifications({ email, limit: 6 }),
      getStudentFinalGrade({ email }),
      getDocumentDeadlines(),
      getStudentConvocation({ email })
    ]);

    const d = dRes.status === 'fulfilled' ? dRes.value : { ok: false, data: { errors: ['Unable to load defense.'] } };
    const r = rRes.status === 'fulfilled' ? rRes.value : { ok: false, data: { errors: ['Unable to load report.'] } };
    const s = sRes.status === 'fulfilled' ? sRes.value : { ok: false, data: { errors: ['Unable to load supervisors.'] } };
    const n = nRes.status === 'fulfilled' ? nRes.value : { ok: false, data: { errors: ['Unable to load notifications.'] } };
    const fg = fgRes.status === 'fulfilled' ? fgRes.value : { ok: false, data: { errors: ['Unable to load final grade.'] } };
    const dd = ddRes.status === 'fulfilled' ? ddRes.value : { ok: false, data: { errors: ['Unable to load global deadlines.'] } };
    const c = cRes.status === 'fulfilled' ? cRes.value : { ok: false, data: null };

    if (d.ok) setDefense(d.data || null);
    else setDefense(null);

    if (s.ok) setSupervisors(Array.isArray(s.data) ? s.data : []);
    else setSupervisors([]);

    if (n.ok) setNotifications(Array.isArray(n.data) ? n.data : []);
    else setNotifications([]);

    if (fg.ok) setFinalGrade(fg.data || null);
    else setFinalGrade(null);

    if (c.ok) setConvocation(c.data || null);
    else setConvocation(null);

    const reportDeadlineGlobal = String((dd.data && dd.data.report_deadline) || '').trim();
    const memoireDeadlineGlobal = String((dd.data && dd.data.memoire_deadline) || '').trim();
    const reportDeadlineReport = String((r.data && (r.data.report_deadline || r.data.deadline)) || '').trim();
    const memoireDeadlineReport = String((r.data && r.data.memoire_deadline) || '').trim();
    const localDeadlines = readDeadlineFallback();
    const reportDeadlineLocal = String((localDeadlines && localDeadlines.report_deadline) || '').trim();
    const memoireDeadlineLocal = String((localDeadlines && localDeadlines.memoire_deadline) || '').trim();

    // Prefer global deadlines and fallback to report payload (admin-entered values).
    setDocumentDeadlines({
      report_deadline: reportDeadlineGlobal || reportDeadlineReport || reportDeadlineLocal,
      memoire_deadline: memoireDeadlineGlobal || memoireDeadlineReport || memoireDeadlineLocal
    });

    const errs = [];
    if (!d.ok) errs.push((d.data && d.data.errors && d.data.errors[0]) || 'Unable to load defense.');
    if (!s.ok) errs.push((s.data && s.data.errors && s.data.errors[0]) || 'Unable to load supervisors.');
    if (!n.ok) errs.push((n.data && n.data.errors && n.data.errors[0]) || 'Unable to load notifications.');
    if (!dd.ok && !r.ok && !reportDeadlineLocal && !memoireDeadlineLocal) {
      errs.push((dd.data && dd.data.errors && dd.data.errors[0]) || 'Unable to load global deadlines.');
    }
    setError(errs.filter(Boolean).slice(0, 1).join('\n'));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [email]);

  const time = useMemo(() => parseTimeRange(defense && defense.time), [defense && defense.time]);
  const juryList = useMemo(() => {
    const raw = defense && defense.jury ? String(defense.jury) : '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [defense && defense.jury]);
  const supNames = useMemo(() => (supervisors || []).map((x) => x.teacher_name || x.teacher_email).filter(Boolean), [supervisors]);
  const reminder = defense && defense.date ? daysUntil(defense.date) : null;
  const reminderText = reminderTextFromDays(reminder);

  const studentCalendarRows = useMemo(() => {
    const day = toIsoDay(defense && defense.date);
    if (!day) return [];
    return [
      {
        defense_date: day,
        defense_time: String((defense && defense.time) || '').trim(),
        defense_room: String((defense && defense.classroom) || '').trim(),
        student_name: 'Ma soutenance',
        project_title: ''
      }
    ];
  }, [defense && defense.date, defense && defense.time, defense && defense.classroom]);

  const studentCalendarMarkers = useMemo(() => {
    const markers = [];
    const reportDeadline = toIsoDay(documentDeadlines && documentDeadlines.report_deadline);
    const memoireDeadline = toIsoDay(documentDeadlines && documentDeadlines.memoire_deadline);
    if (reportDeadline) {
      markers.push({
        day: reportDeadline,
        kind: 'report_deadline',
        label: 'Deadline rapport'
      });
    }
    if (memoireDeadline) {
      markers.push({
        day: memoireDeadline,
        kind: 'memoire_deadline',
        label: 'Deadline memoire'
      });
    }
    return markers;
  }, [documentDeadlines && documentDeadlines.report_deadline, documentDeadlines && documentDeadlines.memoire_deadline]);

  const studentCalendarLabelOverrides = useMemo(
    () => ({
      defensesCountTitle: (count) => `${count} evenement(s)`,
      monthSummary: (count) => `${count} date(s) importante(s) ce mois`,
      allDates: (count) => `Toutes les dates importantes (${count})`,
      dayDefenses: (count) => `${count} evenement(s)`,
      group: 'Element',
      noDateInList: 'Aucune date importante planifiee.',
      emptyTextDefault: 'Aucune date importante planifiee.'
    }),
    []
  );

  const reportDeadlineDisplay = toIsoDay(documentDeadlines && documentDeadlines.report_deadline) || '-';
  const memoireDeadlineDisplay = toIsoDay(documentDeadlines && documentDeadlines.memoire_deadline) || '-';

  const juryRows = (juryList.length ? juryList : ['Pr. Ahmed (President)', 'Pr. Sara (Rapporteur)', 'Pr. Nabil (Examinateur)']).map(parseJuryEntry);
  const leadSupervisor = supNames[0] || 'Pr. Encadrant';
  const leadSupervisorInitials = initialsFromName(leadSupervisor);

  const smartNotifications = (notifications || []).slice(0, 3).map((n, i) => ({
    key: n.delivery_id || i,
    text: n.title || n.message || 'Notification',
    author: i % 2 ? 'Pr. Ahmed' : 'Pr. Rania'
  }));
  const smartRows = smartNotifications.length
    ? smartNotifications
    : [
        { key: 'a', text: 'La convocation est prete a telecharger', author: 'Pr. Rania' },
        { key: 'b', text: 'Votre memoire doit etre depose avant le 5 Mai 2026', author: 'Pr. Rania' },
        { key: 'c', text: 'Salle et jury confirmes pour votre soutenance', author: 'Pr. Rania' }
      ];

  async function onDownloadInvitation() {
    if (!defense || !defense.date) {
      alert('No defense scheduled.');
      return;
    }
    setConvocationBusy(true);
    try {
      const r = await generateStudentConvocation({ email });
      if (r.ok && r.data && r.data.url) {
        setConvocation(r.data);
        const popup = window.open(r.data.url, '_blank', 'noopener,noreferrer');
        if (!popup) window.location.assign(r.data.url);
        return;
      }
      openPrintInvitation({
        studentEmail: email,
        date: fmtLongDate(defense.date),
        time: defense.time || '',
        room: defense.classroom || '',
        supervisors: supNames,
        juries: juryRows.map((item) => `${item.name}${item.role ? ` (${item.role})` : ''}`)
      });
    } finally {
      setConvocationBusy(false);
    }
  }

  function onAddToCalendar() {
    if (!defense || !defense.date) {
      alert('No defense scheduled.');
      return;
    }
    const d = new Date(defense.date);
    const startH = time.start ? time.start.split(':') : [];
    const endH = time.end ? time.end.split(':') : [];
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(startH[0] || 0), Number(startH[1] || 0), 0);
    const end = time.end
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(endH[0] || 0), Number(endH[1] || 0), 0)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const ics = buildIcs({
      title: 'Soutenance',
      description: `Soutenance - ${email}\nEncadrant(s): ${supNames.join(', ') || '-'}\nJury: ${juryRows.map((j) => j.name).join(', ') || '-'}`,
      location: defense.classroom || '',
      start,
      end
    });
    downloadText('soutenance.ics', ics, 'text/calendar;charset=utf-8');
  }

  if (loading) return <p className="subtitle">Loading...</p>;

  return (
    <div className="student-dashboard-shell">
      {error ? <div className="errors student-dash-error">{error}</div> : null}

      <div className="dash-grid">
        <div className="dash-col">
          <section className="glass-card defense-card">
            <div className="glass-card-header">
                <h3 className="glass-card-title">
                  <span className="title-icon" aria-hidden="true">
                    <Glyph kind="cap" />
                  </span>
                  Ma soutenance des soutenances
                </h3>
              <button className="card-dot-btn" type="button" aria-label="Options">
                <Glyph kind="dots" />
              </button>
            </div>

            {reminderText ? <div className="defense-reminder-pill">{reminderText}</div> : null}

            {!defense || !defense.date ? (
              <p className="glass-card-sub">Aucune soutenance planifiee pour le moment.</p>
            ) : (
              <>
                <div className="defense-main">
                  <div className="defense-date">
                    {fmtLongDate(defense.date)}
                    {' - '}
                    {time.start}
                    {time.end ? ` - ${time.end}` : ''}
                  </div>
                  <div className="defense-time">Salle {defense.classroom || '-'} - {leadSupervisor}</div>
                </div>

                <div className="jury-table">
                  {juryRows.map((entry, idx) => (
                    <div key={`${entry.name}-${idx}`} className="jury-row">
                      <span className="jury-check" aria-hidden="true">
                        <Glyph kind="check" />
                      </span>
                      <div className="jury-text">
                        <strong>{entry.name}</strong>
                        <span>{entry.role ? `(${entry.role})` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="defense-btn-row">
                  <button className="student-btn student-btn-primary" type="button" onClick={onDownloadInvitation} disabled={convocationBusy}>
                    <span className="btn-icon" aria-hidden="true">
                      <Glyph kind="download" />
                    </span>
                    {convocationBusy ? 'Generation...' : 'Telecharger la convocation'}
                  </button>
                  <button className="student-btn student-btn-glass" type="button" onClick={onAddToCalendar}>
                    <span className="btn-icon" aria-hidden="true">
                      <Glyph kind="calendar" />
                    </span>
                    Ajouter au calendrier
                  </button>
                </div>
                {convocation && convocation.file_path ? (
                  <p className="subtitle" style={{ marginTop: 10, textAlign: 'left' }}>
                    Derniere convocation: <a href={convocation.file_path} target="_blank" rel="noreferrer">ouvrir le document</a>
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section className="glass-card student-deadlines-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                <span className="title-icon" aria-hidden="true">
                  <Glyph kind="calendar" />
                </span>
                Deadlines documents
              </h3>
            </div>
            <div className="student-deadline-grid">
              <div className="student-deadline-item report">
                <span className="student-deadline-label">Rapport</span>
                <strong className="student-deadline-value">{reportDeadlineDisplay}</strong>
              </div>
              <div className="student-deadline-item memoire">
                <span className="student-deadline-label">Memoire</span>
                <strong className="student-deadline-value">{memoireDeadlineDisplay}</strong>
              </div>
            </div>
          </section>

          <DefenseCalendar
            className="student-calendar-left"
            title="Calendrier"
            subtitle="Soutenance et deadlines (rapport/memoire)."
            rows={studentCalendarRows}
            markers={studentCalendarMarkers}
            emptyText="Aucune date importante planifiee pour le moment."
            labelOverrides={studentCalendarLabelOverrides}
          />

          <section className="glass-card report-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                <span className="title-icon" aria-hidden="true">
                  <Glyph kind="bell" />
                </span>
                Notifications intelligentes
              </h3>
              <button className="card-dot-btn" type="button" aria-label="Options">
                <Glyph kind="dots" />
              </button>
            </div>

            <div className="smart-feed">
              {smartRows.map((row, idx) => (
                <div key={row.key} className="smart-feed-row">
                  <span className={'student-notif-ico tone-' + ((idx % 3) + 1)} aria-hidden="true">
                    {idx % 2 ? <Glyph kind="file" /> : <Glyph kind="bell" />}
                  </span>
                  <span className="smart-feed-text">{row.text}</span>
                  <span className="smart-feed-author">{row.author}</span>
                </div>
              ))}
            </div>

            <button className="student-btn student-btn-upload student-btn-upload-wide" type="button" onClick={onOpenReport}>
              <span className="btn-icon" aria-hidden="true">
                <Glyph kind="file" />
              </span>
              Deposer le PDF
            </button>
          </section>
        </div>

        <div className="dash-col dash-widget-col">
          <section className="glass-card widget-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                <span className="title-icon" aria-hidden="true">
                  <Glyph kind="check" />
                </span>
                Final grade
              </h3>
            </div>
            {finalGrade ? (
              <div className="student-notif-list">
                <div className="student-notif-item" role="status" aria-live="polite">
                  <span className="student-notif-ico tone-2" aria-hidden="true">
                    <Glyph kind="check" />
                  </span>
                  <div className="student-notif-copy">
                    <strong>
                      Supervisor: {finalGrade.supervisor_grade === null || finalGrade.supervisor_grade === undefined ? '-' : `${Number(finalGrade.supervisor_grade).toFixed(2)} / 20`}
                    </strong>
                  </div>
                </div>
                <div className="student-notif-item" role="status" aria-live="polite">
                  <span className="student-notif-ico tone-3" aria-hidden="true">
                    <Glyph kind="check" />
                  </span>
                  <div className="student-notif-copy">
                    <strong>
                      Jury: {finalGrade.jury_grade === null || finalGrade.jury_grade === undefined ? '-' : `${Number(finalGrade.jury_grade).toFixed(2)} / 20`}
                    </strong>
                  </div>
                </div>
                <div className="student-notif-item" role="status" aria-live="polite">
                  <span className="student-notif-ico tone-1" aria-hidden="true">
                    <Glyph kind="cap" />
                  </span>
                  <div className="student-notif-copy">
                    <strong>
                      {finalGrade.grade === null || finalGrade.grade === undefined ? 'Final grade pending' : `${Number(finalGrade.grade).toFixed(2)} / 20`} {finalGrade.mention ? `- ${finalGrade.mention}` : ''}
                    </strong>
                    <p>
                      {finalGrade.published ? 'Published' : 'Waiting for administrator publication'}
                      {finalGrade.published && finalGrade.published_at ? ` on ${new Date(Number(finalGrade.published_at)).toLocaleString()}` : ''}.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="glass-card-sub">Final grade is not published yet.</p>
            )}
          </section>

          <section className="glass-card widget-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                <span className="title-icon" aria-hidden="true">
                  <Glyph kind="bell" />
                </span>
                Notifications intelligentes
              </h3>
            </div>

            <div className="student-notif-list">
              {(notifications || []).slice(0, 4).map((n, i) => (
                <button key={n.delivery_id || i} className="student-notif-item" type="button" onClick={onOpenNotifications}>
                  <span className={'student-notif-ico tone-' + ((i % 3) + 1)} aria-hidden="true">
                    {i % 3 === 0 ? <Glyph kind="bell" /> : i % 3 === 1 ? <Glyph kind="calendar" /> : <Glyph kind="file" />}
                  </span>
                  <div className="student-notif-copy">
                    <strong>{n.title || 'Notification'}</strong>
                    <p>{n.message}</p>
                  </div>
                  <span className="student-notif-age">{timeAgoText(n.created_at)}</span>
                </button>
              ))}
              {(!notifications || !notifications.length) && <p className="glass-card-sub">Aucune notification recente.</p>}
            </div>
          </section>

          <section className="glass-card widget-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title">
                <span className="title-icon" aria-hidden="true">
                  <Glyph kind="msg" />
                </span>
                Depot du memoire
              </h3>
              <span className="status-pill">1</span>
            </div>

            <div className="msg-preview-head">
              <div className="msg-preview-avatar" aria-hidden="true">
                {leadSupervisorInitials}
              </div>
              <div className="msg-preview-meta">
                <strong>{leadSupervisor}</strong>
                <span>Encadrant</span>
              </div>
            </div>
            <div className="msg-preview-thread">
              <div className="msg-bubble peer">Bonjour, avez-vous termine votre memoire ?</div>
              <div className="msg-bubble mine">Oui, je vais deposer cette semaine.</div>
            </div>
            <button className="student-btn student-btn-glass student-msg-open" type="button" onClick={onOpenMessaging}>
              Ouvrir la conversation
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
