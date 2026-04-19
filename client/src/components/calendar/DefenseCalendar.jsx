import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

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

function fmtMonthYear(dateObj, locale) {
  try {
    const text = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
  }
}

function fmtLongDay(day, locale) {
  const d = parseIsoDay(day);
  if (!d) return String(day || '');
  try {
    const text = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return String(day || '');
  }
}

function pickDefaultMonth(days) {
  if (!days.length) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const upcoming = days.find((day) => {
    const d = parseIsoDay(day);
    return d && d.getTime() >= todayStart;
  });
  const picked = parseIsoDay(upcoming || days[0]);
  if (!picked) return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(picked.getFullYear(), picked.getMonth(), 1);
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

function normalizeRow(row) {
  if (!row) return null;
  const day = String(row.defense_date || row.day || '').trim();
  if (!day) return null;
  return {
    day,
    time: String(row.defense_time || row.time || '').trim(),
    room: String(row.defense_room || row.room || '').trim(),
    student: String(row.student_name || row.student || row.student_email || '').trim(),
    student_email: String(row.student_email || '').trim(),
    title: String(row.project_title || row.title || '').trim()
  };
}

function normalizeMarker(marker) {
  if (!marker) return null;
  const day = String(marker.day || marker.date || marker.defense_date || '').trim();
  if (!day) return null;
  return {
    day,
    kind: String(marker.kind || marker.type || 'event').trim().toLowerCase(),
    label: String(marker.label || marker.title || '').trim()
  };
}

function markerTone(kind) {
  const key = String(kind || '').trim().toLowerCase();
  if (key === 'report_deadline') {
    return {
      accent: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.62)',
      soft: 'rgba(245, 158, 11, 0.18)'
    };
  }
  if (key === 'memoire_deadline') {
    return {
      accent: '#10b981',
      border: 'rgba(16, 185, 129, 0.60)',
      soft: 'rgba(16, 185, 129, 0.18)'
    };
  }
  return {
    accent: '#0ea5e9',
    border: 'rgba(14, 165, 233, 0.58)',
    soft: 'rgba(14, 165, 233, 0.18)'
  };
}

function markerLabel(kind, labels, explicitLabel = '') {
  const text = String(explicitLabel || '').trim();
  if (text) return text;
  const key = String(kind || '').trim().toLowerCase();
  if (key === 'report_deadline') return labels.reportDeadlineLabel;
  if (key === 'memoire_deadline') return labels.memoireDeadlineLabel;
  return labels.event;
}

export default function DefenseCalendar({ title, subtitle, rows, markers = [], emptyText = '', className = '', labelOverrides = null }) {
  const { isFrench, locale } = useLanguage();
  const labels = useMemo(
    () => {
      const base = isFrench
        ? {
            week: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            previousMonth: 'Mois precedent',
            nextMonth: 'Mois suivant',
            defensesCountTitle: (count) => `${count} soutenance(s)`,
            monthSummary: (count) => `${count} date(s) avec soutenance ce mois`,
            student: 'Etudiant',
            group: 'Groupe',
            allDates: (count) => `Toutes les dates de soutenance (${count})`,
            dayDefenses: (count) => `${count} soutenance(s)`,
            noDateInList: 'Aucune date de soutenance planifiee.',
            emptyTextDefault: 'Aucune date planifiee.',
            event: 'Evenement',
            defenseLabel: 'Soutenance',
            reportDeadlineLabel: 'Deadline rapport',
            memoireDeadlineLabel: 'Deadline memoire'
          }
        : {
            week: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
            previousMonth: 'Previous month',
            nextMonth: 'Next month',
            defensesCountTitle: (count) => `${count} defense(s)`,
            monthSummary: (count) => `${count} date(s) with defense this month`,
            student: 'Student',
            group: 'Group',
            allDates: (count) => `All defense dates (${count})`,
            dayDefenses: (count) => `${count} defense(s)`,
            noDateInList: 'No defense date is currently scheduled.',
            emptyTextDefault: 'No defense date is currently scheduled.',
            event: 'Event',
            defenseLabel: 'Defense',
            reportDeadlineLabel: 'Report deadline',
            memoireDeadlineLabel: 'Thesis deadline'
          };
      if (!labelOverrides || typeof labelOverrides !== 'object') return base;
      return { ...base, ...labelOverrides };
    },
    [isFrench, labelOverrides]
  );
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeMarkers = Array.isArray(markers) ? markers : [];
  const resolvedEmptyText = String(emptyText || '').trim() || labels.emptyTextDefault;

  const normalizedRows = useMemo(() => {
    return safeRows
      .map(normalizeRow)
      .filter(Boolean)
      .sort(
        (a, b) =>
          String(a.day).localeCompare(String(b.day)) ||
          String(a.time || '').localeCompare(String(b.time || '')) ||
          String(a.student || a.student_email || '').localeCompare(String(b.student || b.student_email || ''))
      );
  }, [safeRows]);

  const normalizedMarkers = useMemo(() => {
    return safeMarkers
      .map(normalizeMarker)
      .filter(Boolean)
      .sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.kind).localeCompare(String(b.kind)) || String(a.label).localeCompare(String(b.label)));
  }, [safeMarkers]);

  const rowsByDay = useMemo(() => {
    const map = new Map();
    for (const row of normalizedRows) {
      const key = String(row.day || '').trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }, [normalizedRows]);

  const markersByDay = useMemo(() => {
    const map = new Map();
    for (const marker of normalizedMarkers) {
      const key = String(marker.day || '').trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(marker);
    }
    return map;
  }, [normalizedMarkers]);

  const sortedDays = useMemo(() => {
    const keys = new Set([...rowsByDay.keys(), ...markersByDay.keys()]);
    const days = Array.from(keys);
    return days.sort((a, b) => {
      const da = parseIsoDay(a);
      const db = parseIsoDay(b);
      if (da && db) return da.getTime() - db.getTime();
      return String(a).localeCompare(String(b));
    });
  }, [rowsByDay, markersByDay]);

  const dayPaletteByDay = useMemo(() => {
    const map = new Map();
    sortedDays.forEach((day, idx) => map.set(day, buildDayPalette(idx)));
    return map;
  }, [sortedDays]);

  const defaultMonth = useMemo(() => pickDefaultMonth(sortedDays), [sortedDays]);
  const [calendarMonth, setCalendarMonth] = useState(defaultMonth);
  useEffect(() => {
    setCalendarMonth(defaultMonth);
  }, [defaultMonth]);

  const calendarDays = useMemo(() => monthCells(calendarMonth), [calendarMonth]);

  const monthDays = useMemo(
    () =>
      sortedDays.filter((day) => {
        const d = parseIsoDay(day);
        return !!d && d.getFullYear() === calendarMonth.getFullYear() && d.getMonth() === calendarMonth.getMonth();
      }),
    [sortedDays, calendarMonth]
  );

  const monthDayKeyByNumber = useMemo(() => {
    const map = new Map();
    for (const day of monthDays) {
      const d = parseIsoDay(day);
      if (!d) continue;
      map.set(d.getDate(), day);
    }
    return map;
  }, [monthDays]);

  const dayEventsByDay = useMemo(() => {
    const map = new Map();
    for (const day of sortedDays) {
      const events = [];
      const dayRows = rowsByDay.get(day) || [];
      dayRows.forEach((row, idx) => {
        events.push({
          kind: 'defense',
          row,
          groupIndex: idx,
          label: labels.defenseLabel
        });
      });
      const dayMarkers = markersByDay.get(day) || [];
      dayMarkers.forEach((marker) => {
        events.push({
          kind: marker.kind,
          marker,
          groupIndex: null,
          label: markerLabel(marker.kind, labels, marker.label)
        });
      });
      map.set(day, events);
    }
    return map;
  }, [sortedDays, rowsByDay, markersByDay, labels]);

  const countByDayNumber = useMemo(() => {
    const map = new Map();
    for (const day of monthDays) {
      const d = parseIsoDay(day);
      if (!d) continue;
      map.set(d.getDate(), (dayEventsByDay.get(day) || []).length);
    }
    return map;
  }, [monthDays, dayEventsByDay]);

  const totalEvents = normalizedRows.length + normalizedMarkers.length;
  const hasCalendarData = sortedDays.length > 0;

  return (
    <section className={`stat-card defense-calendar prof-box ${className}`.trim()} style={{ marginTop: 18, padding: 14 }}>
      <h3 className="title" style={{ fontSize: 16, textAlign: 'left', margin: 0 }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="subtitle" style={{ textAlign: 'left', marginTop: 6 }}>
          {subtitle}
        </p>
      ) : null}

      {!hasCalendarData ? (
        <p className="subtitle" style={{ textAlign: 'left', marginTop: 10, marginBottom: 0 }}>
          {resolvedEmptyText}
        </p>
      ) : (
        <div className="defense-calendar-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 10 }}>
          <div className="defense-calendar-pane" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-soft)', padding: 14 }}>
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
                const dayRows = dayKey ? rowsByDay.get(dayKey) || [] : [];
                const dayMarkers = dayKey ? markersByDay.get(dayKey) || [] : [];
                const dayEvents = dayKey ? dayEventsByDay.get(dayKey) || [] : [];
                const hasDefense = dayRows.length > 0;
                const hasMarkers = dayMarkers.length > 0;
                const markerBaseTone = hasMarkers ? markerTone(dayMarkers[0].kind) : null;
                return (
                  <div
                    key={`${day}-${idx}`}
                    className="mini-day"
                    title={count ? labels.defensesCountTitle(count) : ''}
                    style={
                      hasDefense
                        ? {
                            background: palette ? palette.daySoft : 'var(--surface-select)',
                            border: `1px solid ${palette ? palette.accent : 'var(--primary)'}`,
                            color: 'var(--text-strong)',
                            fontWeight: 800,
                            borderRadius: 10
                          }
                        : hasMarkers
                          ? {
                              background: markerBaseTone ? markerBaseTone.soft : 'var(--surface-select)',
                              border: `1px solid ${markerBaseTone ? markerBaseTone.border : 'var(--line)'}`,
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
                          gridTemplateRows: dayEvents.length ? '1fr auto' : '1fr',
                          alignItems: 'center',
                          justifyItems: 'center',
                          padding: dayEvents.length ? '3px 2px 2px' : 0,
                          gap: dayEvents.length ? 2 : 0
                        }}
                      >
                        <span>{day}</span>
                        {dayEvents.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, maxWidth: '100%', overflow: 'hidden' }}>
                            {dayEvents.slice(0, 3).map((event, rowIdx) => (
                              <span
                                key={`${dayKey || day}-dot-${rowIdx}`}
                                aria-hidden="true"
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 999,
                                  background:
                                    event.kind === 'defense'
                                      ? groupColor(palette, event.groupIndex !== null ? event.groupIndex : rowIdx)
                                      : markerTone(event.kind).accent,
                                  boxShadow: '0 0 0 1px rgba(255,255,255,0.65)'
                                }}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1 }}>+{dayEvents.length - 3}</span>
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
                  const dayRows = rowsByDay.get(day) || [];
                  const dayMarkers = markersByDay.get(day) || [];
                  const dayEvents = dayEventsByDay.get(day) || [];
                  const leadingTone = dayRows.length ? null : dayMarkers.length ? markerTone(dayMarkers[0].kind) : null;
                  return (
                    <div key={`legend-${day}`} style={{ display: 'grid', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: palette ? palette.accent : leadingTone ? leadingTone.accent : 'var(--primary)',
                            flex: '0 0 auto'
                          }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {fmtLongDay(day, locale)} ({count})
                        </span>
                      </div>

                      {dayEvents.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 18 }}>
                          {dayEvents.map((event, rowIdx) => {
                            const row = event.row || null;
                            const tone = markerTone(event.kind);
                            const isDefense = event.kind === 'defense';
                            return (
                            <span
                              key={`legend-${day}-${isDefense ? row && row.student_email : event.kind}-${rowIdx}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                borderRadius: 999,
                                border: `1px solid ${isDefense ? (palette ? palette.accentSoft : 'var(--line)') : tone.border}`,
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
                                  background: isDefense ? groupColor(palette, event.groupIndex !== null ? event.groupIndex : rowIdx) : tone.accent,
                                  flex: '0 0 auto'
                                }}
                              />
                              {isDefense
                                ? `${labels.group} ${rowIdx + 1} ${row && (row.student || row.student_email) ? row.student || row.student_email : labels.student}`
                                : event.label}
                            </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="defense-calendar-pane" style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-soft)', padding: 14 }}>
            <p className="stat-label" style={{ margin: 0 }}>
              {labels.allDates(totalEvents)}
            </p>

            <div className="defense-calendar-list" style={{ marginTop: 10, display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto', paddingRight: 4 }}>
              {!sortedDays.length && (
                <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
                  {labels.noDateInList}
                </p>
              )}

              {sortedDays.map((day) => {
                const dayRows = rowsByDay.get(day) || [];
                const dayMarkers = markersByDay.get(day) || [];
                const dayEvents = dayEventsByDay.get(day) || [];
                const palette = dayPaletteByDay.get(day);
                const leadingTone = dayRows.length ? null : dayMarkers.length ? markerTone(dayMarkers[0].kind) : null;
                return (
                    <div
                      className="defense-day-card"
                      key={day}
                      style={{
                      border: `1px solid ${palette ? palette.accent : leadingTone ? leadingTone.border : 'var(--line)'}`,
                      borderRadius: 12,
                      padding: 10,
                      background: palette
                        ? `linear-gradient(180deg, ${palette.daySoft} 0%, var(--surface-soft) 100%)`
                        : leadingTone
                          ? `linear-gradient(180deg, ${leadingTone.soft} 0%, var(--surface-soft) 100%)`
                          : 'var(--surface-soft)'
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
                          border: `1px solid ${palette ? palette.accentSoft : leadingTone ? leadingTone.border : 'var(--line)'}`,
                          background: palette ? palette.daySoft : leadingTone ? leadingTone.soft : 'var(--surface-soft)',
                          padding: '1px 8px'
                        }}
                      >
                        {labels.dayDefenses(dayEvents.length)}
                      </span>
                    </div>

                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      {dayEvents.map((event, idx) => {
                        const isDefense = event.kind === 'defense';
                        const row = event.row || null;
                        const tone = markerTone(event.kind);
                        const groupIdx = event.groupIndex !== null ? event.groupIndex : idx;
                        const badgeText = isDefense ? `${labels.group} ${idx + 1}` : event.label;
                        return (
                          <div
                            className="defense-day-row"
                            key={`${day}-${isDefense ? row && row.student_email : event.kind}-${idx}-${isDefense ? row && row.time : ''}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '74px 1fr auto',
                              gap: 8,
                              alignItems: 'center',
                              borderRadius: 10,
                              border: `1px solid ${isDefense ? (palette ? palette.accentSoft : 'var(--line)') : tone.border}`,
                              background: isDefense ? (palette ? palette.rowShades[idx % palette.rowShades.length] : 'var(--surface-select)') : tone.soft,
                              padding: '6px 8px'
                            }}
                          >
                            <strong style={{ color: 'var(--text-strong)', fontSize: 12 }}>{isDefense ? row.time || '--:--' : labels.event}</strong>
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                              {isDefense
                                ? `${row.student || row.student_email || labels.student}${row.room ? ` - ${row.room}` : ''}${row.title ? ` - ${row.title}` : ''}`
                                : event.label}
                            </span>
                            <span
                              style={{
                                borderRadius: 999,
                                border: `1px solid ${isDefense ? groupColor(palette, groupIdx) : tone.border}`,
                                background: isDefense ? groupColor(palette, groupIdx) : tone.accent,
                                color: '#ffffff',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '1px 7px'
                              }}
                            >
                              {badgeText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
