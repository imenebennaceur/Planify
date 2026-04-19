import React from 'react';

function initialsFromSession(session) {
  const name = String(session && session.name ? session.name : '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] ? parts[0][0] : '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || 'U';
  }
  const email = String(session && session.email ? session.email : '').trim();
  if (email) return email[0].toUpperCase();
  return 'U';
}

export default function SpaceHeader({ kicker, subtitle, session, actions = [], variant = 'default', onProfileClick, avatarUrl }) {
  const title = String(kicker || '').trim() || 'Workspace';
  const name = String(session && session.name ? session.name : '').trim();
  const email = String(session && session.email ? session.email : '').trim();
  const initials = initialsFromSession(session);
  const headerAvatarUrl = String(avatarUrl || '').trim();
  const quickActions = Array.isArray(actions) ? actions.slice(0, 5) : [];

  const notificationsAction = quickActions.find((a) => a.id === 'notifications');
  const folderAction = quickActions.find((a) => a.id === 'report') || quickActions.find((a) => a.id === 'messaging');
  const calendarAction = quickActions.find((a) => a.id === 'calendar');
  const dashboardAction = quickActions.find((a) => a.id === 'dashboard') || calendarAction;
  const featuresAction = quickActions.find((a) => a.id === 'features') || folderAction;
  const plannerAction = quickActions.find((a) => a.id === 'planner') || dashboardAction;
  const homeAction = quickActions.find((a) => a.id === 'home') || dashboardAction || notificationsAction;
  const writeAction = quickActions.find((a) => a.id === 'write') || folderAction;

  if (variant === 'student-bento') {
    return (
      <header className="space-header student-space-header student-topbar">
        <div className="student-top-links">
          <button className="student-top-link active" type="button" onClick={dashboardAction ? dashboardAction.onClick : undefined}>
            Tableau de bord
          </button>
          <button className="student-top-link" type="button" onClick={featuresAction ? featuresAction.onClick : undefined}>
            Fonctionnalites
          </button>
          <button className="student-top-link" type="button" onClick={plannerAction ? plannerAction.onClick : undefined}>
            Planner
          </button>
        </div>

        <div className="student-top-actions">
          <button className="student-top-home" type="button" onClick={homeAction ? homeAction.onClick : undefined} aria-label="Retour Accueil">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Retour Accueil</span>
          </button>
          <button className="student-top-write" type="button" onClick={writeAction ? writeAction.onClick : undefined} aria-label="Ecrire">
            Ecrire
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="space-header">
      <div className="space-head-main">
        <img className="space-brand-logo" src="/logo.png" alt="University logo" />
        <div className="space-heading">
          <h1 className="space-title">{title}</h1>
          {subtitle ? <p className="space-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      <div className="space-actions">
        {quickActions.map((a, idx) => (
          <button
            key={a.id || idx}
            className="icon-chip"
            type="button"
            onClick={a.onClick}
            title={a.label}
            aria-label={a.label}
          >
            <span className="icon-chip-icon" aria-hidden="true">
              {a.icon}
            </span>
            <span className="icon-chip-label">{a.label}</span>
            {a.badge ? <span className="icon-badge">{a.badge}</span> : null}
          </button>
        ))}

        {typeof onProfileClick === 'function' ? (
          <button
            className="user-chip user-chip-btn"
            type="button"
            onClick={onProfileClick}
            title={email || name || title || 'User'}
            aria-label={`Open profile for ${name || email || title || 'User'}`}
          >
            <div className="avatar" aria-hidden="true">
              {headerAvatarUrl ? <img className="avatar-image" src={headerAvatarUrl} alt="" loading="lazy" /> : initials}
            </div>
          </button>
        ) : (
          <div className="user-chip" title={email || name || title || 'User'} aria-label={name || email || title || 'User'}>
            <div className="avatar" aria-hidden="true">
              {headerAvatarUrl ? <img className="avatar-image" src={headerAvatarUrl} alt="" loading="lazy" /> : initials}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

