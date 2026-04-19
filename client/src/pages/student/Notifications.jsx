import React from 'react';
import NotificationsPanel from '../../components/feedback/NotificationsPanel.jsx';

export default function StudentNotifications({ email }) {
  return <NotificationsPanel email={email} />;
}
