import React, { useState } from 'react';
import RoleSelector from '../../components/ui/RoleSelector.jsx';
import TopLeftBack from '../../components/ui/TopLeftBack.jsx';
import { signup } from '../../lib/api.js';
import { getUserByEmail, addUser } from '../../lib/db-web.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

function passwordValid(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value || '');
}

export default function Signup({ goLogin, goWelcome }) {
  const { isFrench } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [administratorId, setAdministratorId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const copy = isFrench
    ? {
        back: 'Retour',
        title: 'Creer un compte',
        role: 'Role',
        administratorId: 'ID administrateur',
        administratorIdPlaceholder: "Entrez l'ID administrateur",
        fullName: 'Nom complet',
        fullNamePlaceholder: 'Entrez votre nom complet',
        emailPlaceholder: 'Entrez votre email',
        password: 'Mot de passe',
        passwordPlaceholder: 'Creez un mot de passe',
        confirmPassword: 'Confirmer le mot de passe',
        confirmPasswordPlaceholder: 'Confirmez votre mot de passe',
        submit: 'Creer un compte',
        hasAccount: 'Deja un compte ?',
        login: 'Se connecter',
        footer: 'Tous droits reserves',
        invalidName: 'Nom complet invalide',
        invalidEmail: 'Adresse email invalide',
        invalidAdministratorId: "L'ID administrateur est requis",
        weakPassword: 'Mot de passe trop faible',
        mismatch: 'Les mots de passe ne correspondent pas',
        unknownError: 'Erreur inconnue',
        emailUsedLocal: 'Email deja utilise (local)',
        localCreated: 'Compte cree localement (IndexedDB)',
        genericError: "Une erreur s'est produite"
      }
    : {
        back: 'Back',
        title: 'Create account',
        role: 'Role',
        administratorId: 'Administrator ID',
        administratorIdPlaceholder: 'Enter the administrator ID',
        fullName: 'Full name',
        fullNamePlaceholder: 'Enter your full name',
        emailPlaceholder: 'Enter your email',
        password: 'Password',
        passwordPlaceholder: 'Create a password',
        confirmPassword: 'Confirm password',
        confirmPasswordPlaceholder: 'Confirm your password',
        submit: 'Create account',
        hasAccount: 'Already have an account?',
        login: 'Sign in',
        footer: 'All rights reserved to AYA&IMENE',
        invalidName: 'Invalid full name',
        invalidEmail: 'Invalid email address',
        invalidAdministratorId: 'Administrator ID is required',
        weakPassword: 'Password is too weak',
        mismatch: 'Passwords do not match',
        unknownError: 'Unknown error',
        emailUsedLocal: 'Email already used (local)',
        localCreated: 'Account created locally (IndexedDB)',
        genericError: 'An error occurred'
      };

  function handleRoleChange(nextRole) {
    setRole(nextRole);
    if (nextRole !== 'administrator') setAdministratorId('');
  }

  function validate() {
    const nextErrors = [];
    if (!name || name.trim().length < 2) nextErrors.push(copy.invalidName);
    if (!emailValid(email)) nextErrors.push(copy.invalidEmail);
    if (role === 'administrator' && !/^\d+$/.test(administratorId.trim())) nextErrors.push(copy.invalidAdministratorId);
    if (!passwordValid(password)) nextErrors.push(copy.weakPassword);
    if (password !== confirm) nextErrors.push(copy.mismatch);
    return nextErrors;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setBusy(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), role, password };
      if (role === 'administrator') payload.administratorId = administratorId.trim();
      const response = await signup(payload);
      if (!response.ok) {
        setErrors(response.data.errors || [copy.unknownError]);
        return;
      }

      setErrors([]);
      setName('');
      setEmail('');
      setAdministratorId('');
      setPassword('');
      setConfirm('');
      alert((isFrench ? 'Compte cree (id ' : 'Account created (id ') + response.data.id + ')');
    } catch {
      try {
        const existing = await getUserByEmail(email);
        if (existing) {
          setErrors([copy.emailUsedLocal]);
        } else {
          const localUser = { name, email, role };
          if (role === 'administrator') localUser.id = administratorId.trim();
          await addUser(localUser);
          setErrors([]);
          setName('');
          setEmail('');
          setAdministratorId('');
          setPassword('');
          setConfirm('');
          alert(copy.localCreated);
        }
      } catch {
        setErrors([copy.genericError]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopLeftBack onClick={goWelcome} label={copy.back} />
      <div className="auth-screen signup-screen">
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
              <RoleSelector value={role} onChange={handleRoleChange} />
            </div>

            <form onSubmit={onSubmit} noValidate>
              {role === 'administrator' && (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="signup-administrator-id">
                    {copy.administratorId}
                  </label>
                  <div className="field">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5zm3-1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7zm2 3h6v2H9V7zm0 4h6v2H9v-2zm0 4h4v2H9v-2z" />
                      </svg>
                    </span>
                    <input
                      id="signup-administrator-id"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={copy.administratorIdPlaceholder}
                      value={administratorId}
                      onChange={(event) => setAdministratorId(event.target.value)}
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              <div className="auth-grid">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="signup-name">
                    {copy.fullName}
                  </label>
                  <div className="field">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-4.33 0-8 2.17-8 5v2h16v-2c0-2.83-3.67-5-8-5z" />
                      </svg>
                    </span>
                    <input
                      id="signup-name"
                      type="text"
                      placeholder={copy.fullNamePlaceholder}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="signup-email">
                    Email
                  </label>
                  <div className="field">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 13L2 6.5v11A2.5 2.5 0 0 0 4.5 20h15A2.5 2.5 0 0 0 22 17.5v-11L12 13zm0-2.2L21.4 5H2.6L12 10.8z" />
                      </svg>
                    </span>
                    <input
                      id="signup-email"
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
                  <label className="auth-label" htmlFor="signup-password">
                    {copy.password}
                  </label>
                  <div className="field">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3H9z" />
                      </svg>
                    </span>
                    <input
                      id="signup-password"
                      type="password"
                      placeholder={copy.passwordPlaceholder}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="signup-confirm">
                    {copy.confirmPassword}
                  </label>
                  <div className="field">
                    <span className="icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3H9z" />
                      </svg>
                    </span>
                    <input
                      id="signup-confirm"
                      type="password"
                      placeholder={copy.confirmPasswordPlaceholder}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <button className="primary auth-primary" type="submit" disabled={busy}>
                {copy.submit}
              </button>

              <p className="auth-switch">
                {copy.hasAccount}{' '}
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    goLogin();
                  }}
                >
                  {copy.login}
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
