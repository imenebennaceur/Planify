import React, { useEffect, useState } from 'react';
import { saveProfessorProfile } from '../../lib/professorApi.js';

function show(v) {
  const value = String(v || '').trim();
  return value || 'Not provided';
}

function toFormDraft(profile) {
  return {
    first_name: String((profile && profile.first_name) || '').trim(),
    last_name: String((profile && profile.last_name) || '').trim(),
    teacher_id: String((profile && profile.teacher_id) || '').trim(),
    grade: String((profile && profile.grade) || '').trim(),
    speciality: String((profile && profile.speciality) || '').trim(),
    phone: String((profile && profile.phone) || '').trim(),
    department: String((profile && profile.department) || '').trim(),
    academic_rank: String((profile && profile.academic_rank) || '').trim()
  };
}

export default function ProfessorProfile({ session, profile, email, onProfileSaved }) {
  const name = String((session && session.name) || '').trim();
  const professorEmail = String(email || (session && session.email) || '').trim();
  const [form, setForm] = useState(() => toFormDraft(profile));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setForm(toFormDraft(profile));
  }, [profile]);

  function onChange(k, v) {
    setForm((cur) => ({ ...cur, [k]: v }));
  }

  function startEdit() {
    setForm(toFormDraft(profile));
    setSaveError('');
    setSaveMessage('');
    setIsEditing(true);
  }

  function cancelEdit() {
    setForm(toFormDraft(profile));
    setSaveError('');
    setSaveMessage('');
    setIsEditing(false);
  }

  async function onSaveProfile(ev) {
    ev.preventDefault();
    const payload = {
      first_name: String(form.first_name || '').trim(),
      last_name: String(form.last_name || '').trim(),
      teacher_id: String(form.teacher_id || '').trim(),
      grade: String(form.grade || '').trim(),
      speciality: String(form.speciality || '').trim(),
      phone: String(form.phone || '').trim(),
      department: String(form.department || '').trim(),
      academic_rank: String(form.academic_rank || '').trim()
    };

    if (!payload.first_name || !payload.last_name || !payload.teacher_id || !payload.grade || !payload.speciality) {
      setSaveError('Please fill First name, Last name, Professor ID, Grade, and Speciality.');
      setSaveMessage('');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const r = await saveProfessorProfile({ email: professorEmail, ...payload });
      if (!r.ok) {
        setSaveError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to update profile.');
        return;
      }
      const nextProfile = r.data && r.data.profile ? r.data.profile : payload;
      setForm(toFormDraft(nextProfile));
      setSaveMessage('Profile updated successfully.');
      setIsEditing(false);
      if (typeof onProfileSaved === 'function') {
        onProfileSaved(nextProfile);
      }
    } catch {
      setSaveError('Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-account-shell">
      <article className="student-account-card">
        <header className="student-account-head">
          <h2 className="student-account-title">My Profile</h2>
          <p className="student-account-subtitle">Your professor information.</p>
        </header>

        <div className="student-account-grid">
          <div className="student-account-item">
            <span className="student-account-label">Role</span>
            <strong className="student-account-value">Professor</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Account Name</span>
            <strong className="student-account-value">{show(name)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Email</span>
            <strong className="student-account-value">{show(professorEmail)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">First Name</span>
            <strong className="student-account-value">{show(profile && profile.first_name)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Last Name</span>
            <strong className="student-account-value">{show(profile && profile.last_name)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Professor ID</span>
            <strong className="student-account-value">{show(profile && profile.teacher_id)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Grade</span>
            <strong className="student-account-value">{show(profile && profile.grade)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Speciality</span>
            <strong className="student-account-value">{show(profile && profile.speciality)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Phone</span>
            <strong className="student-account-value">{show(profile && profile.phone)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Department</span>
            <strong className="student-account-value">{show(profile && profile.department)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Academic Rank</span>
            <strong className="student-account-value">{show(profile && profile.academic_rank)}</strong>
          </div>
        </div>

        <div className="student-account-prof-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn" type="button" onClick={isEditing ? cancelEdit : startEdit} disabled={saving} style={{ width: 'auto', padding: '0 16px' }}>
            {isEditing ? 'Cancel edit' : 'Modify my data'}
          </button>
        </div>

        {saveMessage && !isEditing ? <div className="student-account-prof-message">{saveMessage}</div> : null}

        {isEditing ? (
          <form className="student-account-prof-form" onSubmit={onSaveProfile} noValidate>
            <h3 className="student-account-prof-title">Modify my data</h3>
            <div className="student-account-prof-grid">
              <label className="student-account-prof-field">
                <span>First name</span>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(ev) => onChange('first_name', ev.target.value)}
                  placeholder="Ex: Ahmed"
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="student-account-prof-field">
                <span>Last name</span>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(ev) => onChange('last_name', ev.target.value)}
                  placeholder="Ex: Benali"
                  autoComplete="family-name"
                  required
                />
              </label>
              <label className="student-account-prof-field">
                <span>Professor ID</span>
                <input
                  type="text"
                  value={form.teacher_id}
                  onChange={(ev) => onChange('teacher_id', ev.target.value)}
                  placeholder="Ex: PR-2024-001"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="student-account-prof-field">
                <span>Grade</span>
                <input
                  type="text"
                  value={form.grade}
                  onChange={(ev) => onChange('grade', ev.target.value)}
                  placeholder="Ex: Maitre de conferences"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="student-account-prof-field">
                <span>Speciality</span>
                <input
                  type="text"
                  value={form.speciality}
                  onChange={(ev) => onChange('speciality', ev.target.value)}
                  placeholder="Ex: Artificial Intelligence"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="student-account-prof-field">
                <span>Phone</span>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(ev) => onChange('phone', ev.target.value)}
                  placeholder="Ex: +213 555 00 00 00"
                  autoComplete="tel"
                />
              </label>
              <label className="student-account-prof-field">
                <span>Department</span>
                <input
                  type="text"
                  value={form.department}
                  onChange={(ev) => onChange('department', ev.target.value)}
                  placeholder="Ex: Informatique"
                  autoComplete="off"
                />
              </label>
              <label className="student-account-prof-field">
                <span>Academic rank</span>
                <input
                  type="text"
                  value={form.academic_rank}
                  onChange={(ev) => onChange('academic_rank', ev.target.value)}
                  placeholder="Ex: Maitre de conferences A"
                  autoComplete="off"
                />
              </label>
            </div>

            {saveError ? <div className="errors">{saveError}</div> : null}
            {saveMessage ? <div className="student-account-prof-message">{saveMessage}</div> : null}

            <div className="student-account-prof-actions" style={{ gap: 10 }}>
              <button
                className="btn"
                type="button"
                onClick={() => setForm(toFormDraft(profile))}
                disabled={saving}
                style={{ width: 'auto', padding: '0 16px' }}
              >
                Reset
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : null}
      </article>
    </section>
  );
}
