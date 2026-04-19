import React, { useEffect, useMemo, useState } from 'react';
import AdminDashboard from '../admin/Dashboard.jsx';
import AdminStudents from '../admin/Students.jsx';
import AdminTeachers from '../admin/Teachers.jsx';
import AdminRooms from '../admin/Rooms.jsx';
import AdminSchedule from '../admin/Schedule.jsx';
import AdminReports from '../admin/Reports.jsx';
import AdminFinalGrades from '../admin/FinalGrades.jsx';
import AdminNotifications from '../admin/Notifications.jsx';
import AdminExports from '../admin/Exports.jsx';
import SpaceHeader from '../../components/ui/SpaceHeader.jsx';
import { listNotificationBatches } from '../../lib/adminApi.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const ADMIN_NOTIFICATIONS_SEEN_KEY = 'pfee-admin-notifications-seen';

function adminNotificationStorageKey(email) {
  const owner = String(email || '').trim().toLowerCase();
  return `${ADMIN_NOTIFICATIONS_SEEN_KEY}:${owner || 'global'}`;
}

function normalizeTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1000000000000 ? n * 1000 : n;
}

function filterAdminNotificationRows(rows, adminEmail) {
  const owner = String(adminEmail || '').trim().toLowerCase();
  const list = Array.isArray(rows) ? rows : [];
  if (!owner) return list;
  return list.filter((row) => String((row && row.created_by) || '').trim().toLowerCase() === owner);
}

function latestNotificationTimestamp(rows) {
  return rows.reduce((max, row) => {
    const createdAt = normalizeTimestamp(row && row.created_at);
    return createdAt > max ? createdAt : max;
  }, 0);
}

function readSeenNotificationTimestamp(adminEmail) {
  try {
    return normalizeTimestamp(localStorage.getItem(adminNotificationStorageKey(adminEmail)));
  } catch {
    return 0;
  }
}

function writeSeenNotificationTimestamp(adminEmail, timestamp) {
  try {
    localStorage.setItem(adminNotificationStorageKey(adminEmail), String(normalizeTimestamp(timestamp)));
  } catch {}
}

function headersByPage(isFrench) {
  if (isFrench) {
    return {
      dashboard: {
        kicker: 'Tableau de bord administrateur',
        subtitle: "Suivez l'etat de la plateforme et les indicateurs cles."
      },
      students: {
        kicker: 'Etudiants administrateur',
        subtitle: 'Gerez les comptes et dossiers académiques des etudiants.'
      },
      teachers: {
        kicker: 'Professeurs & jurys',
        subtitle: "Gerez les professeurs, jurys et affectations d'encadrement."
      },
      rooms: {
        kicker: 'Salles',
        subtitle: 'Configurez les salles et disponibilites des soutenances.'
      },
      schedule: {
        kicker: 'Planning',
        subtitle: 'Construisez et maintenez la planification des soutenances.'
      },
      reports: {
        kicker: 'Rapports',
        subtitle: 'Suivez les depots de rapports et leur statut.'
      },
      finalGrades: {
        kicker: 'Notes finales',
        subtitle: 'Saisissez, suivez et publiez les notes finales des etudiants.'
      },
      notifications: {
        kicker: 'Notifications',
        subtitle: "Envoyez et suivez l'historique des notifications."
      },
      exports: {
        kicker: 'Exports',
        subtitle: 'Exportez les donnees en CSV/PDF.'
      },
      profile: {
        kicker: 'Profil administrateur',
        subtitle: 'Consultez les informations de votre compte administrateur.'
      }
    };
  }

  return {
    dashboard: {
      kicker: 'Administrator Dashboard',
      subtitle: 'Monitor platform status and key management indicators.'
    },
    students: {
      kicker: 'Administrator Students',
      subtitle: 'Manage student accounts and academic records.'
    },
    teachers: {
      kicker: 'Administrator Professors & Juries',
      subtitle: 'Manage professors, juries, and supervision assignments.'
    },
    rooms: {
      kicker: 'Administrator Rooms',
      subtitle: 'Configure defense rooms and availability slots.'
    },
    schedule: {
      kicker: 'Administrator Schedule',
      subtitle: 'Build, validate, and maintain defense planning.'
    },
    reports: {
      kicker: 'Administrator Reports',
      subtitle: 'Review and track report submissions and status.'
    },
    finalGrades: {
      kicker: 'Administrator Final Grades',
      subtitle: 'Enter, review, and publish final student grades.'
    },
    notifications: {
      kicker: 'Administrator Notifications',
      subtitle: 'Send notifications and review delivery history.'
    },
    exports: {
      kicker: 'Administrator Exports',
      subtitle: 'Export platform data to CSV/PDF views.'
    },
    profile: {
      kicker: 'Administrator Profile',
      subtitle: 'View your administrator account information.'
    }
  };
}

function show(v, fallback) {
  const value = String(v || '').trim();
  return value || fallback;
}

function AdminProfile({ session, isFrench }) {
  const adminId = session && session.id != null ? String(session.id) : '';
  const name = String((session && session.name) || '').trim();
  const email = String((session && session.email) || '').trim();
  const role = String((session && session.role) || 'administrator').trim();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : isFrench ? 'Administrateur' : 'Administrator';

  return (
    <section className="student-account-shell">
      <article className="student-account-card">
        <header className="student-account-head">
          <h2 className="student-account-title">{isFrench ? 'Mon profil' : 'My Profile'}</h2>
          <p className="student-account-subtitle">{isFrench ? 'Informations de votre compte administrateur.' : 'Your administrator account information.'}</p>
        </header>

        <div className="student-account-grid">
          <div className="student-account-item">
            <span className="student-account-label">{isFrench ? 'ID administrateur' : 'Administrator ID'}</span>
            <strong className="student-account-value">{show(adminId, isFrench ? 'Non renseigne' : 'Not provided')}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">{isFrench ? 'Role' : 'Role'}</span>
            <strong className="student-account-value">{show(roleLabel, isFrench ? 'Non renseigne' : 'Not provided')}</strong>
          </div>
          <div className="student-account-item">
            <span className="student-account-label">{isFrench ? 'Nom du compte' : 'Account Name'}</span>
            <strong className="student-account-value">{show(name, isFrench ? 'Non renseigne' : 'Not provided')}</strong>
          </div>
          <div className="student-account-item student-account-item-wide">
            <span className="student-account-label">Email</span>
            <strong className="student-account-value">{show(email, isFrench ? 'Non renseigne' : 'Not provided')}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

export default function AdminSpace({ session, goWelcome }) {
  const { isFrench } = useLanguage();
  const [page, setPage] = useState('dashboard');
  const [notificationCount, setNotificationCount] = useState(0);
  const adminEmail = session && session.email;
  const headerByPage = useMemo(() => headersByPage(isFrench), [isFrench]);
  const activeHeader = headerByPage[page] || headerByPage.dashboard;

  function markNotificationHistorySeen(rows) {
    const ownedRows = filterAdminNotificationRows(rows, adminEmail);
    writeSeenNotificationTimestamp(adminEmail, latestNotificationTimestamp(ownedRows));
    setNotificationCount(0);
  }

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function loadNotificationCount() {
      const r = await listNotificationBatches(30);
      if (cancelled || !r.ok) return;
      const rows = Array.isArray(r.data) ? r.data : [];
      const ownedRows = filterAdminNotificationRows(rows, adminEmail);

      if (page === 'notifications') {
        markNotificationHistorySeen(ownedRows);
        return;
      }

      const seenAt = readSeenNotificationTimestamp(adminEmail);
      const count = ownedRows.filter((row) => normalizeTimestamp(row && row.created_at) > seenAt).length;
      setNotificationCount(count);
    }

    loadNotificationCount();
    intervalId = setInterval(loadNotificationCount, 5000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [adminEmail, page]);

  const actions = [
    {
      id: 'notifications',
      label: isFrench ? 'Notifications' : 'Notifications',
      icon: '\u{1F514}',
      badge: notificationCount > 0 ? String(notificationCount) : '',
      onClick: () => {
        setPage('notifications');
        setNotificationCount(0);
      }
    },
    { id: 'exports', label: isFrench ? 'Export PDF / Excel' : 'Export PDF / Excel', icon: '\u{1F4E4}', onClick: () => setPage('exports') },
    { id: 'logout', label: isFrench ? 'Deconnexion' : 'Log out', icon: '\u238B', onClick: goWelcome }
  ];

  const items = [
    { id: 'dashboard', label: isFrench ? 'Dashboard' : 'Dashboard', icon: '\u{1F4CA}' },
    { id: 'students', label: isFrench ? 'Etudiants' : 'Students', icon: '\u{1F393}' },
    { id: 'teachers', label: isFrench ? 'Professeurs & jurys' : 'Professors & Juries', icon: '\u{1F465}' },
    { id: 'rooms', label: isFrench ? 'Salles' : 'Rooms', icon: '\u{1F3EB}' },
    { id: 'schedule', label: isFrench ? 'Planning' : 'Schedule', icon: '\u{1F4C5}' },
    { id: 'reports', label: isFrench ? 'Rapports' : 'Reports', icon: '\u{1F9FE}' },
    { id: 'finalGrades', label: isFrench ? 'Notes finales' : 'Final grades', icon: '\u{1F4DD}' },
    { id: 'notifications', label: isFrench ? 'Notifications' : 'Notifications', icon: '\u{1F514}' },
    { id: 'exports', label: isFrench ? 'Export PDF / Excel' : 'Export PDF / Excel', icon: '\u{1F4E4}' }
  ];

  return (
    <>
      <SpaceHeader
        kicker={activeHeader.kicker}
        subtitle={activeHeader.subtitle}
        session={session}
        actions={actions}
        onProfileClick={() => setPage('profile')}
      />

      <div className="layout">
        <nav className="admin-nav">
          <div className="nav-brand">
            <div>
              <div className="nav-brand-title">Planify</div>
              <div className="nav-brand-sub">Administration</div>
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

        </nav>

        <div className="panel">
          {page === 'dashboard' ? (
            <AdminDashboard />
          ) : page === 'students' ? (
            <AdminStudents />
          ) : page === 'teachers' ? (
            <AdminTeachers />
          ) : page === 'rooms' ? (
            <AdminRooms />
          ) : page === 'schedule' ? (
            <AdminSchedule adminEmail={adminEmail} />
          ) : page === 'reports' ? (
            <AdminReports adminEmail={adminEmail} />
          ) : page === 'finalGrades' ? (
            <AdminFinalGrades adminEmail={adminEmail} />
          ) : page === 'notifications' ? (
            <AdminNotifications adminEmail={adminEmail} onHistoryLoaded={markNotificationHistorySeen} />
          ) : page === 'profile' ? (
            <AdminProfile session={session} isFrench={isFrench} />
          ) : (
            <AdminExports adminEmail={adminEmail} />
          )}
        </div>
      </div>
    </>
  );
}
