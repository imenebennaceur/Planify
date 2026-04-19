import React, { useEffect, useMemo, useState } from 'react';
import ProfDashboard from '../professor/Dashboard.jsx';
import ProfStudents from '../professor/Students.jsx';
import ProfSchedule from '../professor/Schedule.jsx';
import ProfMessaging from '../professor/Messaging.jsx';
import ProfNotifications from '../professor/Notifications.jsx';
import ProfAnnouncements from '../professor/Announcements.jsx';
import ProfProfile from '../professor/Profile.jsx';
import SpaceHeader from '../../components/ui/SpaceHeader.jsx';
import TopLeftBack from '../../components/ui/TopLeftBack.jsx';
import { getProfessorProfile, saveProfessorProfile } from '../../lib/professorApi.js';
import { listNotifications } from '../../lib/notificationsApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const EMPTY_PROFILE = {
  first_name: '',
  last_name: '',
  teacher_id: '',
  grade: '',
  speciality: '',
  phone: '',
  department: '',
  academic_rank: ''
};

const HEADER_BY_PAGE = {
  students: {
    kicker: 'Professor Students',
    subtitle: 'Manage assigned students and open direct messaging.'
  },
  schedule: {
    kicker: 'Professor Schedule',
    subtitle: 'Review upcoming defense sessions and planning.'
  },
  messaging: {
    kicker: 'Professor Messaging',
    subtitle: 'Communicate with students and keep message history.'
  },
  notifications: {
    kicker: 'Professor Notifications',
    subtitle: 'Check recent academic and administrative notifications.'
  },
  announcements: {
    kicker: 'Professor Announcements',
    subtitle: 'Publish announcements and updates for your students.'
  },
  dashboard: {
    kicker: 'Professor Dashboard',
    subtitle: 'See your global supervision and activity overview.'
  },
  profile: {
    kicker: 'Professor Profile',
    subtitle: 'View and update your professional information.'
  }
};
const HEADER_BY_PAGE_FR = {
  students: {
    kicker: 'Etudiants professeur',
    subtitle: 'Gerez vos etudiants encadres et ouvrez la messagerie.'
  },
  schedule: {
    kicker: 'Planning professeur',
    subtitle: 'Consultez les soutenances a venir et le planning.'
  },
  messaging: {
    kicker: 'Messagerie professeur',
    subtitle: 'Communiquez avec vos etudiants.'
  },
  notifications: {
    kicker: 'Notifications professeur',
    subtitle: 'Consultez les notifications academiques et administratives.'
  },
  announcements: {
    kicker: 'Annonces professeur',
    subtitle: 'Publiez des annonces pour vos etudiants.'
  },
  dashboard: {
    kicker: 'Dashboard professeur',
    subtitle: "Vue d'ensemble de votre encadrement et activite."
  },
  profile: {
    kicker: 'Profil professeur',
    subtitle: 'Consultez et mettez a jour vos informations professionnelles.'
  }
};

function toProfileDraft(data) {
  return {
    first_name: String((data && data.first_name) || '').trim(),
    last_name: String((data && data.last_name) || '').trim(),
    teacher_id: String((data && data.teacher_id) || '').trim(),
    grade: String((data && data.grade) || '').trim(),
    speciality: String((data && data.speciality) || '').trim(),
    phone: String((data && data.phone) || '').trim(),
    department: String((data && data.department) || '').trim(),
    academic_rank: String((data && data.academic_rank) || '').trim()
  };
}

function isProfileComplete(profile) {
  return (
    !!String(profile && profile.first_name).trim() &&
    !!String(profile && profile.last_name).trim() &&
    !!String(profile && profile.teacher_id).trim() &&
    !!String(profile && profile.grade).trim() &&
    !!String(profile && profile.speciality).trim()
  );
}

export default function ProfessorSpace({ session, goWelcome, goJury }) {
  const { isFrench } = useLanguage();
  const teacherEmail = session && session.email;
  const [page, setPage] = useState('dashboard');
  const [chatPeer, setChatPeer] = useState(null);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [notificationCount, setNotificationCount] = useState(0);

  const items = [
    { id: 'dashboard', label: isFrench ? 'Dashboard' : 'Dashboard', icon: '\u{1F4CA}' },
    { id: 'students', label: isFrench ? 'Mes etudiants' : 'My students', icon: '\u{1F393}' },
    { id: 'schedule', label: isFrench ? 'Planning' : 'Schedule', icon: '\u{1F4C5}' },
    { id: 'messaging', label: isFrench ? 'Messages' : 'Messages', icon: '\u{1F4AC}' },
    { id: 'notifications', label: isFrench ? 'Notifications' : 'Notifications', icon: '\u{1F514}' },
    { id: 'announcements', label: isFrench ? 'Annonces' : 'Announcements', icon: '\u{1F4E3}' }
  ];
  const headers = useMemo(() => (isFrench ? HEADER_BY_PAGE_FR : HEADER_BY_PAGE), [isFrench]);
  const activeHeader = headers[page] || headers.students;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!teacherEmail) {
        setProfileLoading(false);
        setProfileReady(false);
        return;
      }

      setProfileLoading(true);
      setProfileError('');
      try {
        const r = await getProfessorProfile({ email: teacherEmail });
        if (cancelled) return;
        if (!r.ok) {
          const msg = (r.data && r.data.errors && r.data.errors[0]) || (isFrench ? 'Impossible de charger votre profil professeur.' : 'Unable to load your professor profile.');
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
        setProfileError(isFrench ? 'Impossible de charger votre profil professeur.' : 'Unable to load your professor profile.');
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
  }, [teacherEmail]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function loadNotificationCount() {
      if (!teacherEmail) {
        if (!cancelled) setNotificationCount(0);
        return;
      }
      const r = await listNotifications({ email: teacherEmail, limit: 50 });
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
  }, [teacherEmail]);

  async function onSaveProfile(ev) {
    ev.preventDefault();
    const payload = {
      first_name: String(profileForm.first_name || '').trim(),
      last_name: String(profileForm.last_name || '').trim(),
      teacher_id: String(profileForm.teacher_id || '').trim(),
      grade: String(profileForm.grade || '').trim(),
      speciality: String(profileForm.speciality || '').trim(),
      phone: String(profileForm.phone || '').trim(),
      department: String(profileForm.department || '').trim(),
      academic_rank: String(profileForm.academic_rank || '').trim()
    };

    if (!isProfileComplete(payload)) {
      setProfileError(isFrench ? 'Veuillez remplir Prenom, Nom, ID Professeur, Grade et Specialite.' : 'Please fill First name, Last name, Professor ID, Grade, and Speciality.');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    try {
      const r = await saveProfessorProfile({ email: teacherEmail, ...payload });
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

  function openChat(peer) {
    setChatPeer(peer);
    setPage('messaging');
  }

  if (!teacherEmail) {
    return (
      <>
        <TopLeftBack onClick={goWelcome} label={isFrench ? 'Accueil' : 'Home'} />
        <h1 className="title">{isFrench ? 'Espace professeur' : 'Professor Space'}</h1>
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
          kicker={isFrench ? 'Espace professeur' : 'Professor Space'}
          subtitle={isFrench ? 'Chargement de votre profil professeur...' : 'Loading your professor profile...'}
          session={session}
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
          kicker={isFrench ? 'Espace professeur' : 'Professor Space'}
          subtitle={isFrench ? "Completez votre profil professeur avant d'acceder a l'espace." : 'Complete your professor profile before accessing your workspace.'}
          session={session}
          actions={[{ id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }]}
        />

        <section className="student-profile-shell">
          <article className="student-profile-card">
            <header className="student-profile-head">
              <h2 className="student-profile-title">{isFrench ? 'Completer votre profil' : 'Complete Your Profile'}</h2>
              <p className="student-profile-subtitle">
                {isFrench
                  ? 'Renseignez ces informations une seule fois: Prenom, Nom, ID Professeur, Grade et Specialite.'
                  : 'Fill these details once after login: First name, Last name, Professor ID, Grade, and Speciality.'}
              </p>
            </header>

            <form className="student-profile-form" onSubmit={onSaveProfile} noValidate>
              <div className="student-profile-grid">
                <label className="student-profile-field">
                  <span>{isFrench ? 'Prenom' : 'First name'}</span>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, first_name: ev.target.value }))}
                    placeholder="Ex: Ahmed"
                    autoComplete="given-name"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>{isFrench ? 'Nom' : 'Last name'}</span>
                  <input
                    type="text"
                    value={profileForm.last_name}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, last_name: ev.target.value }))}
                    placeholder="Ex: Benali"
                    autoComplete="family-name"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>{isFrench ? 'ID Professeur' : 'Professor ID'}</span>
                  <input
                    type="text"
                    value={profileForm.teacher_id}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, teacher_id: ev.target.value }))}
                    placeholder="Ex: PR-2024-001"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="student-profile-field">
                  <span>{isFrench ? 'Grade' : 'Grade'}</span>
                  <input
                    type="text"
                    value={profileForm.grade}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, grade: ev.target.value }))}
                    placeholder="Ex: Maitre de conferences"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="student-profile-field student-profile-field-wide">
                  <span>{isFrench ? 'Specialite' : 'Speciality'}</span>
                  <input
                    type="text"
                    value={profileForm.speciality}
                    onChange={(ev) => setProfileForm((cur) => ({ ...cur, speciality: ev.target.value }))}
                    placeholder="Ex: Artificial Intelligence"
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
        actions={[
          { id: 'jury', label: isFrench ? 'Acces jury' : 'Jury access', icon: '\u2696\uFE0F', onClick: goJury },
          {
            id: 'notifications',
            label: isFrench ? 'Notifications' : 'Notifications',
            icon: '\u{1F514}',
            badge: notificationCount > 0 ? String(notificationCount) : '',
            onClick: () => setPage('notifications')
          },
          { id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }
        ]}
        onProfileClick={() => setPage('profile')}
      />

      <div className="layout">
        <nav className="admin-nav">
          <div className="nav-brand">
            <div>
              <div className="nav-brand-title">Planify</div>
              <div className="nav-brand-sub">Professor</div>
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
            <ProfDashboard teacherEmail={teacherEmail} />
          ) : page === 'students' ? (
            <ProfStudents teacherEmail={teacherEmail} onMessage={openChat} />
          ) : page === 'schedule' ? (
            <ProfSchedule teacherEmail={teacherEmail} />
          ) : page === 'notifications' ? (
            <ProfNotifications teacherEmail={teacherEmail} />
          ) : page === 'announcements' ? (
            <ProfAnnouncements teacherEmail={teacherEmail} />
          ) : page === 'profile' ? (
            <ProfProfile
              session={session}
              profile={profileForm}
              email={teacherEmail}
              onProfileSaved={(nextProfile) => setProfileForm(toProfileDraft(nextProfile))}
            />
          ) : (
            <ProfMessaging teacherEmail={teacherEmail} initialPeer={chatPeer} />
          )}
        </div>
      </div>
    </>
  );
}
