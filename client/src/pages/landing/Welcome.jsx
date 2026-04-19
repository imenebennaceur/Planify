import React, { useMemo, useState } from 'react';
import plannerPreview from '../../../planner.png';
import plannerPreviewDark from '../../../mocknuit.png';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function Icon({ children, className = '' }) {
  return (
    <span className={'landing-icon' + (className ? ' ' + className : '')} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export default function Welcome({ goLogin, goSignup }) {
  const { isFrench } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasLogo, setHasLogo] = useState(true);
  const year = useMemo(() => new Date().getFullYear(), []);

  const text = isFrench
    ? {
        navAria: 'Navigation principale',
        navHome: 'Accueil',
        navFeatures: 'Fonctionnalites',
        navWorkflow: 'Processus',
        navContact: 'Contact',
        login: 'Connexion',
        createAccount: 'Creer un compte',
        closeMenu: 'Fermer le menu',
        openMenu: 'Ouvrir le menu',
        title: "Gestion intelligente de la planification des soutenances de fin d'etudes.",
        subtitle: "Organisez les plannings, automatisez les rappels, et suivez chaque etape de la preparation jusqu'a l'evaluation finale.",
        bullet1: 'Gestion centralisee des dates, salles et jurys.',
        bullet2: 'Depot rapide des memoires PDF et suivi de validation.',
        bullet3: 'Rappels automatiques et notifications en temps reel.',
        startNow: 'Commencer',
        viewDemo: 'Voir la demo',
        previewAlt: "Apercu de l'interface Planify",
        previewAltDark: "Apercu de l'interface Planify en mode nuit",
        featuresTitle: 'Fonctionnalites cles pour piloter chaque soutenance',
        card1Title: 'Planification des soutenances',
        card1Text: 'Consultez les dates, salles et composition des jurys en quelques secondes.',
        card2Title: 'Depot des memoires',
        card2Text: 'Deposez votre PDF, suivez la validation et respectez les echeances.',
        card3Title: 'Alertes intelligentes',
        card3Text: 'Recevez des notifications claires a chaque etape.',
        card4Title: 'Messagerie integree',
        card4Text: 'Echangez directement avec les encadrants avec historique complet.',
        workflowTitle: 'Comment ca marche',
        step1: 'L etudiant cree un compte.',
        step2: "L administration planifie la soutenance.",
        step3: 'Le memoire est depose sur la plateforme.',
        step4: 'Le systeme notifie et guide chaque acteur.',
        contactTitle: 'Contact',
        contactText: 'Une question ? Notre equipe repond rapidement.',
        footer: 'Tous droits reserves a IMENE&AYA.'
      }
    : {
        navAria: 'Main navigation',
        navHome: 'Home',
        navFeatures: 'Features',
        navWorkflow: 'Workflow',
        navContact: 'Contact',
        login: 'Login',
        createAccount: 'Create account',
        closeMenu: 'Close menu',
        openMenu: 'Open menu',
        title: 'Smart management for final-year defense planning.',
        subtitle: 'Organize schedules, automate reminders, and track each step from preparation to final evaluation in one place.',
        bullet1: 'Centralized date, room, and jury management.',
        bullet2: 'Fast PDF thesis upload and review flow.',
        bullet3: 'Automatic reminders and real-time notifications.',
        startNow: 'Start now',
        viewDemo: 'View demo',
        previewAlt: 'Planify UI preview',
        previewAltDark: 'Planify UI preview dark',
        featuresTitle: 'Key features to control every defense',
        card1Title: 'Defense scheduling',
        card1Text: 'View dates, rooms, and jury composition in seconds.',
        card2Title: 'Thesis submission',
        card2Text: 'Upload your PDF, track validation status, and stay ahead of deadlines.',
        card3Title: 'Smart alerts',
        card3Text: 'Get clear notifications for each stage: call, reminders, and jury updates.',
        card4Title: 'Integrated messaging',
        card4Text: 'Message supervisors directly and keep a full conversation history.',
        workflowTitle: 'How it works',
        step1: 'The student creates an account.',
        step2: 'Administration schedules the defense.',
        step3: 'The thesis is uploaded to the platform.',
        step4: 'The system notifies and guides every actor.',
        contactTitle: 'Contact',
        contactText: 'Have a question? Our team replies quickly.',
        footer: 'All rights reserved to IMENE&AYA.'
      };

  function scrollToId(id) {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  }

  function NavLink({ id, children }) {
    return (
      <a
        className="landing-nav-link"
        href={'#' + id}
        onClick={(event) => {
          event.preventDefault();
          scrollToId(id);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <div className="landing">
      <header className="landing-header" role="banner">
        <button className="landing-brand" type="button" onClick={() => scrollToId('home')}>
          {hasLogo ? (
            <img className="landing-brand-logo" src="/logo.png" alt="Planify logo" onError={() => setHasLogo(false)} />
          ) : (
            <div className="landing-brand-fallback" aria-hidden="true">
              P
            </div>
          )}
          <span className="landing-brand-name">Planify</span>
        </button>

        <nav className={'landing-nav' + (menuOpen ? ' open' : '')} aria-label={text.navAria}>
          <NavLink id="home">{text.navHome}</NavLink>
          <NavLink id="features">{text.navFeatures}</NavLink>
          <NavLink id="workflow">{text.navWorkflow}</NavLink>
          <NavLink id="contact">{text.navContact}</NavLink>
        </nav>

        <div className="landing-actions">
          <button className="landing-action-btn landing-action-secondary" type="button" onClick={goLogin}>
            {text.login}
          </button>
          <button className="landing-action-btn" type="button" onClick={goSignup}>
            {text.createAccount}
          </button>
          <button
            className="landing-burger"
            type="button"
            aria-label={menuOpen ? text.closeMenu : text.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <section id="home" className="landing-hero">
        <div className="landing-hero-left">
          <h1 className="landing-title">{text.title}</h1>
          <p className="landing-subtitle">{text.subtitle}</p>

          <ul className="landing-list">
            <li>
              <Icon>
                <path d="M8 2v2M16 2v2M3.5 8.5h17" />
                <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                <path d="M7.5 12h3M7.5 16h3M13.5 12h3M13.5 16h3" />
              </Icon>
              <span>{text.bullet1}</span>
            </li>
            <li>
              <Icon>
                <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                <path d="M14 3v4h4" />
                <path d="M8 13h8M8 17h8" />
              </Icon>
              <span>{text.bullet2}</span>
            </li>
            <li>
              <Icon>
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </Icon>
              <span>{text.bullet3}</span>
            </li>
          </ul>

          <div className="landing-cta">
            <button className="landing-btn landing-btn-primary" type="button" onClick={goLogin}>
              {text.startNow}
            </button>
            <button className="landing-btn landing-btn-glass" type="button" onClick={() => scrollToId('features')}>
              {text.viewDemo}
            </button>
          </div>
        </div>

        <div className="landing-hero-right">
          <div className="landing-preview landing-preview-image">
            <img className="landing-preview-img landing-preview-img-light" src={plannerPreview} alt={text.previewAlt} loading="eager" decoding="async" />
            <img className="landing-preview-img landing-preview-img-dark" src={plannerPreviewDark} alt={text.previewAltDark} loading="eager" decoding="async" />
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <h2 className="landing-h2">{text.featuresTitle}</h2>
        <div className="landing-feature-zone">
          <div className="landing-cards">
            <article className="landing-card">
              <div className="landing-card-title">
                <Icon className="landing-card-icon landing-tone-blue">
                  <path d="M8 2v2M16 2v2M3.5 8.5h17" />
                  <path d="M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                </Icon>
                <span>{text.card1Title}</span>
              </div>
              <p>{text.card1Text}</p>
            </article>

            <article className="landing-card">
              <div className="landing-card-title">
                <Icon className="landing-card-icon landing-tone-cyan">
                  <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                  <path d="M14 3v4h4" />
                </Icon>
                <span>{text.card2Title}</span>
              </div>
              <p>{text.card2Text}</p>
            </article>

            <article className="landing-card">
              <div className="landing-card-title">
                <Icon className="landing-card-icon landing-tone-gold">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </Icon>
                <span>{text.card3Title}</span>
              </div>
              <p>{text.card3Text}</p>
            </article>

            <article className="landing-card">
              <div className="landing-card-title">
                <Icon className="landing-card-icon landing-tone-indigo">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                  <path d="M7 9h10M7 12h7" />
                </Icon>
                <span>{text.card4Title}</span>
              </div>
              <p>{text.card4Text}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="workflow" className="landing-section">
        <h2 className="landing-h2">{text.workflowTitle}</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <Icon className="landing-step-icon">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </Icon>
            <div className="landing-step-text">{text.step1}</div>
          </div>
          <div className="landing-step">
            <Icon className="landing-step-icon">
              <path d="M4 19V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12" />
              <path d="M8 3h8" />
              <path d="M8 19h8" />
            </Icon>
            <div className="landing-step-text">{text.step2}</div>
          </div>
          <div className="landing-step">
            <Icon className="landing-step-icon">
              <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M14 3v4h4" />
            </Icon>
            <div className="landing-step-text">{text.step3}</div>
          </div>
          <div className="landing-step">
            <Icon className="landing-step-icon">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </Icon>
            <div className="landing-step-text">{text.step4}</div>
          </div>
        </div>
      </section>

      <section id="contact" className="landing-section">
        <div className="landing-contact">
          <div className="landing-contact-title">{text.contactTitle}</div>
          <div className="landing-contact-text">{text.contactText}</div>
          <div className="landing-contact-actions">
            <a className="landing-contact-link" href="mailto:planify@univ.dz">
              planify@univ.dz
            </a>
            <button className="landing-contact-btn" type="button" onClick={goSignup}>
              {text.createAccount}
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        Copyright {year} Planify - {text.footer}
      </footer>
    </div>
  );
}
