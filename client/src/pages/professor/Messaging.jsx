import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listMyStudents, assignMyStudent } from '../../lib/professorApi.js';
import { getMessages, sendMessage, openMessageStream, uploadMessageFile } from '../../lib/studentApi.js';

const MESSAGE_FILE_ACCEPT = 'image/*,.pdf';

function parseContent(raw) {
  if (typeof raw !== 'string') return { text: '' };
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') {
      const text = typeof j.text === 'string' ? j.text : '';
      const attachment =
        j.attachment && typeof j.attachment === 'object'
          ? {
              name: String(j.attachment.name || '').trim(),
              url: String(j.attachment.url || '').trim(),
              mime_type: String(j.attachment.mime_type || '').trim().toLowerCase(),
              kind: String(j.attachment.kind || '').trim().toLowerCase()
            }
          : null;
      return { text, attachment };
    }
  } catch {
    // ignore
  }
  return { text: raw };
}

function isImageAttachment(attachment) {
  if (!attachment || !attachment.url) return false;
  if (String(attachment.kind || '').toLowerCase() === 'image') return true;
  const mime = String(attachment.mime_type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(String(attachment.url || ''));
}

function lastSeenKey(me, peer) {
  return `monpfe:last_seen:${me}:${peer}`;
}

function isSameMessage(a, b) {
  if (!a || !b) return false;
  if (a.id !== undefined && b.id !== undefined && a.id !== null && b.id !== null) {
    return Number(a.id) === Number(b.id);
  }
  return (
    String(a.user || '') === String(b.user || '') &&
    String(a.peer || '') === String(b.peer || '') &&
    String(a.content || '') === String(b.content || '') &&
    Number(a.created_at || 0) === Number(b.created_at || 0)
  );
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function dayKey(ts) {
  const d = new Date(Number(ts) || 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(ts) {
  const d = new Date(Number(ts) || 0);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(today.getTime()) === dayKey(d.getTime())) return 'Aujourd hui';
  if (dayKey(yesterday.getTime()) === dayKey(d.getTime())) return 'Hier';
  return d.toLocaleDateString();
}

function formatTime(ts) {
  const d = new Date(Number(ts) || 0);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nameInitial(name) {
  const raw = String(name || '').trim();
  if (!raw) return '?';
  return raw.charAt(0).toUpperCase();
}

export default function ProfMessaging({ teacherEmail, initialPeer }) {
  const me = String(teacherEmail || '').toLowerCase();
  const initialEmail = typeof initialPeer === 'string' ? initialPeer : initialPeer && initialPeer.email;

  const [peers, setPeers] = useState([]);
  const [peerEmail, setPeerEmail] = useState(initialEmail || '');
  const [msgs, setMsgs] = useState([]);
  const [unread, setUnread] = useState({});
  const [peerQuery, setPeerQuery] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [text, setText] = useState('');
  const [draftAttachment, setDraftAttachment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const threadRef = useRef(null);
  const fileInputRef = useRef(null);

  const filteredPeers = useMemo(() => {
    const q = peerQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q));
  }, [peers, peerQuery]);

  function markPeerSeen(targetPeerEmail) {
    if (!targetPeerEmail) return;
    try {
      localStorage.setItem(lastSeenKey(me, targetPeerEmail), String(Date.now()));
    } catch {
      // ignore
    }
    setUnread((prev) => {
      if (!prev[targetPeerEmail]) return prev;
      const copy = { ...prev };
      delete copy[targetPeerEmail];
      return copy;
    });
  }

  async function loadPeers() {
    let r = null;
    try {
      r = await listMyStudents({ teacher_email: me, role: 'all' });
    } catch {
      setError("Impossible de joindre l'API (messagerie).");
      setPeers([]);
      return;
    }

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Impossible de charger la liste des etudiants.');
      setPeers([]);
      return;
    }

    setError('');
    const rows = Array.isArray(r.data) ? r.data : [];
    const peersMap = new Map();
    for (const row of rows) {
      if (!row || !row.student_email) continue;
      if (!peersMap.has(row.student_email)) {
        peersMap.set(row.student_email, { email: row.student_email, name: row.student_name || row.student_email });
      }
    }
    const nextPeers = Array.from(peersMap.values());
    setPeers(nextPeers);

    if (!nextPeers.length) {
      setPeerEmail('');
      return;
    }
    if (!peerEmail || !nextPeers.some((p) => p.email === peerEmail)) {
      setPeerEmail(nextPeers[0].email);
    }
  }

  async function loadThread(selectedPeer) {
    if (!selectedPeer) {
      setMsgs([]);
      return;
    }
    let r = null;
    try {
      r = await getMessages({ user: me, peer: selectedPeer });
    } catch {
      setError("Impossible de joindre l'API (messagerie).");
      setMsgs([]);
      return;
    }
    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || 'Impossible de charger les messages.');
      setMsgs([]);
      return;
    }
    setError('');
    setMsgs(Array.isArray(r.data) ? r.data : []);
    markPeerSeen(selectedPeer);
  }

  async function refreshUnread(currentPeers) {
    const map = {};
    for (const p of currentPeers) {
      let r = null;
      try {
        r = await getMessages({ user: me, peer: p.email });
      } catch {
        continue;
      }
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) continue;
      const lastFromPeer = [...r.data].reverse().find((m) => m.user === p.email);
      if (!lastFromPeer) continue;
      let seen = 0;
      try {
        seen = Number(localStorage.getItem(lastSeenKey(me, p.email)) || 0);
      } catch {
        seen = 0;
      }
      if (Number(lastFromPeer.created_at) > seen) map[p.email] = 1;
    }
    setUnread(map);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadPeers();
      setLoading(false);
    })();
  }, [me]);

  useEffect(() => {
    if (!initialEmail) return;
    setPeerEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    (async () => {
      await loadThread(peerEmail);
      if (peers.length) await refreshUnread(peers);
    })();
  }, [peerEmail]);

  useEffect(() => {
    setDraftAttachment(null);
  }, [peerEmail]);

  useEffect(() => {
    if (!peerEmail) return undefined;
    return openMessageStream({
      user: me,
      peer: peerEmail,
      onMessage: (incoming) => {
        if (!incoming || typeof incoming !== 'object') return;
        setMsgs((old) => (old.some((m) => isSameMessage(m, incoming)) ? old : [...old, incoming]));
        if (incoming.user === peerEmail) markPeerSeen(peerEmail);
      }
    });
  }, [me, peerEmail]);

  useEffect(() => {
    if (!peers.length) return undefined;
    refreshUnread(peers);
    const id = setInterval(() => refreshUnread(peers), 8000);
    return () => clearInterval(id);
  }, [peers, me]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function onAssignStudent() {
    const studentEmail = newStudentEmail.trim().toLowerCase();
    if (!studentEmail) return;
    if (!isEmail(studentEmail)) {
      setError('Email etudiant invalide.');
      return;
    }

    setAddingStudent(true);
    const r = await assignMyStudent({
      teacher_email: me,
      student_email: studentEmail,
      role: 'supervisor'
    });
    setAddingStudent(false);

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || "Impossible d'ajouter cet etudiant.");
      return;
    }

    setError('');
    setNewStudentEmail('');
    await loadPeers();
    setPeerEmail(studentEmail);
  }

  async function onPickAttachment(file) {
    if (!file || !peerEmail || uploadingAttachment) return;
    setUploadingAttachment(true);
    try {
      const r = await uploadMessageFile({ user: me, peer: peerEmail, file });
      if (!r.ok) {
        setError((r.data && r.data.errors && r.data.errors[0]) || 'Impossible de televerser la piece jointe.');
        return;
      }
      setError('');
      setDraftAttachment({
        name: (r.data && r.data.name) || file.name || 'piece jointe',
        url: (r.data && r.data.url) || '',
        mime_type: (r.data && r.data.mime_type) || file.type || '',
        kind: (r.data && r.data.kind) || ''
      });
    } catch {
      setError("Impossible de joindre l'API (piece jointe).");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function onSend() {
    if (sending || uploadingAttachment) return;
    const body = text.trim();
    if (!peerEmail) return;
    if (!body && !draftAttachment?.url) return;

    const payload = {
      text: body,
      attachment: draftAttachment
        ? {
            name: (draftAttachment.name || 'piece jointe').trim(),
            url: draftAttachment.url,
            mime_type: draftAttachment.mime_type || '',
            kind: draftAttachment.kind || ''
          }
        : null
    };
    const content = JSON.stringify(payload);

    setSending(true);
    let r = null;
    try {
      r = await sendMessage({ user: me, peer: peerEmail, content });
    } catch {
      setError("Impossible de joindre l'API (messagerie).");
      setSending(false);
      return;
    }

    if (!r.ok) {
      setError((r.data && r.data.errors && r.data.errors[0]) || "Impossible d'envoyer le message.");
      setSending(false);
      return;
    }

    const createdAt = Number((r.data && r.data.created_at) || Date.now());
    const messageId = r.data && r.data.id;
    const outgoing = { id: messageId, user: me, peer: peerEmail, content, created_at: createdAt };
    setMsgs((old) => (old.some((m) => isSameMessage(m, outgoing)) ? old : [...old, outgoing]));
    setText('');
    setDraftAttachment(null);
    setError('');
    markPeerSeen(peerEmail);
    setSending(false);
  }

  function onMessageKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  if (loading) return <p className="subtitle">Chargement de la messagerie...</p>;

  let lastDay = '';

  return (
    <div className="messaging-shell">
      {error && <div className="errors">{error}</div>}

      <div className="messaging-grid">
        <aside className="messaging-sidebar has-inline-form">
          <div className="messaging-sidebar-head">
            <strong>Etudiants</strong>
            <span>{peers.length}</span>
          </div>

          <div className="messaging-inline-form">
            <input
              value={newStudentEmail}
              onChange={(e) => setNewStudentEmail(e.target.value)}
              placeholder="Ajouter un etudiant (email)"
              aria-label="Ajouter un etudiant"
            />
            <button className="btn" type="button" onClick={onAssignStudent} disabled={addingStudent || !newStudentEmail.trim()}>
              {addingStudent ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>

          <div className="messaging-search">
            <input
              value={peerQuery}
              onChange={(e) => setPeerQuery(e.target.value)}
              placeholder="Rechercher un etudiant..."
              aria-label="Rechercher un etudiant"
            />
          </div>

          <div className="messaging-peer-list">
            {filteredPeers.map((p) => {
              const active = p.email === peerEmail;
              return (
                <button
                  key={p.email}
                  className={`messaging-peer-btn${active ? ' active' : ''}`}
                  type="button"
                  onClick={() => setPeerEmail(p.email)}
                >
                  <span className="messaging-peer-main">
                    <span className="messaging-peer-avatar" aria-hidden="true">
                      {nameInitial(p.name)}
                    </span>
                    <span className="messaging-peer-meta">
                      <span className="messaging-peer-name">{p.name}</span>
                      <span className="messaging-peer-email">{p.email}</span>
                    </span>
                  </span>
                  {unread[p.email] ? <span className="messaging-unread-dot" aria-label="Nouveaux messages" /> : null}
                </button>
              );
            })}
            {!filteredPeers.length && (
              <div className="messaging-empty-side">{peers.length ? 'Aucun resultat pour cette recherche.' : 'Aucun etudiant affecte.'}</div>
            )}
          </div>
        </aside>

        <section className="messaging-main">
          <div ref={threadRef} className="messaging-thread">
            {!peerEmail && <div className="messaging-empty">Selectionnez un etudiant pour commencer.</div>}
            {peerEmail && !msgs.length && <div className="messaging-empty">Pas encore de messages dans cette conversation.</div>}
            {peerEmail &&
              msgs.map((m, i) => {
                const mine = m.user === me;
                const c = parseContent(m.content);
                const key = m.id || `${m.created_at || 0}-${i}`;
                const currentDay = dayKey(m.created_at);
                const showDay = !!currentDay && currentDay !== lastDay;
                if (currentDay) lastDay = currentDay;
                return (
                  <React.Fragment key={key}>
                    {showDay && <div className="messaging-day-sep">{formatDayLabel(m.created_at)}</div>}
                    <div className={`message-row${mine ? ' mine' : ''}`}>
                      <div className={`message-bubble${mine ? ' mine' : ''}`}>
                        {c.text ? <div className="message-text">{c.text}</div> : null}
                        {c.attachment && c.attachment.url ? (
                          isImageAttachment(c.attachment) ? (
                            <a className="message-attachment-image-link" href={c.attachment.url} target="_blank" rel="noreferrer">
                              <img
                                className="message-attachment-image"
                                src={c.attachment.url}
                                alt={c.attachment.name || 'image partagee'}
                                loading="lazy"
                              />
                            </a>
                          ) : (
                            <a className="message-attachment-file" href={c.attachment.url} target="_blank" rel="noreferrer">
                              <span className="message-attachment-file-icon" aria-hidden="true">
                                PDF
                              </span>
                              <span className="message-attachment-file-name">{c.attachment.name || 'Piece jointe'}</span>
                            </a>
                          )
                        ) : null}
                        <div className="message-time">{formatTime(m.created_at)}</div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
          </div>

          <div className="messaging-compose">
            <div className="messaging-compose-inline">
              <textarea
                className="messaging-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onMessageKeyDown}
                placeholder={peerEmail ? 'Votre message...' : 'Selectionnez une conversation'}
                disabled={!peerEmail || sending || uploadingAttachment}
              />

              <div className="messaging-compose-inline-actions">
                <button
                  className="btn messaging-compose-inline-btn"
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={!peerEmail || sending || uploadingAttachment}
                >
                  {uploadingAttachment ? 'Televersement...' : 'Joindre'}
                </button>
                <button
                  className="primary messaging-compose-inline-btn"
                  type="button"
                  onClick={onSend}
                  disabled={!peerEmail || sending || uploadingAttachment || (!text.trim() && !draftAttachment?.url)}
                >
                  {sending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>

            {draftAttachment ? (
              <div className="messaging-attachment-chip">
                <span className="messaging-attachment-chip-name">{draftAttachment.name || 'Piece jointe prete'}</span>
                <button
                  className="messaging-attachment-chip-remove"
                  type="button"
                  onClick={() => setDraftAttachment(null)}
                  disabled={sending || uploadingAttachment}
                >
                  Retirer
                </button>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              className="messaging-file-input"
              type="file"
              accept={MESSAGE_FILE_ACCEPT}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                onPickAttachment(file);
                e.target.value = '';
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
