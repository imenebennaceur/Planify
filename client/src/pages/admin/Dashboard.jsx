import React, { useEffect, useMemo, useState } from 'react';
import { getStats, listSchedule } from '../../lib/adminApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function labelBucket(k, isFrench) {
  if (isFrench) {
    return k === 'tresBien'
      ? 'Excellent (>= 16)'
      : k === 'bien'
        ? 'Bien (>= 14)'
        : k === 'assezBien'
          ? 'Assez bien (>= 12)'
          : k === 'passable'
            ? 'Passable (>= 10)'
            : k === 'insuffisant'
              ? 'Insuffisant (< 10)'
              : k;
  }

  return k === 'tresBien'
    ? 'Excellent (>= 16)'
    : k === 'bien'
      ? 'Good (>= 14)'
      : k === 'assezBien'
        ? 'Fairly good (>= 12)'
        : k === 'passable'
          ? 'Pass (>= 10)'
          : k === 'insuffisant'
            ? 'Fail (< 10)'
            : k;
}

function parseIsoDay(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function monthCells(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const maxDay = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const day = i - firstWeekday + 1;
    cells.push(day >= 1 && day <= maxDay ? day : 0);
  }
  return cells;
}

function fmtMonthYear(value, locale) {
  try {
    return value.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch {
    return `${value.getMonth() + 1}/${value.getFullYear()}`;
  }
}

function fmtLongDay(value, locale) {
  const d = parseIsoDay(value);
  if (!d) return String(value || '');
  try {
    return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(value || '');
  }
}

function buildDayPalette(index) {
  const hue = (index * 47 + 208) % 360;
  return {
    accent: `hsl(${hue}, 72%, 48%)`,
    accentSoft: `hsla(${hue}, 72%, 48%, 0.35)`,
    daySoft: `hsla(${hue}, 90%, 58%, 0.18)`,
    groupAccents: [
      `hsl(${hue}, 78%, 43%)`,
      `hsl(${(hue + 22) % 360}, 76%, 44%)`,
      `hsl(${(hue + 42) % 360}, 74%, 44%)`,
      `hsl(${(hue + 62) % 360}, 72%, 45%)`,
      `hsl(${(hue + 82) % 360}, 70%, 45%)`,
      `hsl(${(hue + 102) % 360}, 68%, 46%)`
    ],
    rowShades: [
      `hsla(${hue}, 90%, 58%, 0.18)`,
      `hsla(${(hue + 18) % 360}, 85%, 58%, 0.18)`,
      `hsla(${(hue + 36) % 360}, 82%, 58%, 0.18)`,
      `hsla(${(hue + 54) % 360}, 78%, 58%, 0.18)`
    ]
  };
}

function groupColor(palette, index) {
  if (!palette || !Array.isArray(palette.groupAccents) || !palette.groupAccents.length) return 'var(--primary)';
  return palette.groupAccents[index % palette.groupAccents.length];
}

export default function AdminDashboard() {
  const { isFrench, locale } = useLanguage();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleRows, setScheduleRows] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const labels = useMemo(
    () =>
      isFrench
        ? {
            title: 'Statistiques globales',
            subtitle: 'Vue generale des soutenances, rapports, jurys et notes',
            calendarTitle: 'Calendrier des soutenances',
            calendarSubtitle: 'Toutes les dates planifiees, visibles par mois et en liste complete.',
            previousMonth: 'Mois precedent',
            nextMonth: 'Mois suivant',
            week: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            defenseTitle: (count) => `${count} soutenance(s)`,
            monthSummary: (count) => `${count} date(s) avec soutenance ce mois`,
            allDates: (count) => `Toutes les dates de soutenance (${count})`,
            noDates: 'Aucune date de soutenance planifiee.',
            dayCount: (count) => `${count} soutenance(s)`,
            student: 'Etudiant',
            totals: {
              totalStudents: 'Total etudiants',
              totalTeachers: 'Total professeurs',
              rooms: 'Salles',
              pendingReports: 'Rapports en attente',
              submittedReports: 'Rapports soumis',
              scheduledDefenses: 'Soutenances planifiees',
              planningValidated: 'Planning valide',
              unavailableJuries: 'Jurys indisponibles',
              gradedStudents: 'Etudiants notes',
              ungradedStudents: 'Etudiants non notes'
            },
            yes: 'Oui',
            no: 'Non',
            gradeDistribution: 'Distribution des notes (moyenne)',
            gradesNote: 'Les notes sont basees sur la moyenne des evaluations enregistrees.',
            conflicts: 'Jurys indisponibles (conflits)'
          }
        : {
            title: 'Overall statistics',
            subtitle: 'Overview of defenses, reports, juries, and grades',
            calendarTitle: 'Defense calendar',
            calendarSubtitle: 'All planned defense dates, visible by month and as a full list.',
            previousMonth: 'Previous month',
            nextMonth: 'Next month',
            week: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
            defenseTitle: (count) => `${count} defense(s)`,
            monthSummary: (count) => `${count} date(s) with defense in this month`,
            allDates: (count) => `All defense dates (${count})`,
            noDates: 'No defense dates are scheduled yet.',
            dayCount: (count) => `${count} defense(s)`,
            student: 'Student',
            totals: {
              totalStudents: 'Total students',
              totalTeachers: 'Total professors',
              rooms: 'Rooms',
              pendingReports: 'Pending reports',
              submittedReports: 'Submitted reports',
              scheduledDefenses: 'Scheduled defenses',
              planningValidated: 'Schedule validated',
              unavailableJuries: 'Unavailable juries',
              gradedStudents: 'Graded students',
              ungradedStudents: 'Ungraded students'
            },
            yes: 'Yes',
            no: 'No',
            gradeDistribution: 'Grade distribution (average)',
            gradesNote: 'Grades are based on the average of recorded evaluations.',
            conflicts: 'Unavailable juries (conflicts)'
          },
    [isFrench]
  );

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, scheduleRes] = await Promise.all([getStats(), listSchedule()]);

        if (!statsRes.ok) {
          setError((statsRes.data && statsRes.data.errors && statsRes.data.errors[0]) || 'Unable to load statistics.');
          setStats(null);
        } else {
          setError('');
          setStats(statsRes.data || null);
        }

        if (!scheduleRes.ok) {
          setScheduleError((scheduleRes.data && scheduleRes.data.errors && scheduleRes.data.errors[0]) || 'Unable to load defense schedule.');
          setScheduleRows([]);
        } else {
          const rows = (Array.isArray(scheduleRes.data) ? scheduleRes.data : [])
            .filter((row) => row && row.day)
            .slice()
            .sort(
              (a, b) =>
                String(a.day).localeCompare(String(b.day)) ||
                String(a.time || '').localeCompare(String(b.time || '')) ||
                String(a.student || '').localeCompare(String(b.student || ''))
            );
          setScheduleError('');
          setScheduleRows(rows);

          if (rows.length) {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const upcoming = rows.find((row) => {
              const d = parseIsoDay(row.day);
              return d && d.getTime() >= startOfToday;
            });
            const pivot = upcoming || rows[0];
            const pivotDate = parseIsoDay(pivot.day);
            if (pivotDate) setCalendarMonth(new Date(pivotDate.getFullYear(), pivotDate.getMonth(), 1));
          }
        }
      } catch (e) {
        setError("Unable to reach the API (start the backend server).");
        setStats(null);
        setScheduleError('Unable to load defense schedule.');
        setScheduleRows([]);
      }
    })();
  }, []);

  const dist = stats && stats.gradeDistribution ? stats.gradeDistribution : null;
  const distKeys = ['tresBien', 'bien', 'assezBien', 'passable', 'insuffisant'];
  const graded = stats ? stats.gradedStudents || 0 : 0;
  const calendarDays = useMemo(() => monthCells(calendarMonth), [calendarMonth]);

  const rowsByDay = useMemo(() => {
    const grouped = new Map();
    for (const row of scheduleRows) {
      const day = String((row && row.day) || '').trim();
      if (!day) continue;
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(row);
    }
    return grouped;
  }, [scheduleRows]);

  const sortedDays = useMemo(() => {
    const days = Array.from(rowsByDay.keys());
    return days.sort((a, b) => {
      const da = parseIsoDay(a);
      const db = parseIsoDay(b);
      if (da && db) return da.getTime() - db.getTime();
      return String(a).localeCompare(String(b));
    });
  }, [rowsByDay]);

  const dayPaletteByDay = useMemo(() => {
    const m = new Map();
    sortedDays.forEach((day, idx) => {
      m.set(day, buildDayPalette(idx));
    });
    return m;
  }, [sortedDays]);

  const monthDays = useMemo(
    () =>
      sortedDays.filter((day) => {
        const d = parseIsoDay(day);
        return !!d && d.getFullYear() === calendarMonth.getFullYear() && d.getMonth() === calendarMonth.getMonth();
      }),
    [sortedDays, calendarMonth]
  );

  const monthDayKeyByNumber = useMemo(() => {
    const m = new Map();
    for (const day of monthDays) {
      const d = parseIsoDay(day);
      if (!d) continue;
      m.set(d.getDate(), day);
    }
    return m;
  }, [monthDays]);

  const countByDayNumber = useMemo(() => {
    const m = new Map();
    for (const day of monthDays) {
      const d = parseIsoDay(day);
      if (!d) continue;
      m.set(d.getDate(), (rowsByDay.get(day) || []).length);
    }
    return m;
  }, [monthDays, rowsByDay]);

  return (
    <div>
      <h2 className="title">{labels.title}</h2>
      <p className="subtitle">{labels.subtitle}</p>
      {error && <div className="errors">{error}</div>}

      <div className="dashboard-calendar" style={{ marginTop: 18 }}>
        <h3 className="title" style={{ fontSize: 16, textAlign: 'left' }}>
          {labels.calendarTitle}
        </h3>
        <p className="subtitle" style={{ textAlign: 'left' }}>
          {labels.calendarSubtitle}
        </p>

        {scheduleError && <div className="errors">{scheduleError}</div>}

        <div className="dashboard-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 10 }}>
          <div className="stat-card defense-calendar-pane" style={{ padding: 14 }}>
            <div className="widget-head">
              <button
                className="mini-nav-btn"
                type="button"
                onClick={() => setCalendarMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}
                aria-label={labels.previousMonth}
              >
                {'<'}
              </button>
              <h4>{fmtMonthYear(calendarMonth, locale)}</h4>
              <button
                className="mini-nav-btn"
                type="button"
                onClick={() => setCalendarMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}
                aria-label={labels.nextMonth}
              >
                {'>'}
              </button>
            </div>

            <div className="mini-days">
              {labels.week.map((d, idx) => (
                <span key={`${d}-${idx}`}>{d}</span>
              ))}
            </div>

            <div className="mini-grid">
              {calendarDays.map((day, idx) => {
                const count = day ? Number(countByDayNumber.get(day) || 0) : 0;
                const dayKey = day ? monthDayKeyByNumber.get(day) || null : null;
                const palette = dayKey ? dayPaletteByDay.get(dayKey) : null;
                const rows = dayKey ? rowsByDay.get(dayKey) || [] : [];
                const hasDefense = count > 0;
                return (
                  <div
                    key={`${day}-${idx}`}
                    className="mini-day"
                    title={count ? labels.defenseTitle(count) : ''}
                    style={
                      hasDefense
                        ? {
                            background: palette ? palette.daySoft : 'var(--surface-select)',
                            border: `1px solid ${palette ? palette.accent : 'var(--primary)'}`,
                            color: 'var(--text-strong)',
                            fontWeight: 800,
                            borderRadius: 10
                          }
                        : undefined
                    }
                  >
                    {day ? (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          gridTemplateRows: hasDefense ? '1fr auto' : '1fr',
                          alignItems: 'center',
                          justifyItems: 'center',
                          padding: hasDefense ? '3px 2px 2px' : 0,
                          gap: hasDefense ? 2 : 0
                        }}
                      >
                        <span>{day}</span>
                        {hasDefense && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, maxWidth: '100%', overflow: 'hidden' }}>
                            {rows.slice(0, 3).map((_, rowIdx) => (
                              <span
                                key={`${dayKey || day}-dot-${rowIdx}`}
                                aria-hidden="true"
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 999,
                                  background: groupColor(palette, rowIdx),
                                  boxShadow: '0 0 0 1px rgba(255,255,255,0.65)'
                                }}
                              />
                            ))}
                            {rows.length > 3 && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1 }}>+{rows.length - 3}</span>
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      ''
                    )}
                  </div>
                );
              })}
            </div>

            <p className="subtitle" style={{ textAlign: 'left', marginTop: 10, marginBottom: 0 }}>
              {labels.monthSummary(monthDays.length)}
            </p>

            {monthDays.length > 0 && (
              <div className="defense-calendar-legend" style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 140, overflow: 'auto', paddingRight: 2 }}>
                {monthDays.map((day) => {
                  const d = parseIsoDay(day);
                  const count = d ? Number(countByDayNumber.get(d.getDate()) || 0) : 0;
                  const palette = dayPaletteByDay.get(day);
                  const rows = rowsByDay.get(day) || [];
                  return (
                    <div key={`legend-${day}`} style={{ display: 'grid', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: palette ? palette.accent : 'var(--primary)',
                            flex: '0 0 auto'
                          }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {fmtLongDay(day, locale)} ({count})
                        </span>
                      </div>

                      {rows.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 18 }}>
                          {rows.map((row, rowIdx) => (
                            <span
                              key={`legend-${day}-${row.student_email || rowIdx}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                borderRadius: 999,
                                border: `1px solid ${palette ? palette.accentSoft : 'var(--line)'}`,
                                background: 'var(--surface-soft)',
                                padding: '1px 6px',
                                fontSize: 11,
                                color: 'var(--text-strong)',
                                fontWeight: 700
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 999,
                                  background: groupColor(palette, rowIdx),
                                  flex: '0 0 auto'
                                }}
                              />
                              {`G${rowIdx + 1}`} {row.student || row.student_email || labels.student}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="stat-card defense-calendar-pane" style={{ padding: 14 }}>
            <p className="stat-label" style={{ margin: 0 }}>
              {labels.allDates(scheduleRows.length)}
            </p>

            <div className="defense-calendar-list" style={{ marginTop: 10, display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto', paddingRight: 4 }}>
              {!sortedDays.length && (
                <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
                  {labels.noDates}
                </p>
              )}

              {sortedDays.map((day) => {
                const rows = rowsByDay.get(day) || [];
                const palette = dayPaletteByDay.get(day);
                return (
                  <div
                    className="defense-day-card"
                    key={day}
                    style={{
                      border: `1px solid ${palette ? palette.accent : 'var(--line)'}`,
                      borderRadius: 12,
                      padding: 10,
                      background: palette ? `linear-gradient(180deg, ${palette.daySoft} 0%, var(--surface-soft) 100%)` : 'var(--surface-soft)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong style={{ color: 'var(--text-strong)', fontSize: 13 }}>{fmtLongDay(day, locale)}</strong>
                      <span
                        style={{
                          color: 'var(--text-strong)',
                          fontSize: 12,
                          fontWeight: 800,
                          borderRadius: 999,
                          border: `1px solid ${palette ? palette.accentSoft : 'var(--line)'}`,
                          background: palette ? palette.daySoft : 'var(--surface-soft)',
                          padding: '1px 8px'
                        }}
                      >
                        {labels.dayCount(rows.length)}
                      </span>
                    </div>

                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      {rows.map((row, idx) => (
                        <div
                          className="defense-day-row"
                          key={`${day}-${row.student_email || idx}-${row.time || ''}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '74px 1fr auto',
                            gap: 8,
                            alignItems: 'center',
                            borderRadius: 10,
                            border: `1px solid ${palette ? palette.accentSoft : 'var(--line)'}`,
                            background: palette ? palette.rowShades[idx % palette.rowShades.length] : 'var(--surface-select)',
                            padding: '6px 8px'
                          }}
                        >
                          <strong style={{ color: 'var(--text-strong)', fontSize: 12 }}>{row.time || '--:--'}</strong>
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                            {row.student || row.student_email || labels.student}
                            {row.room ? ` - ${row.room}` : ''}
                          </span>
                          <span
                            style={{
                              borderRadius: 999,
                              border: `1px solid ${groupColor(palette, idx)}`,
                              background: groupColor(palette, idx),
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '1px 7px'
                            }}
                          >
                            G{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.totalStudents}</p>
          <p className="stat-value">{stats ? stats.totalStudents : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.totalTeachers}</p>
          <p className="stat-value">{stats ? stats.totalTeachers : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.rooms}</p>
          <p className="stat-value">{stats ? stats.rooms : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.pendingReports}</p>
          <p className="stat-value">{stats ? stats.pendingReports : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.submittedReports}</p>
          <p className="stat-value">{stats ? stats.submittedReports : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.scheduledDefenses}</p>
          <p className="stat-value">{stats ? stats.scheduledDefenses : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.planningValidated}</p>
          <p className="stat-value">{stats && stats.planningValidated ? labels.yes : labels.no}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.unavailableJuries}</p>
          <p className="stat-value">{stats ? stats.unavailableJuries : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.gradedStudents}</p>
          <p className="stat-value">{stats ? stats.gradedStudents : 0}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{labels.totals.ungradedStudents}</p>
          <p className="stat-value">{stats ? stats.ungradedStudents : 0}</p>
        </div>
      </div>

      {dist && graded > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="title" style={{ fontSize: 16, textAlign: 'left' }}>
            {labels.gradeDistribution}
          </h3>
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            {distKeys.map((k) => {
              const n = Number(dist[k] || 0);
              const pct = graded > 0 ? Math.round((n / graded) * 100) : 0;
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '190px 1fr 56px', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 700 }}>{labelBucket(k, isFrench)}</div>
                  <div style={{ height: 10, background: 'var(--progress-track)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--progress-fill)' }} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>{n}</div>
                </div>
              );
            })}
          </div>
          <p className="subtitle" style={{ textAlign: 'left', marginTop: 10 }}>
            {labels.gradesNote}
          </p>
        </div>
      )}

      {stats && Array.isArray(stats.unavailableJuryEmails) && stats.unavailableJuryEmails.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 className="title" style={{ fontSize: 16, textAlign: 'left' }}>
            {labels.conflicts}
          </h3>
          <p className="subtitle" style={{ textAlign: 'left' }}>
            {stats.unavailableJuryEmails.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
