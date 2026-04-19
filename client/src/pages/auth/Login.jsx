import React, { useState } from 'react';
import RoleSelector from '../../components/ui/RoleSelector.jsx';
import TopLeftBack from '../../components/ui/TopLeftBack.jsx';
import { login } from '../../lib/api.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

export default function Login({ goSignup, goWelcome, onLoggedIn }) {
  const { isFrench } = useLanguage();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);

  const copy = isFrench
    ? {
        back: 'Retour',
        title: 'Connexion',
        role: 'Role',
        emailPlaceholder: 'Entrez votre email',
        password: 'Mot de passe',
        passwordPlaceholder: 'Entrez votre mot de passe',
        hidePassword: 'Masquer le mot de passe',
        showPassword: 'Afficher le mot de passe',
        hide: 'Masquer',
        show: 'Afficher',
        remember: 'Se souvenir de moi',
        forgot: 'Mot de passe oublie ?',
        submit: 'Se connecter',
        noAccount: "Vous n'avez pas de compte ?",
        createAccount: 'Creer un compte',
        footer: 'Tous droits reserves',
        invalidEmail: 'Adresse email invalide',
        weakPassword: 'Le mot de passe doit contenir au moins 8 caracteres',
        wrongCredentials: 'Identifiants incorrects',
        offline: 'Connexion au serveur impossible. La connexion hors ligne est desactivee.'
      }
    : {
        back: 'Back',
        title: 'Login',
        role: 'Role',
        emailPlaceholder: 'Enter your email',
        password: 'Password',
        passwordPlaceholder: 'Enter your password',
        hidePassword: 'Hide password',
        showPassword: 'Show password',
        hide: 'Hide',
        show: 'Show',
        remember: 'Remember me',
        forgot: 'Forgot password?',
        submit: 'Sign in',
        noAccount: "Don't have an account?",
        createAccount: 'Create account',
        footer: 'All rights reserved to IMENE&AYA',
        invalidEmail: 'Invalid email address',
        weakPassword: 'Password must be at least 8 characters',
        wrongCredentials: 'Incorrect credentials',
        offline: 'Unable to reach backend API. Offline login is disabled for security.'
      };

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = [];
    if (!emailValid(email)) nextErrors.push(copy.invalidEmail);
    if (!password || password.length < 8) nextErrors.push(copy.weakPassword);
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setBusy(true);
    try {
      const response = await login({ email: email.trim(), password, role });
      if (!response.ok) {
        setErrors(response.data.errors || [copy.wrongCredentials]);
        return;
      }

      setErrors([]);
      const normalizedEmail = email.trim().toLowerCase();
      if (typeof onLoggedIn === 'function') {
        onLoggedIn({ id: response.data.id, role: response.data.role, name: response.data.name, email: normalizedEmail });
        return;
      }
      alert((isFrench ? 'Connecte en tant que ' : 'Signed in as ') + response.data.role);
    } catch {
      setErrors([copy.offline]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopLeftBack onClick={goWelcome} label={copy.back} />
      <div className="auth-screen login-screen">
        <section className="auth-shell" aria-label={copy.title}>
          <header className="auth-shell-header">
            <div className="auth-brand">
              <img className="auth-brand-logo" src="/logo.png" alt="University logo" />
            </div>
            <h1 className="auth-shell-title">{copy.title}</h1>
            <p className="auth-shell-subtitle">University of Algiers 1</p>
          </header>

          <div className="auth-form-card">
            <div className="auth-field">
              <div className="auth-label">{copy.role}</div>
              <RoleSelector value={role} onChange={setRole} />
            </div>

            <form onSubmit={onSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-email">
                  Email
                </label>
                <div className="field">
                  <span className="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 13L2 6.5v11A2.5 2.5 0 0 0 4.5 20h15A2.5 2.5 0 0 0 22 17.5v-11L12 13zm0-2.2L21.4 5H2.6L12 10.8z" />
                    </svg>
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    placeholder={copy.emailPlaceholder}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">
                  {copy.password}
                </label>
                <div className="field field-reveal">
                  <span className="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3H9z" />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    type={show ? 'text' : 'password'}
                    placeholder={copy.passwordPlaceholder}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="reveal reveal-text"
                    onClick={() => setShow((state) => !state)}
                    aria-label={show ? copy.hidePassword : copy.showPassword}
                  >
                    {show ? copy.hide : copy.show}
                  </button>
                </div>
              </div>

              <div className="auth-row">
                <label className="auth-checkbox">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span>{copy.remember}</span>
                </label>
                <a
                  className="auth-link"
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                >
                  {copy.forgot}
                </a>
              </div>

              <button className="primary auth-primary" type="submit" disabled={busy}>
                {copy.submit}
              </button>

              <p className="auth-switch">
                {copy.noAccount}{' '}
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    goSignup();
                  }}
                >
                  {copy.createAccount}
                </a>
              </p>

              <div className="errors" aria-live="polite">
                {errors.join('\n')}
              </div>
            </form>
          </div>

          <footer className="auth-foot">
            {'\u00A9'} {new Date().getFullYear()} - {copy.footer}
          </footer>
        </section>
      </div>
    </>
  );
}
