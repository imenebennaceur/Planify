import React, { useEffect, useState } from 'react';
import TopLeftBack from '../../components/ui/TopLeftBack.jsx';
import JuryStudents from '../jury/Students.jsx';
import NotificationsPanel from '../../components/feedback/NotificationsPanel.jsx';
import SpaceHeader from '../../components/ui/SpaceHeader.jsx';
import { listNotifications } from '../../lib/notificationsApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function JurySpace({ session, goWelcome, goProfessor }) {
  const { isFrench } = useLanguage();
  const teacherEmail = session && session.email;
  const [page, setPage] = useState('jury');
  const [notificationCount, setNotificationCount] = useState(0);

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

  if (!teacherEmail) {
    return (
      <>
        <TopLeftBack onClick={goWelcome} label={isFrench ? 'Accueil' : 'Home'} />
        <h1 className="title">{isFrench ? 'Espace jury' : 'Jury Space'}</h1>
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

  return (
    <>
      <SpaceHeader
        kicker={isFrench ? 'Espace jury' : 'Jury Space'}
        subtitle={
          isFrench
            ? 'Interface simplifiee - uniquement les etudiants qui vous sont affectes comme jury.'
            : 'Simplified interface - restricted to students you are assigned to as a jury member.'
        }
        session={session}
        actions={[
          { id: 'prof', label: isFrench ? 'Professeur' : 'Professor', icon: '\u{1F464}', onClick: goProfessor },
          { id: 'home', label: isFrench ? 'Accueil' : 'Home', icon: '\u{1F3E0}', onClick: goWelcome },
          {
            id: 'notifications',
            label: isFrench ? 'Notifications' : 'Notifications',
            icon: '\u{1F514}',
            badge: notificationCount > 0 ? String(notificationCount) : '',
            onClick: () => setPage('notifications')
          }
        ]}
        onProfileClick={goProfessor}
      />

      <div className="layout">
        <nav className="admin-nav">
          <div className="nav-brand">
            <div>
              <div className="nav-brand-title">Planify</div>
              <div className="nav-brand-sub">Jury</div>
            </div>
          </div>
          <div className="nav-sep" />

          <div className="admin-nav-list">
            <button className={'admin-nav-btn' + (page === 'jury' ? ' active' : '')} type="button" onClick={() => setPage('jury')}>
              <span className="admin-nav-icon" aria-hidden="true">
                {'\u2696\uFE0F'}
              </span>
              {isFrench ? 'Liste jury' : 'Jury list'}
            </button>
            <button
              className={'admin-nav-btn' + (page === 'notifications' ? ' active' : '')}
              type="button"
              onClick={() => setPage('notifications')}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {'\u{1F514}'}
              </span>
              Notifications
            </button>
          </div>

          <div className="admin-nav-footer">
            <button className="admin-nav-btn nav-footer-btn" type="button" onClick={goProfessor}>
              <span className="admin-nav-icon" aria-hidden="true">
                {'\u{1F464}'}
              </span>
              {isFrench ? 'Profil' : 'Profile'}
            </button>
            <button className="admin-nav-btn nav-footer-btn" type="button" onClick={goWelcome}>
              <span className="admin-nav-icon" aria-hidden="true">
                {'\u238B'}
              </span>
              {isFrench ? 'Deconnexion' : 'Log out'}
            </button>
          </div>
        </nav>

        <div className="panel">
          {page === 'jury' ? <JuryStudents teacherEmail={teacherEmail} /> : <NotificationsPanel email={teacherEmail} />}
        </div>
      </div>
    </>
  );
}
