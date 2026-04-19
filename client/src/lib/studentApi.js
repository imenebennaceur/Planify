import { signup, login } from './api.js'; // keep exports visible if needed
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getDefense({ email }) {
  const res = await fetch(`${API_URL}/api/defense?email=${encodeURIComponent(email)}`);
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}
export async function setDefense(payload) {
  const res = await fetch(`${API_URL}/api/defense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function getReport({ email }) {
  const res = await fetch(`${API_URL}/api/report?email=${encodeURIComponent(email)}`);
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}
export async function getDocumentDeadlines() {
  const res = await fetch(`${API_URL}/api/document-deadlines`);
  const data = await parseJsonOrError(res);
  if (res.status === 404) {
    // Backward compatibility: older backend builds may not expose this route.
    return { ok: true, data: { report_deadline: '', memoire_deadline: '' } };
  }
  return { ok: res.ok, data };
}
export async function setReport(payload) {
  const res = await fetch(`${API_URL}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function getStudentProfile({ email }) {
  const res = await fetch(`${API_URL}/api/student/profile?email=${encodeURIComponent(email)}`);
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function getStudentFinalGrade({ email }) {
  const res = await fetch(`${API_URL}/api/student/final-grade?email=${encodeURIComponent(email)}`);
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function getStudentConvocation({ email }) {
  const res = await fetch(`${API_URL}/api/student/convocation?email=${encodeURIComponent(email)}`);
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function generateStudentConvocation({ email }) {
  const res = await fetch(`${API_URL}/api/student/convocation/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function getStudentAiEvaluations({ email, limit = 8 }) {
  const res = await fetch(
    `${API_URL}/api/student/ai-evaluations?email=${encodeURIComponent(email)}&limit=${encodeURIComponent(limit)}`
  );
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function saveStudentProfile(payload) {
  const res = await fetch(`${API_URL}/api/student/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function uploadStudentProfilePicture({ email, file }) {
  const data_url = await fileToDataUrl(file);
  const res = await fetch(`${API_URL}/api/student/profile/photo/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      file_name: file && file.name ? file.name : '',
      data_url
    })
  });
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File is required'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

async function parseJsonOrError(res) {
  const text = await res.text();
  if (!text) return { errors: [res.ok ? '' : `HTTP ${res.status}`] };
  try {
    return JSON.parse(text);
  } catch {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(text);
    if (!res.ok && looksLikeHtml) {
      return { errors: [`HTTP ${res.status}`] };
    }
    return { errors: [res.ok ? 'Invalid JSON response from server.' : `HTTP ${res.status}: ${text.slice(0, 160)}`] };
  }
}

export async function uploadReportFile({ email, kind, file }) {
  const data_url = await fileToDataUrl(file);
  const res = await fetch(`${API_URL}/api/report/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      kind,
      file_name: file && file.name ? file.name : '',
      data_url
    })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function uploadMessageFile({ user, peer, file }) {
  const data_url = await fileToDataUrl(file);
  const res = await fetch(`${API_URL}/api/messages/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user,
      peer,
      file_name: file && file.name ? file.name : '',
      data_url
    })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function getMessages({ user, peer }) {
  const res = await fetch(`${API_URL}/api/messages?user=${encodeURIComponent(user)}&peer=${encodeURIComponent(peer)}`);
  const data = await res.json();
  return { ok: res.ok, data };
}
export async function sendMessage(payload) {
  const res = await fetch(`${API_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export function openMessageStream({ user, peer, onMessage, onError, onOpen }) {
  if (!user || !peer) return () => {};
  const qs = new URLSearchParams();
  qs.set('user', user);
  qs.set('peer', peer);
  const es = new EventSource(`${API_URL}/api/messages/stream?${qs.toString()}`);

  const handleMessage = (ev) => {
    if (!ev || !ev.data) return;
    try {
      const row = JSON.parse(ev.data);
      if (row && typeof row === 'object' && typeof onMessage === 'function') onMessage(row);
    } catch {
      // Ignore malformed payloads.
    }
  };
  const handleError = () => {
    if (typeof onError === 'function') onError();
  };
  const handleOpen = () => {
    if (typeof onOpen === 'function') onOpen();
  };

  es.addEventListener('open', handleOpen);
  es.addEventListener('message', handleMessage);
  es.addEventListener('error', handleError);

  return () => {
    es.removeEventListener('open', handleOpen);
    es.removeEventListener('message', handleMessage);
    es.removeEventListener('error', handleError);
    es.close();
  };
}

export async function listSupervisors({ student_email, role = 'supervisor' }) {
  const res = await fetch(
    `${API_URL}/api/student/supervisors?student_email=${encodeURIComponent(student_email)}&role=${encodeURIComponent(role)}`
  );
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function simulateGrade(payload) {
  const res = await fetch(`${API_URL}/api/simulator/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}

export async function simulateGradeFromReportFile({ email, file }) {
  const data_url = await fileToDataUrl(file);
  const res = await fetch(`${API_URL}/api/simulator/grade-from-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      file_name: file && file.name ? file.name : '',
      data_url
    })
  });
  const data = await parseJsonOrError(res);
  return { ok: res.ok, data };
}
