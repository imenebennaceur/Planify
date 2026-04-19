const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options) {
  try {
    const res = await fetch(`${API_URL}${path}`, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { errors: ['Réponse serveur invalide.'] };
    }
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { errors: [`Impossible de joindre l'API (${API_URL}). Démarrez le serveur backend.`] } };
  }
}

export async function listNotifications({ email, limit = 30 }) {
  return request(`/api/notifications?email=${encodeURIComponent(email)}&limit=${encodeURIComponent(limit)}`);
}

export async function markAllNotificationsRead({ email }) {
  return request(`/api/notifications/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
}

