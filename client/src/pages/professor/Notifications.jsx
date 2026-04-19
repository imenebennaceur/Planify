import React from 'react';
import NotificationsPanel from '../../components/feedback/NotificationsPanel.jsx';

export default function ProfessorNotifications({ teacherEmail }) {
  return <NotificationsPanel email={teacherEmail} />;
}
