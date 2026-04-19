import React, { useEffect, useMemo, useState } from 'react';
import {
  listSchedule,
  deleteSchedule,
  listRoomSlots,
  rescheduleDefense,
  getPlanningStatus,
  setPlanningStatus,
  listStudents,
  listSupervisions,
  addSupervision,
  addStudent,
  upsertDefenseRecord
} from '../../lib/adminApi.js';

function fmtSlotLabel(s) {
  if (!s) return '';
  return `${s.day} ${s.start}-${s.end} — ${s.room_name}`;
}

function fmtPlanningStatus(s) {
  if (!s || !s.validated) return 'Draft';
  return 'Validated';
}

function safeText(value) {
  return String(value || '').trim();
}

function parseEmailList(value) {
  const chunks = String(value || '')
    .split(/[\n,;]+/)
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(chunks));
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function emptyAddDefenseForm() {
  return {
    student_email: '',
    student_email_2: '',
    slot_id: '',
    day: '',
    start: '',
    end: '',
    classroom: '',
    project_title: '',
    supervisors: '',
    juries: ''
  };
}

export default function AdminSchedule({ adminEmail }) {
  const [rows, setRows] = useState([]);
  const [slots, setSlots] = useState([]);
  const [students, setStudents] = useState([]);
  const [planning, setPlanning] = useState({ validated: false, validated_at: null, validated_by: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingEmail, setEditingEmail] = useState('');
  const [slotId, setSlotId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(() => emptyAddDefenseForm());
  const [addInfoError, setAddInfoError] = useState('');
  const planningLocked = !!planning.validated;

  const editingRow = useMemo(() => rows.find((r) => r.student_email === editingEmail) || null, [rows, editingEmail]);

  const availableSlots = useMemo(() => {
    if (!editingRow) return [];
    const email = editingRow.student_email;
    return (Array.isArray(slots) ? slots : [])
      .filter((s) => !s.reserved_by || s.reserved_by === email)
      .sort(
        (a, b) =>
          String(a.day).localeCompare(String(b.day)) ||
          String(a.start).localeCompare(String(b.start)) ||
          String(a.room_name).localeCompare(String(b.room_name))
      );
  }, [slots, editingRow]);

  const scheduledEmails = useMemo(() => new Set(rows.map((r) => String(r.student_email || '').toLowerCase()).filter(Boolean)), [rows]);

  const unscheduledStudents = useMemo(() => {
    return (Array.isArray(students) ? students : [])
      .filter((s) => !scheduledEmails.has(String((s && s.user_email) || '').toLowerCase()))
      .sort((a, b) => {
        const aName = safeText(`${safeText(a && a.first_name)} ${safeText(a && a.last_name)}`) || safeText(a && a.account_name) || safeText(a && a.user_email);
        const bName = safeText(`${safeText(b && b.first_name)} ${safeText(b && b.last_name)}`) || safeText(b && b.account_name) || safeText(b && b.user_email);
        return aName.localeCompare(bName) || String((a && a.user_email) || '').localeCompare(String((b && b.user_email) || ''));
      });
  }, [students, scheduledEmails]);

  const selectedAddStudent = useMemo(() => {
    const target = String(addForm.student_email || '').trim().toLowerCase();
    if (!target) return null;
    return (Array.isArray(students) ? students : []).find((s) => String((s && s.user_email) || '').toLowerCase() === target) || null;
  }, [students, addForm.student_email]);

  const selectedAddStudent2 = useMemo(() => {
    const target = String(addForm.student_email_2 || '').trim().toLowerCase();
    if (!target) return null;
    return (Array.isArray(students) ? students : []).find((s) => String((s && s.user_email) || '').toLowerCase() === target) || null;
  }, [students, addForm.student_email_2]);

  const availableAddSlots = useMemo(() => {
    const email = String(addForm.student_email || '').trim().toLowerCase();
    return (Array.isArray(slots) ? slots : [])
      .filter((s) => !s.reserved_by || String(s.reserved_by).toLowerCase() === email)
      .sort(
        (a, b) =>
          String(a.day).localeCompare(String(b.day)) ||
          String(a.start).localeCompare(String(b.start)) ||
          String(a.room_name).localeCompare(String(b.room_name))
      );
  }, [slots, addForm.student_email]);

  const selectedAddSlot = useMemo(() => {
    const target = String(addForm.slot_id || '').trim();
    if (!target) return null;
    return availableAddSlots.find((s) => String((s && s.id) || '') === target) || null;
  }, [availableAddSlots, addForm.slot_id]);

  async function load() {
    setLoading(true);

    const [r, s, p, st] = await Promise.all([listSchedule(), listRoomSlots(), getPlanningStatus(), listStudents()]);

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load schedule.');
      setRows([]);
      setSlots([]);
      setStudents([]);
      setPlanning({ validated: false, validated_at: null, validated_by: null });
      setLoading(false);
      return;
    }
    if (!s.ok) {
      setError((s.data && s.data.errors && s.data.errors[0]) || 'Unable to load time slots.');
      setRows(Array.isArray(r.data) ? r.data : []);
      setSlots([]);
      setStudents(st && st.ok && Array.isArray(st.data) ? st.data : []);
      setPlanning(p && p.ok ? p.data || planning : planning);
      setLoading(false);
      return;
    }

    setError('');
    setRows(Array.isArray(r.data) ? r.data : []);
    setSlots(Array.isArray(s.data) ? s.data : []);
    setStudents(st && st.ok && Array.isArray(st.data) ? st.data : []);
    setPlanning(
      p && p.ok ? p.data || { validated: false, validated_at: null, validated_by: null } : { validated: false, validated_at: null, validated_by: null }
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editingRow) return;
    const current = editingRow.slot_id ? String(editingRow.slot_id) : '';
    setSlotId(current);
  }, [editingEmail]);

  useEffect(() => {
    if (!planningLocked) return;
    setEditingEmail('');
    setSlotId('');
    setShowAdd(false);
    setAddForm(emptyAddDefenseForm());
    setAddInfoError('');
  }, [planningLocked]);

  useEffect(() => {
    if (!selectedAddSlot) return;
    setAddForm((prev) => ({
      ...prev,
      day: String(selectedAddSlot.day || ''),
      start: String(selectedAddSlot.start || ''),
      end: String(selectedAddSlot.end || ''),
      classroom: String(selectedAddSlot.room_name || '')
    }));
  }, [selectedAddSlot]);

  useEffect(() => {
    const emailOne = String(addForm.student_email || '').trim().toLowerCase();
    const emailTwo = String(addForm.student_email_2 || '').trim().toLowerCase();
    const targets = Array.from(new Set([emailOne, emailTwo].filter(Boolean)));
    if (!targets.length) {
      setAddInfoError('');
      return;
    }
    const nextTitle = safeText((selectedAddStudent && selectedAddStudent.project_title) || '');
    setAddForm((prev) => {
      if (safeText(prev.project_title) || !nextTitle) return prev;
      return { ...prev, project_title: nextTitle };
    });

    let alive = true;
    (async () => {
      const loaded = [];
      for (const email of targets) {
        const r = await listSupervisions(email);
        if (!alive) return;
        if (!r.ok) {
          setAddInfoError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to load supervision/jury assignments.');
          return;
        }
        loaded.push(Array.isArray(r.data) ? r.data : []);
      }
      const all = loaded.flat();
      const sup = all
        .filter((x) => x && x.role === 'supervisor')
        .map((x) => String(x.teacher_email || '').trim().toLowerCase())
        .filter(Boolean);
      const jury = all
        .filter((x) => x && x.role === 'jury')
        .map((x) => String(x.teacher_email || '').trim().toLowerCase())
        .filter(Boolean);
      setAddInfoError('');
      setAddForm((prev) => ({
        ...prev,
        supervisors: Array.from(new Set(sup)).join(', '),
        juries: Array.from(new Set(jury)).join(', ')
      }));
    })();
    return () => {
      alive = false;
    };
  }, [addForm.student_email, addForm.student_email_2, selectedAddStudent, selectedAddStudent2]);

  async function onToggleValidate() {
    const next = !planning.validated;
    const r = await setPlanningStatus({ validated: next, validated_by: adminEmail || '' });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to update schedule status.');
      return;
    }
    setError('');
    const p = await getPlanningStatus();
    if (p.ok) setPlanning(p.data || planning);
  }

  async function onReschedule() {
    if (planningLocked) {
      setError('Planning is validated. Set it back to draft before editing.');
      return;
    }
    if (!editingRow) return;
    const id = Number(slotId);
    if (!Number.isInteger(id)) {
      setError('Please select a time slot.');
      return;
    }
    const r = await rescheduleDefense({ student_email: editingRow.student_email, slot_id: id });
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to update defense.');
      return;
    }
    setError('');
    setEditingEmail('');
    setSlotId('');
    await load();
    alert('Defense updated');
  }

  function onAddChange(key, value) {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onAddDefense(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (planningLocked) {
      setError('Planning is validated. Set it back to draft before editing.');
      return;
    }

    const studentOne = String(addForm.student_email || '').trim().toLowerCase();
    const studentTwo = String(addForm.student_email_2 || '').trim().toLowerCase();
    if (!isEmailLike(studentOne)) {
      setError('Please select a valid student email.');
      return;
    }
    if (studentTwo && !isEmailLike(studentTwo)) {
      setError('Second student email is invalid.');
      return;
    }
    if (studentTwo && studentTwo === studentOne) {
      setError('Group work requires two different students.');
      return;
    }
    const studentEmails = Array.from(new Set([studentOne, studentTwo].filter(Boolean)));

    const selectedSlotId = Number(addForm.slot_id);
    const fromSlot = Number.isInteger(selectedSlotId) && !!selectedAddSlot;
    const day = safeText(fromSlot ? selectedAddSlot.day : addForm.day);
    const start = safeText(fromSlot ? selectedAddSlot.start : addForm.start);
    const end = safeText(fromSlot ? selectedAddSlot.end : addForm.end);
    const classroom = safeText(fromSlot ? selectedAddSlot.room_name : addForm.classroom);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError('Please provide a valid defense date (YYYY-MM-DD).');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      setError('Please provide valid start/end time (HH:MM).');
      return;
    }
    if (start >= end) {
      setError('End time must be after start time.');
      return;
    }
    if (!classroom) {
      setError('Please provide the room/classroom.');
      return;
    }
    const defenseTime = `${start}-${end}`;

    const projectTitle = safeText(addForm.project_title);
    const supervisors = parseEmailList(addForm.supervisors);
    const juries = parseEmailList(addForm.juries).filter((email) => !supervisors.includes(email));
    const invalidEmail = [...supervisors, ...juries].find((email) => !isEmailLike(email));
    if (invalidEmail) {
      setError(`Invalid teacher email: ${invalidEmail}`);
      return;
    }

    for (const student_email of studentEmails) {
      const selected = (Array.isArray(students) ? students : []).find((s) => String((s && s.user_email) || '').toLowerCase() === student_email) || null;
      const currentProjectTitle = safeText(selected && selected.project_title);
      if (projectTitle && projectTitle !== currentProjectTitle) {
        const upsertStudentRes = await addStudent({
          user_email: student_email,
          student_id: safeText(selected && selected.student_id),
          first_name: safeText(selected && selected.first_name),
          last_name: safeText(selected && selected.last_name),
          level: safeText(selected && selected.level),
          speciality: safeText(selected && selected.speciality),
          advisor_name: safeText(selected && selected.advisor_name),
          advisor_email: safeText(selected && selected.advisor_email),
          project_title: projectTitle
        });
        if (!upsertStudentRes.ok) {
          setError((upsertStudentRes.data && upsertStudentRes.data.errors && upsertStudentRes.data.errors[0]) || 'Unable to update project title.');
          return;
        }
      }

      for (const teacher_email of supervisors) {
        const r = await addSupervision({ student_email, teacher_email, role: 'supervisor' });
        if (!r.ok) {
          setError((r.data && r.data.errors && r.data.errors[0]) || `Unable to add supervisor ${teacher_email}.`);
          return;
        }
      }
      for (const teacher_email of juries) {
        const r = await addSupervision({ student_email, teacher_email, role: 'jury' });
        if (!r.ok) {
          setError((r.data && r.data.errors && r.data.errors[0]) || `Unable to add jury ${teacher_email}.`);
          return;
        }
      }
    }

    const juryText = [...supervisors, ...juries].join(', ');
    if (fromSlot) {
      const first = studentEmails[0];
      const firstRes = await rescheduleDefense({ student_email: first, slot_id: selectedSlotId });
      if (!firstRes.ok) {
        setError((firstRes.data && firstRes.data.errors && firstRes.data.errors[0]) || 'Unable to add defense.');
        return;
      }
      const others = studentEmails.slice(1);
      for (const student_email of others) {
        const r = await upsertDefenseRecord({
          email: student_email,
          date: day,
          time: defenseTime,
          classroom,
          jury: juryText
        });
        if (!r.ok) {
          setError((r.data && r.data.errors && r.data.errors[0]) || `Unable to add grouped defense for ${student_email}.`);
          return;
        }
      }
    } else {
      for (const student_email of studentEmails) {
        const r = await upsertDefenseRecord({
          email: student_email,
          date: day,
          time: defenseTime,
          classroom,
          jury: juryText
        });
        if (!r.ok) {
          setError((r.data && r.data.errors && r.data.errors[0]) || `Unable to add defense for ${student_email}.`);
          return;
        }
      }
    }

    setError('');
    setAddInfoError('');
    setShowAdd(false);
    setAddForm(emptyAddDefenseForm());
    await load();
    alert(studentEmails.length > 1 ? 'Group defense added' : 'Defense added');
  }

  async function onDelete(row) {
    if (planningLocked) {
      setError('Planning is validated. Set it back to draft before editing.');
      return;
    }
    const email = row && row.student_email;
    if (!email) {
      setError('Unable to delete this row (missing email).');
      return;
    }
    const ok = confirm(`Delete defense for ${email}?`);
    if (!ok) return;
    const r = await deleteSchedule(email);
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to delete defense.');
      return;
    }
    setError('');
    await load();
  }

  return (
    <div>
      <h2 className="title">Defense schedule</h2>
      <p className="subtitle">Manage and edit the defense schedule (time slots, rooms, participants)</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <div style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
          <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Status:</span>{' '}
          <span style={{ fontWeight: 700 }}>{fmtPlanningStatus(planning)}</span>
          {planning.validated_at ? (
            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
              ({new Date(Number(planning.validated_at)).toLocaleString()}
              {planning.validated_by ? ` — ${planning.validated_by}` : ''})
            </span>
          ) : null}
        </div>
        <button
          className={planning.validated ? 'btn' : 'primary'}
          type="button"
          onClick={() => {
            if (planning.validated) {
              onToggleValidate();
              return;
            }
            setShowAdd((v) => !v);
            setAddInfoError('');
            setEditingEmail('');
            setSlotId('');
          }}
        >
          {planning.validated ? 'Set as draft' : showAdd ? 'Hide add form' : 'Add defense'}
        </button>
      </div>

      <div className="toolbar">
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="errors">{error}</div>}
      {planningLocked && (
        <p className="subtitle" style={{ textAlign: 'left', marginTop: 8 }}>
          Schedule is locked while validated.
        </p>
      )}

      {showAdd && !planningLocked && (
        <form
          onSubmit={onAddDefense}
          style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}
        >
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Add a defense with full details (single student or group of two)
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 10 }}>
            <div className="field select" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                A
              </span>
              <select value={addForm.student_email} onChange={(e) => onAddChange('student_email', e.target.value)}>
                <option value="">Student 1 (required)</option>
                {unscheduledStudents.map((s, idx) => {
                  const fullName = safeText(`${safeText(s && s.first_name)} ${safeText(s && s.last_name)}`);
                  const label = fullName || safeText(s && s.account_name) || safeText(s && s.user_email) || `Student ${idx + 1}`;
                  return (
                    <option key={s.user_email || idx} value={s.user_email || ''}>
                      {label} ({s.user_email})
                    </option>
                  );
                })}
              </select>
              <span className="chevron" aria-hidden="true">
                v
              </span>
            </div>

            <div className="field select" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                B
              </span>
              <select value={addForm.student_email_2} onChange={(e) => onAddChange('student_email_2', e.target.value)}>
                <option value="">Student 2 (optional for group work)</option>
                {unscheduledStudents
                  .filter((s) => String((s && s.user_email) || '').toLowerCase() !== String(addForm.student_email || '').toLowerCase())
                  .map((s, idx) => {
                    const fullName = safeText(`${safeText(s && s.first_name)} ${safeText(s && s.last_name)}`);
                    const label = fullName || safeText(s && s.account_name) || safeText(s && s.user_email) || `Student ${idx + 1}`;
                    return (
                      <option key={`group-${s.user_email || idx}`} value={s.user_email || ''}>
                        {label} ({s.user_email})
                      </option>
                    );
                  })}
              </select>
              <span className="chevron" aria-hidden="true">
                v
              </span>
            </div>

            <div className="field select" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                T
              </span>
              <select value={addForm.slot_id} onChange={(e) => onAddChange('slot_id', e.target.value)}>
                <option value="">Time slot (optional, auto-fills date/time/room)</option>
                {availableAddSlots.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {fmtSlotLabel(s)}
                    {s.reserved_by && String(s.reserved_by).toLowerCase() === String(addForm.student_email || '').toLowerCase()
                      ? ' (already reserved)'
                      : ''}
                  </option>
                ))}
              </select>
              <span className="chevron" aria-hidden="true">
                v
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <span className="icon" aria-hidden="true">
                  D
                </span>
                <input type="date" value={addForm.day} onChange={(e) => onAddChange('day', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span className="icon" aria-hidden="true">
                  R
                </span>
                <input placeholder="Room / classroom" value={addForm.classroom} onChange={(e) => onAddChange('classroom', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <span className="icon" aria-hidden="true">
                  S
                </span>
                <input type="time" value={addForm.start} onChange={(e) => onAddChange('start', e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <span className="icon" aria-hidden="true">
                  E
                </span>
                <input type="time" value={addForm.end} onChange={(e) => onAddChange('end', e.target.value)} />
              </div>
            </div>

            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                P
              </span>
              <input
                placeholder="Project title"
                value={addForm.project_title}
                onChange={(e) => onAddChange('project_title', e.target.value)}
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                S
              </span>
              <input
                placeholder="Supervisor emails (comma separated)"
                value={addForm.supervisors}
                onChange={(e) => onAddChange('supervisors', e.target.value)}
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                J
              </span>
              <input
                placeholder="Jury emails (comma separated)"
                value={addForm.juries}
                onChange={(e) => onAddChange('juries', e.target.value)}
              />
            </div>
          </div>

          {!unscheduledStudents.length && (
            <p className="subtitle" style={{ textAlign: 'left', marginTop: 10, marginBottom: 0 }}>
              All students already have a defense.
            </p>
          )}
          {!availableAddSlots.length && (
            <p className="subtitle" style={{ textAlign: 'left', marginTop: 10, marginBottom: 0 }}>
              No free slot available. You can still enter date/time/room manually.
            </p>
          )}
          {selectedAddStudent && (
            <p className="subtitle" style={{ textAlign: 'left', marginTop: 10, marginBottom: 0 }}>
              Student: {safeText(`${safeText(selectedAddStudent.first_name)} ${safeText(selectedAddStudent.last_name)}`) || selectedAddStudent.account_name || selectedAddStudent.user_email}
              {selectedAddStudent2
                ? ` + ${
                    safeText(`${safeText(selectedAddStudent2.first_name)} ${safeText(selectedAddStudent2.last_name)}`) ||
                    selectedAddStudent2.account_name ||
                    selectedAddStudent2.user_email
                  }`
                : ''}
              {' | '}
              Project: {safeText(addForm.project_title) || 'Not provided'}
              {' | '}
              Time: {safeText(addForm.day) || '-'} {safeText(addForm.start) || '--:--'}-{safeText(addForm.end) || '--:--'}
            </p>
          )}
          {addInfoError && (
            <p className="subtitle" style={{ textAlign: 'left', marginTop: 8, marginBottom: 0, color: 'var(--danger)' }}>
              {addInfoError}
            </p>
          )}

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="primary" type="submit">
              Add defense
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddInfoError('');
                setAddForm(emptyAddDefenseForm());
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {editingRow && !planningLocked && (
        <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 14, padding: 12, background: 'var(--surface-soft)' }}>
          <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Edit defense — {editingRow.student} ({editingRow.student_email})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 10 }}>
            <div className="field select" style={{ margin: 0 }}>
              <span className="icon" aria-hidden="true">
                🗓️
              </span>
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                <option value="">Choose a time slot (date / time / room)</option>
                {availableSlots.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {fmtSlotLabel(s)}
                    {s.reserved_by && s.reserved_by === editingRow.student_email ? ' (already reserved)' : ''}
                  </option>
                ))}
              </select>
              <span className="chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="primary" type="button" onClick={onReschedule}>
              Save
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditingEmail('');
                setSlotId('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.student_email || i}-${r.day}-${r.time || ''}`}>
                <td>{r.day}</td>
                <td>{r.time || ''}</td>
                <td>{r.room}</td>
                <td>{r.student}</td>
                <td>{Array.isArray(r.supervisors) ? r.supervisors.join(', ') : r.supervisors}</td>
                <td>{Array.isArray(r.juries) ? r.juries.join(', ') : r.juries}</td>
                <td>{r.title}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setShowAdd(false);
                        setAddInfoError('');
                        setAddForm(emptyAddDefenseForm());
                        setEditingEmail(r.student_email);
                      }}
                      disabled={planningLocked}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => onDelete(r)}
                      aria-label={`Delete defense ${r.student}`}
                      disabled={planningLocked}
                    >
                      x
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: 14, color: 'var(--muted)' }}>
                  No schedule generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
