import React, { useState, useEffect } from 'react';
import Signup from './pages/auth/Signup.jsx';
import Login from './pages/auth/Login.jsx';
import Welcome from './pages/landing/Welcome.jsx';
import StudentSpace from './pages/spaces/StudentSpace.jsx';
import AdminSpace from './pages/spaces/AdminSpace.jsx';
import ProfessorSpace from './pages/spaces/ProfessorSpace.jsx';
import JurySpace from './pages/spaces/JurySpace.jsx';
import { LANGUAGE_DEFAULT, LanguageProvider } from './i18n/LanguageContext.jsx';

const THEME_STORAGE_KEY = 'pfee-theme';
const SESSION_STORAGE_KEY = 'pfee-session';
const LANGUAGE_STORAGE_KEY = 'pfee-language';
const ROLE_PAGE_MAP = {
  student: 'student-space',
  administrator: 'admin-space',
  professor: 'professor-space'
};

function pageForRole(role) {
  return ROLE_PAGE_MAP[String(role || '').toLowerCase()] || 'welcome';
}

function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const role = String(parsed.role || '').toLowerCase();
    const email = String(parsed.email || '').trim().toLowerCase();
    const name = String(parsed.name || '').trim();
    const id = parsed.id ?? null;
    if (!ROLE_PAGE_MAP[role] || !email) return null;

    return { id, role, name, email };
  } catch {
    return null;
  }
}

export default function App() {
  const [bootState] = useState(() => {
    const restoredSession = loadSessionFromStorage();
    return {
      session: restoredSession,
      page: restoredSession ? pageForRole(restoredSession.role) : 'welcome'
    };
  });
  const [page, setPage] = useState(bootState.page);
  const [session, setSession] = useState(bootState.session);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : LANGUAGE_DEFAULT;
    } catch {
      return LANGUAGE_DEFAULT;
    }
  });
  const isSpace = page.endsWith('-space');
  const isAuth = page === 'login' || page === 'signup';
  const isFrench = language !== 'en';

  useEffect(() => {
    const noScroll = page.endsWith('-space') || page === 'login' || page === 'signup';
    document.body.classList.toggle('no-scroll', noScroll);
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('no-scroll');
  }, [page]);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
    return () => document.body.classList.remove('theme-dark');
  }, [theme]);

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language === 'en' ? 'en' : 'fr');
    } catch {}
  }, [language]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  function toggleLanguage() {
    setLanguage((current) => (current === 'en' ? 'fr' : 'en'));
  }

  function logout() {
    setSession(null);
    setPage('welcome');
  }

  function onLoggedIn(s) {
    const normalizedSession = s
      ? {
          id: s.id ?? null,
          role: String(s.role || '').toLowerCase(),
          name: String(s.name || '').trim(),
          email: String(s.email || '').trim().toLowerCase()
        }
      : null;
    setSession(normalizedSession);
    setPage(normalizedSession ? pageForRole(normalizedSession.role) : 'welcome');
  }

  return (
    <LanguageProvider language={language} setLanguage={setLanguage}>
      <div className="bg"></div>
      <div className="top-right-actions">
        <button
          className="back-btn theme-toggle-btn"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? (isFrench ? 'Passer au mode clair' : 'Switch to light mode') : isFrench ? 'Passer au mode nuit' : 'Switch to dark mode'}
          title={theme === 'dark' ? (isFrench ? 'Mode clair' : 'Light mode') : isFrench ? 'Mode nuit' : 'Dark mode'}
        >
          <span>{theme === 'dark' ? (isFrench ? 'Mode clair' : 'Light mode') : isFrench ? 'Mode nuit' : 'Dark mode'}</span>
        </button>
        <button
          className="back-btn language-toggle-btn"
          type="button"
          onClick={toggleLanguage}
          aria-label={isFrench ? 'Passer en anglais' : 'Switch to French'}
          title={isFrench ? 'Anglais' : 'French'}
        >
          <span>{isFrench ? 'FR' : 'EN'}</span>
        </button>
      </div>
      {isSpace && <div className="space-overlay"></div>}
      <main className={'container' + (isSpace ? ' container-fixed' : '')}>
        <section
          className={
            'app' +
            (isSpace ? ' app-space' : '') +
            (page === 'welcome' ? ' app-welcome' : '') +
            (isAuth ? ' app-auth' : '')
          }
        >
          {page === 'welcome' ? (
            <Welcome goLogin={() => setPage('login')} goSignup={() => setPage('signup')} />
          ) : page === 'login' ? (
            <Login goSignup={() => setPage('signup')} goWelcome={() => setPage('welcome')} onLoggedIn={onLoggedIn} />
          ) : page === 'signup' ? (
            <Signup goLogin={() => setPage('login')} goWelcome={() => setPage('welcome')} />
          ) : page === 'student-space' ? (
            <StudentSpace session={session} goWelcome={logout} />
          ) : page === 'admin-space' ? (
            <AdminSpace session={session} goWelcome={logout} />
          ) : page === 'professor-space' ? (
            <ProfessorSpace session={session} goWelcome={logout} goJury={() => setPage('jury-space')} />
          ) : (
            <JurySpace session={session} goWelcome={logout} goProfessor={() => setPage('professor-space')} />
          )}
        </section>
      </main>
    </LanguageProvider>
  );
}
