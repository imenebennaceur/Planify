import React, { useEffect, useState } from 'react';
import TopLeftBack from '../../components/ui/TopLeftBack.jsx';
import Dashboard from '../student/Dashboard.jsx';
import DefenseInfo from '../student/DefenseInfo.jsx';
import StudentGrades from '../student/Grades.jsx';
import Report from '../student/Report.jsx';
import Messaging from '../student/Messaging.jsx';
import StudentNotifications from '../student/Notifications.jsx';
import Simulator from '../student/Simulator.jsx';
import StudentProfile from '../student/Profile.jsx';
import SpaceHeader from '../../components/ui/SpaceHeader.jsx';
import { getStudentProfile, saveStudentProfile } from '../../lib/studentApi.js';
import { listNotifications } from '../../lib/notificationsApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const EMPTY_PROFILE = {
  first_name: '',
  last_name: '',
  student_id: '',
  level: '',
  speciality: '',
  phone: '',
  registration_number: '',
  department: '',
  academic_year: '',
  advisor_name: '',
  advisor_email: '',
  project_title: '',
  profile_picture_url: ''
};

const HEADER_BY_PAGE = {
  dashboard: {
    kicker: 'Student Dashboard',
    subtitle: 'Track your defense timeline, reminders, and key updates.'
  },
  defense: {
    kicker: 'Defense Information',
    subtitle: 'View all defense details planned by administration.'
  },
  grades: {
    kicker: 'Student Grades',
    subtitle: 'Review your published final grade and related alerts.'
  },
  report: {
    kicker: 'Student Documents',
    subtitle: 'Upload and manage report and thesis files.'
  },
  messaging: {
    kicker: 'Student Messaging',
    subtitle: 'Chat with your supervisor and follow conversation history.'
  },
  notifications: {
    kicker: 'Student Notifications',
    subtitle: 'Review alerts and updates related to your project.'
  },
  simulator: {
    kicker: 'Student Simulator',
    subtitle: 'Simulate your defense score and test evaluation criteria.'
  },
  profile: {
    kicker: 'Student Profile',
    subtitle: 'View and edit your personal and academic information.'
  }
};
const HEADER_BY_PAGE_FR = {
  dashboard: {
    kicker: 'Dashboard etudiant',
    subtitle: 'Suivez votre calendrier, rappels et mises a jour importantes.'
  },
  defense: {
    kicker: 'Informations de soutenance',
    subtitle: "Consultez tous les details planifies par l'administration."
  },
  grades: {
    kicker: 'Notes etudiant',
    subtitle: 'Consultez votre note finale et les alertes associees.'
  },
  report: {
    kicker: 'Documents etudiant',
    subtitle: 'Deposez et gerez vos fichiers de rapport et memoire.'
  },
  messaging: {
    kicker: 'Messagerie etudiant',
    subtitle: "Echangez avec votre encadrant et suivez l'historique."
  },
  notifications: {
    kicker: 'Notifications etudiant',
    subtitle: 'Consultez les alertes et mises a jour de votre projet.'
  },
  simulator: {
    kicker: 'Simulateur etudiant',
    subtitle: "Simulez votre note de soutenance selon les criteres d'evaluation."
  },
  profile: {
    kicker: 'Profil etudiant',
    subtitle: 'Consultez et modifiez vos informations personnelles et academiques.'
  }
};

function toProfileDraft(data) {
  return {
    first_name: String((data && data.first_name) || '').trim(),
    last_name: String((data && data.last_name) || '').trim(),
    student_id: String((data && data.student_id) || '').trim(),
    level: String((data && data.level) || '').trim(),
    speciality: String((data && data.speciality) || '').trim(),
    phone: String((data && data.phone) || '').trim(),
    registration_number: String((data && data.registration_number) || '').trim(),
    department: String((data && data.department) || '').trim(),
    academic_year: String((data && data.academic_year) || '').trim(),
    advisor_name: String((data && data.advisor_name) || '').trim(),
    advisor_email: String((data && data.advisor_email) || '').trim(),
    project_title: String((data && data.project_title) || '').trim(),
    profile_picture_url: String((data && data.profile_picture_url) || '').trim()
  };
}

function isProfileComplete(profile) {
  return (
    !!String(profile && profile.first_name).trim() &&
    !!String(profile && profile.last_name).trim() &&
    !!String(profile && profile.student_id).trim() &&
    !!String(profile && profile.level).trim() &&
    !!String(profile && profile.speciality).trim() &&
    !!String(profile && profile.project_title).trim()
  );
}

function isMissingEndpointErrorMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('http 404') || text.includes('404');
}

export default function StudentSpace({ session, goWelcome }) {
  const { isFrench } = useLanguage();
  const [page, setPage] = useState('dashboard');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [notificationCount, setNotificationCount] = useState(0);
  const email = session && session.email;
  const actions = [
    {
      id: 'notifications',
      label: isFrench ? 'Notifications' : 'Notifications',
      icon: '\u{1F514}',
      badge: notificationCount > 0 ? String(notificationCount) : '',
      onClick: () => setPage('notifications')
    },
    { id: 'report', label: isFrench ? 'Documents' : 'Documents', icon: '\u{1F9FE}', onClick: () => setPage('report') },
    { id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }
  ];
  const items = [
    { id: 'dashboard', label: isFrench ? 'Dashboard' : 'Dashboard', icon: '\u{1F4CA}' },
    { id: 'defense', label: isFrench ? 'Soutenance' : 'Defense info', icon: '\u{1F4C5}' },
    { id: 'grades', label: isFrench ? 'Notes' : 'Grades', icon: '\u{1F393}' },
    { id: 'report', label: isFrench ? 'Documents' : 'Documents', icon: '\u{1F9FE}' },
    { id: 'messaging', label: isFrench ? 'Messages' : 'Messages', icon: '\u{1F4AC}' },
    { id: 'notifications', label: isFrench ? 'Notifications' : 'Notifications', icon: '\u{1F514}' },
    { id: 'simulator', label: isFrench ? 'Simulateur' : 'Simulator', icon: '\u{1F916}' }
  ];
  const activeHeader = (isFrench ? HEADER_BY_PAGE_FR : HEADER_BY_PAGE)[page] || (isFrench ? HEADER_BY_PAGE_FR.dashboard : HEADER_BY_PAGE.dashboard);
  const headerAvatarUrl = String(profileForm.profile_picture_url || '').trim();

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!email) {
        setProfileLoading(false);
        setProfileReady(false);
        return;
      }

      setProfileLoading(true);
      setProfileError('');
      try {
        const r = await getStudentProfile({ email });
        if (cancelled) return;
        if (!r.ok) {
          const msg = (r.data && r.data.errors && r.data.errors[0]) || (isFrench ? 'Impossible de charger votre profil etudiant.' : 'Unable to load your student profile.');
          if (isMissingEndpointErrorMessage(msg)) {
            // Backward compatibility with older backend builds that don't expose profile endpoints yet.
            setProfileForm(EMPTY_PROFILE);
            setProfileReady(true);
            setProfileError('');
            return;
          }
          setProfileError(msg);
          setProfileForm(EMPTY_PROFILE);
          setProfileReady(false);
          return;
        }

        const draft = toProfileDraft(r.data || {});
        const profileCompletedFlag = Number((r.data && r.data.profile_completed) || 0) === 1;
        setProfileForm(draft);
        setProfileReady(profileCompletedFlag || isProfileComplete(draft));
      } catch {
        if (cancelled) return;
        setProfileError(isFrench ? 'Impossible de charger votre profil etudiant.' : 'Unable to load your student profile.');
        setProfileForm(EMPTY_PROFILE);
        setProfileReady(false);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function loadNotificationCount() {
      if (!email) {
        if (!cancelled) setNotificationCount(0);
        return;
      }
      const r = await listNotifications({ email, limit: 50 });
      if (cancelled || !r.ok) return;
      const rows = Array.isArray(r.data) ? r.data : [];
      const unread = rows.reduce((sum, row) => sum + (row && !row.read_at ? 1 : 0), 0);
      setNotificationCount(unread);
    }

    loadNotificationCount();
    intervalId = setInterval(loadNotificationCount, 5000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [email]);

  async function onSaveProfile(ev) {
    ev.preventDefault();
    const payload = {
      first_name: String(profileForm.first_name || '').trim(),
      last_name: String(profileForm.last_name || '').trim(),
      student_id: String(profileForm.student_id || '').trim(),
      level: String(profileForm.level || '').trim(),
      speciality: String(profileForm.speciality || '').trim(),
      phone: String(profileForm.phone || '').trim(),
      registration_number: String(profileForm.registration_number || '').trim(),
      department: String(profileForm.department || '').trim(),
      academic_year: String(profileForm.academic_year || '').trim(),
      advisor_name: String(profileForm.advisor_name || '').trim(),
      advisor_email: String(profileForm.advisor_email || '').trim().toLowerCase(),
      project_title: String(profileForm.project_title || '').trim(),
      profile_picture_url: String(profileForm.profile_picture_url || '').trim()
    };

    if (!isProfileComplete(payload)) {
      setProfileError(
        isFrench
          ? 'Veuillez remplir Prenom, Nom, ID Etudiant, Niveau, Specialite et Titre du projet.'
          : 'Please fill First name, Last name, Student ID, Level, Speciality, and Project title.'
      );
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    try {
      const r = await saveStudentProfile({ email, ...payload });
      if (!r.ok) {
        const msg = (r.data && r.data.errors && r.data.errors[0]) || (isFrench ? 'Impossible de sauvegarder votre profil.' : 'Unable to save your profile.');
        setProfileError(msg);
        return;
      }
      setProfileForm(payload);
      setProfileReady(true);
      setPage('dashboard');
    } catch {
      setProfileError(isFrench ? 'Impossible de sauvegarder votre profil.' : 'Unable to save your profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  if (!email) {
    return (
      <>
        <TopLeftBack onClick={goWelcome} label={isFrench ? 'Accueil' : 'Home'} />
        <h1 className="title">{isFrench ? 'Espace etudiant' : 'Student Space'}</h1>
        <p className="subtitle">{isFrench ? 'Session manquante. Veuillez vous reconnecter.' : 'Missing session. Please sign in again.'}</p>
        <p className="signin" style={{ marginTop: 8 }}>
          <a
            href="#"
            onClick={(ev) => {
              ev.preventDefault();
              goWelcome();
            }}
          >
            {isFrench ? 'Retour' : 'Back'}
          </a>
        </p>
      </>
    );
  }

  if (profileLoading) {
    return (
      <>
        <SpaceHeader
          kicker={isFrench ? 'Espace etudiant' : 'Student Space'}
          subtitle={isFrench ? 'Chargement de votre profil etudiant...' : 'Loading your student profile...'}
          session={session}
          avatarUrl={headerAvatarUrl}
          actions={[{ id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }]}
        />
        <section className="student-profile-shell">
          <article className="student-profile-card">
            <p className="student-profile-subtitle">{isFrench ? 'Veuillez patienter...' : 'Please wait...'}</p>
          </article>
        </section>
      </>
    );
  }

  if (!profileReady) {
    return (
      <>
        <SpaceHeader
          kicker={isFrench ? 'Espace etudiant' : 'Student Space'}
          subtitle={isFrench ? "Completez votre profil etudiant avant d'acceder a l'espace." : 'Complete your student profile before accessing your workspace.'}
          session={session}
          avatarUrl={headerAvatarUrl}
          actions={[{ id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }]}
        />

        <section className="student-profile-shell">
          <article className="student-profile-card">
            <header className="student-profile-head">
              <h2 className="student-profile-title">{isFrench ? 'Completer votre profil' : 'Complete Your Profile'}</h2>
              <p className="student-profile-subtitle">
                Fill these details once after login: First name, Last name, Student ID, Level, Speciality, and Project title.
              </p>
            </header>

            <form className="student-profile-form" onSubmit={onSaveProfile} noValidate>
              <div className="student-profile-grid">
                <label className="student-profile-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, first_name: ev.target.value }))}
                    placeholder="Ex: Imene"
                    autoComplete="given-name"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, last_name: ev.target.value }))}
                    placeholder="Ex: Bennaceur"
                    autoComplete="family-name"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>Student ID</span>
                  <input
                    type="text"
                    value={profileForm.student_id}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, student_id: ev.target.value }))}
                    placeholder="Ex: 2024-0001"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>Level</span>
                  <input
                    type="text"
                    value={profileForm.level}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, level: ev.target.value }))}
                    placeholder="Ex: M2"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>Speciality</span>
                  <input
                    type="text"
                    value={profileForm.speciality}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, speciality: ev.target.value }))}
                    placeholder="Ex: Computer Science"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="student-profile-field student-profile-field-wide">
                  <span>Project title</span>
                  <input
                    type="text"
                    value={profileForm.project_title}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, project_title: ev.target.value }))}
                    placeholder="Enter your graduation project title"
                    autoComplete="off"
                    required
                  />
                </label>
              </div>

              {profileError ? <div className="errors">{profileError}</div> : null}

              <div className="student-profile-actions">
                <button className="primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? (isFrench ? 'Sauvegarde...' : 'Saving...') : isFrench ? 'Enregistrer et continuer' : 'Save and continue'}
                </button>
              </div>
            </form>
          </article>
        </section>
      </>
    );
  }

  return (
    <>
      <SpaceHeader
        kicker={activeHeader.kicker}
        subtitle={activeHeader.subtitle}
        session={session}
        avatarUrl={headerAvatarUrl}
        actions={actions}
        onProfileClick={() => setPage('profile')}
      />

      <div className="layout">
        <nav className="admin-nav">
          <div className="nav-brand">
            <div>
              <div className="nav-brand-title">Planify</div>
              <div className="nav-brand-sub">Student</div>
            </div>
          </div>
          <div className="nav-sep" />

          <div className="admin-nav-list">
            {items.map((it) => (
              <button
                key={it.id}
                className={'admin-nav-btn' + (page === it.id ? ' active' : '')}
                type="button"
                onClick={() => setPage(it.id)}
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {it.icon}
                </span>
                {it.label}
              </button>
            ))}
          </div>

          <div className="admin-nav-footer">
            <button className="admin-nav-btn nav-footer-btn" type="button" onClick={() => setPage('profile')}>
              <span className="admin-nav-icon" aria-hidden="true">
                {'\u{1F464}'}
              </span>
              {isFrench ? 'Profil' : 'Profile'}
            </button>
          </div>
        </nav>

        <div className="panel">
          {page === 'dashboard' ? (
            <Dashboard
              email={email}
              onOpenReport={() => setPage('report')}
              onOpenMessaging={() => setPage('messaging')}
              onOpenNotifications={() => setPage('notifications')}
            />
          ) : page === 'defense' ? (
            <DefenseInfo email={email} />
          ) : page === 'grades' ? (
            <StudentGrades email={email} onOpenNotifications={() => setPage('notifications')} />
          ) : page === 'profile' ? (
            <StudentProfile
              session={session}
              profile={profileForm}
              email={email}
              onProfileSaved={(nextProfile) => setProfileForm(toProfileDraft(nextProfile))}
            />
          ) : page === 'report' ? (
            <Report email={email} />
          ) : page === 'messaging' ? (
            <Messaging email={email} />
          ) : page === 'notifications' ? (
            <StudentNotifications email={email} />
          ) : (
            <Simulator email={email} />
          )}
        </div>
      </div>
    </>
  );
}
