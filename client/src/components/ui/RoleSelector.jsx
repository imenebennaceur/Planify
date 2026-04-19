import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function RoleSelector({ value, onChange }) {
  const { isFrench } = useLanguage();
  const roles = [
    { id: 'student', label: isFrench ? 'Etudiant' : 'Student', icon: '\u{1F393}' },
    { id: 'professor', label: isFrench ? 'Professeur' : 'Professor', icon: '\u{1F468}\u200D\u{1F3EB}' },
    { id: 'administrator', label: isFrench ? 'Administrateur' : 'Administrator', icon: '\u2699\uFE0F' }
  ];

  return (
    <div className="role-group">
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          className={'role' + (value === role.id ? ' active' : '')}
          onClick={() => onChange(role.id)}
        >
          <span className="role-icon">{role.icon}</span>
          <span>{role.label}</span>
        </button>
      ))}
    </div>
  );
}
