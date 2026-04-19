import React, { useEffect, useRef, useState } from 'react';
import { saveStudentProfile, uploadStudentProfilePicture } from '../../lib/studentApi.js';

const PROFILE_PICTURE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

function show(v) {
  const value = String(v || '').trim();
  return value || 'Not provided';
}

function toFormDraft(profile) {
  return {
    first_name: String((profile && profile.first_name) || '').trim(),
    last_name: String((profile && profile.last_name) || '').trim(),
    student_id: String((profile && profile.student_id) || '').trim(),
    level: String((profile && profile.level) || '').trim(),
    speciality: String((profile && profile.speciality) || '').trim(),
    phone: String((profile && profile.phone) || '').trim(),
    registration_number: String((profile && profile.registration_number) || '').trim(),
    department: String((profile && profile.department) || '').trim(),
    academic_year: String((profile && profile.academic_year) || '').trim(),
    project_title: String((profile && profile.project_title) || '').trim(),
    advisor_name: String((profile && profile.advisor_name) || '').trim(),
    advisor_email: String((profile && profile.advisor_email) || '').trim(),
    profile_picture_url: String((profile && profile.profile_picture_url) || '').trim()
  };
}

export default function StudentProfile({ session, profile, email, onProfileSaved }) {
  const name = String((session && session.name) || '').trim();
  const studentEmail = String(email || (session && session.email) || '').trim();
  const [form, setForm] = useState(() => toFormDraft(profile));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const fileInputRef = useRef(null);
  const profilePictureUrl = String((profile && profile.profile_picture_url) || '').trim();
  const avatarSource = String((profile && profile.first_name) || name || studentEmail || '').trim();
  const avatarInitial = avatarSource ? avatarSource.charAt(0).toUpperCase() : '?';

  useEffect(() => {
    if (isEditing) return;
    setForm(toFormDraft(profile));
  }, [profile, isEditing]);

  function onChange(k, v) {
    setForm((cur) => ({ ...cur, [k]: v }));
  }

  function startEdit() {
    setForm(toFormDraft(profile));
    setPictureError('');
    setSaveError('');
    setSaveMessage('');
    setIsEditing(true);
  }

  function cancelEdit() {
    setForm(toFormDraft(profile));
    setPictureError('');
    setSaveError('');
    setSaveMessage('');
    setIsEditing(false);
  }

  async function onPickProfilePicture(file) {
    if (!file || !studentEmail || uploadingPicture) return;
    if (!String(file.type || '').startsWith('image/')) {
      setPictureError('Please select an image file (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (Number(file.size) > MAX_PROFILE_PICTURE_BYTES) {
      setPictureError('Image is too large (max 5 MB).');
      return;
    }

    setUploadingPicture(true);
    setPictureError('');
    setSaveError('');
    try {
      const r = await uploadStudentProfilePicture({ email: studentEmail, file });
      if (!r.ok) {
        setPictureError((r.data && r.data.errors && r.data.errors[0]) || 'Unable to upload profile picture.');
        return;
      }
      const nextUrl = String((r.data && (r.data.profile_picture_url || r.data.url)) || '').trim();
      const nextProfile = {
        ...(profile || {}),
        profile_picture_url: nextUrl
      };
      setForm((cur) => ({ ...cur, profile_picture_url: nextUrl }));
      setSaveMessage('Profile picture updated successfully.');
      if (typeof onProfileSaved === 'function') onProfileSaved(nextProfile);
    } catch {
      setPictureError('Unable to upload profile picture.');
    } finally {
      setUploadingPicture(false);
    }
  }

  async function onSaveProfile(ev) {
    ev.preventDefault();
    const payload = {
      first_name: String(form.first_name || '').trim(),
      last_name: String(form.last_name || '').trim(),
      student_id: String(form.student_id || '').trim(),
      level: String(form.level || '').trim(),
      speciality: String(form.speciality || '').trim(),
      phone: String(form.phone || '').trim(),
      registration_number: String(form.registration_number || '').trim(),
      department: String(form.department || '').trim(),
      academic_year: String(form.academic_year || '').trim(),
      project_title: String(form.project_title || '').trim(),
      advisor_name: String(form.advisor_name || '').trim(),
      advisor_email: String(form.advisor_email || '').trim().toLowerCase(),
      profile_picture_url: String(form.profile_picture_url || '').trim()
    };

    if (!payload.first_name || !payload.last_name || !payload.student_id || !payload.level || !payload.speciality || !payload.project_title) {
      setSaveError('Please fill First name, Last name, Student ID, Level, Speciality, and Project title.');
      setSaveMessage('');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const r = await saveStudentProfile({ email: studentEmail, ...payload });
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
          <p className="student-account-subtitle"></p>
        </header>

        <div className="student-account-avatar-card">
          <div className="student-account-avatar-frame" aria-hidden="true">
            {profilePictureUrl ? (
              <img className="student-account-avatar-image" src={profilePictureUrl} alt={`${show(name)} profile`} loading="lazy" />
            ) : (
              <span className="student-account-avatar-fallback">{avatarInitial}</span>
            )}
          </div>

          <div className="student-account-avatar-body">
            <span className="student-account-label">Profile picture</span>
            <strong className="student-account-avatar-title">{profilePictureUrl ? 'Picture uploaded' : 'No picture yet'}</strong>
            <p className="student-account-avatar-help"></p>

            <div className="student-account-avatar-actions">
              <button
                className="btn"
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                disabled={uploadingPicture || saving}
                style={{ width: 'auto', padding: '0 16px' }}
              >
                {uploadingPicture ? 'Uploading...' : profilePictureUrl ? 'Change picture' : 'Add picture'}
              </button>
              {profilePictureUrl ? (
                <a className="btn student-account-avatar-open" href={profilePictureUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : null}
            </div>

            {pictureError ? <div className="errors">{pictureError}</div> : null}

            <input
              ref={fileInputRef}
              className="student-account-avatar-input"
              type="file"
              accept={PROFILE_PICTURE_ACCEPT}
              onChange={(ev) => {
                const file = ev.target.files && ev.target.files[0];
                onPickProfilePicture(file);
                ev.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="student-account-grid">
          <div className="student-account-item">
            <span className="student-account-label">Role</span>
            <strong className="student-account-value">Student</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Account Name</span>
            <strong className="student-account-value">{show(name)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Email</span>
            <strong className="student-account-value">{show(studentEmail)}</strong>
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
            <span className="student-account-label">Student ID</span>
            <strong className="student-account-value">{show(profile && profile.student_id)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Level</span>
            <strong className="student-account-value">{show(profile && profile.level)}</strong>
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
            <span className="student-account-label">Registration Number</span>
            <strong className="student-account-value">{show(profile && profile.registration_number)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Department</span>
            <strong className="student-account-value">{show(profile && profile.department)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Academic Year</span>
            <strong className="student-account-value">{show(profile && profile.academic_year)}</strong>
          </div>
          <div className="student-account-item student-account-item-wide">
            <span className="student-account-label">Project Title</span>
            <strong className="student-account-value">{show(profile && profile.project_title)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Professor Name </span>
            <strong className="student-account-value">{show(profile && profile.advisor_name)}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">Professor email</span>
            <strong className="student-account-value">{show(profile && profile.advisor_email)}</strong>
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
                placeholder="Ex: Imene"
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
                placeholder="Ex: Bennaceur"
                autoComplete="family-name"
                required
              />
            </label>
            <label className="student-account-prof-field">
              <span>Student ID</span>
              <input
                type="text"
                value={form.student_id}
                onChange={(ev) => onChange('student_id', ev.target.value)}
                placeholder="Ex: 2024-0001"
                autoComplete="off"
                required
              />
            </label>
            <label className="student-account-prof-field">
              <span>Level</span>
              <input
                type="text"
                value={form.level}
                onChange={(ev) => onChange('level', ev.target.value)}
                placeholder="Ex: M2"
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
                placeholder="Ex: Computer Science"
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
              <span>Registration number</span>
              <input
                type="text"
                value={form.registration_number}
                onChange={(ev) => onChange('registration_number', ev.target.value)}
                placeholder="Ex: REG-2026-001"
                autoComplete="off"
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
              <span>Academic year</span>
              <input
                type="text"
                value={form.academic_year}
                onChange={(ev) => onChange('academic_year', ev.target.value)}
                placeholder="Ex: 2025/2026"
                autoComplete="off"
              />
            </label>
            <label className="student-account-prof-field">
              <span>Project title</span>
              <input
                type="text"
                value={form.project_title}
                onChange={(ev) => onChange('project_title', ev.target.value)}
                placeholder="Your project title"
                autoComplete="off"
                required
              />
            </label>
            <label className="student-account-prof-field">
              <span>Professor Name</span>
              <input
                type="text"
                value={form.advisor_name}
                onChange={(ev) => onChange('advisor_name', ev.target.value)}
                placeholder="Ex: Dr. Ahmed Benali"
                autoComplete="off"
              />
            </label>
            <label className="student-account-prof-field">
              <span>Professor Address (Email)</span>
              <input
                type="email"
                value={form.advisor_email}
                onChange={(ev) => onChange('advisor_email', ev.target.value)}
                placeholder="Ex: teacher@univ.dz"
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
