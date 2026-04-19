import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  createUser,
  findUserById,
  findUserByEmail,
  getDefenseByEmail,
  upsertDefense,
  getReportByEmail,
  upsertReport,
  listDocumentsByStudent,
  listMessages,
  addMessage,
  listStudents,
  getStudentByEmail,
  upsertStudent,
  listTeachers,
  getTeacherByEmail,
  upsertTeacher,
  listRooms,
  addRoom,
  getStats,
  listRoomSlots,
  addRoomSlot,
  syncRoomSlotForDefense,
  reserveRoomSlot,
  getPlanningStatus,
  setPlanningStatus,
  getDocumentDeadlines,
  setDocumentDeadlines,
  listDeadlineEntries,
  rescheduleDefenseToSlot,
  addSupervision,
  listSupervisionsByStudent,
  deleteSupervisionById,
  listReportsAdmin,
  listGradeSummaries,
  listFinalGradesAdmin,
  setFinalGradePublication,
  getFinalGradeSummaryForStudent,
  getPublishedFinalGradeForStudent,
  listEvaluationsAdmin,
  listUserEmailsByRole,
  createNotificationBatch,
  addNotificationDeliveries,
  listNotificationBatches,
  listNotificationBatchesByCreator,
  listNotificationsForRecipient,
  markAllNotificationsRead,
  deleteUserAccount,
  deleteRoomById,
  deleteRoomSlotById,
  deleteScheduleForStudent,
  hasSupervision,
  listSupervisorsForStudent,
  listStudentsForTeacher,
  getSimulatorCriteria,
  upsertSimulatorCriteria,
  upsertEvaluation,
  createAiEvaluation,
  listAiEvaluationsByStudent,
  getConvocationByStudent,
  upsertConvocation,
  createExportRecord,
  listExportRecords
} from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, 'uploads');

app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(uploadsRoot));

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
}
function isPassword(v) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v || '');
}
function splitName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return { first_name: '', last_name: parts[0] || '' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts.slice(-1).join(' ') };
}

function splitCommaSeparated(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildConvocationHtml({ studentEmail, studentName, projectTitle, date, time, room, supervisors, juries }) {
  const now = new Date().toLocaleString();
  const supervisorText = (Array.isArray(supervisors) ? supervisors : []).join(', ') || '-';
  const juryText = (Array.isArray(juries) ? juries : []).join(', ') || '-';
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Convocation</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
        .meta { color: #6b7280; font-size: 12px; margin: 6px 0 18px; }
        h1 { font-size: 20px; margin: 0; }
        .box { border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; }
        .row { display: grid; grid-template-columns: 180px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef2f8; }
        .row:last-child { border-bottom: 0; }
        .k { color: #374151; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
        .v { font-weight: 700; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Convocation de soutenance</h1>
      <div class="meta">Generee le ${escapeHtml(now)}. Utilisez "Imprimer" puis "Enregistrer en PDF" si necessaire.</div>
      <div class="box">
        <div class="row"><div class="k">Etudiant</div><div class="v">${escapeHtml(studentName || studentEmail)}</div></div>
        <div class="row"><div class="k">Email</div><div class="v">${escapeHtml(studentEmail)}</div></div>
        <div class="row"><div class="k">Projet</div><div class="v">${escapeHtml(projectTitle || '-')}</div></div>
        <div class="row"><div class="k">Date</div><div class="v">${escapeHtml(date || '-')}</div></div>
        <div class="row"><div class="k">Heure</div><div class="v">${escapeHtml(time || '-')}</div></div>
        <div class="row"><div class="k">Salle</div><div class="v">${escapeHtml(room || '-')}</div></div>
        <div class="row"><div class="k">Encadrants</div><div class="v">${escapeHtml(supervisorText)}</div></div>
        <div class="row"><div class="k">Jury</div><div class="v">${escapeHtml(juryText)}</div></div>
      </div>
    </body>
  </html>`;
}

const MAX_REPORT_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text'
]);
const ALLOWED_UPLOAD_EXT = new Set(['.pdf', '.doc', '.docx', '.odt']);
const MAX_MESSAGE_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MESSAGE_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);
const IMAGE_MESSAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;
const MAX_SIMULATOR_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_SIMULATOR_FILE_MIME = new Set([
  ...ALLOWED_UPLOAD_MIME,
  'text/plain',
  'text/markdown'
]);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const HAS_VALID_OPENAI_KEY =
  !!OPENAI_API_KEY &&
  !OPENAI_API_KEY.includes('your_openai_api_key_here') &&
  OPENAI_API_KEY.length > 20;
const AI_SIMULATOR_ENABLED = !['0', 'false', 'off', 'no'].includes(
  String(process.env.AI_SIMULATOR_ENABLED || 'true').trim().toLowerCase()
);
const AI_SIMULATOR_MODEL = String(process.env.AI_SIMULATOR_MODEL || 'gpt-4.1-mini').trim();
const AI_SIMULATOR_FILE_MODEL = String(process.env.AI_SIMULATOR_FILE_MODEL || 'gpt-4.1').trim();
const AI_SIMULATOR_API_URL = String(process.env.AI_SIMULATOR_API_URL || 'https://api.openai.com/v1/responses').trim();
const AI_SIMULATOR_TIMEOUT_MS = Number.isFinite(Number(process.env.AI_SIMULATOR_TIMEOUT_MS))
  ? Math.max(1000, Number(process.env.AI_SIMULATOR_TIMEOUT_MS))
  : 9000;
const AI_REPORT_PROVIDER = String(process.env.AI_REPORT_PROVIDER || 'local').trim().toLowerCase();
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim();
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || 'llama3.1:8b').trim();
const FINAL_GRADE_SCALE_MAX = 20;
const SIMULATOR_GRADE_SCALE_MAX = 7;
const SIMULATOR_SCALE_RATIO = SIMULATOR_GRADE_SCALE_MAX / FINAL_GRADE_SCALE_MAX;
const SIMULATOR_PASS_GRADE = Number((10 * SIMULATOR_SCALE_RATIO).toFixed(2));

function parseDataUrlBase64(dataUrl, allowedMimeSet = ALLOWED_UPLOAD_MIME) {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mimeType = String(match[1] || '').toLowerCase();
  if (!allowedMimeSet.has(mimeType)) return null;
  try {
    const buffer = Buffer.from(match[2], 'base64');
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

function resolveUploadExtension({ fileName, mimeType }) {
  const extFromName = path.extname(String(fileName || '')).toLowerCase();
  if (ALLOWED_UPLOAD_EXT.has(extFromName)) return extFromName;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/msword') return '.doc';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  if (mimeType === 'application/vnd.oasis.opendocument.text') return '.odt';
  return '';
}

function resolveSimulatorFileExtension({ fileName, mimeType }) {
  const extFromName = path.extname(String(fileName || '')).toLowerCase();
  const allowedByName = new Set(['.pdf', '.doc', '.docx', '.odt', '.txt', '.md']);
  if (allowedByName.has(extFromName)) return extFromName;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/msword') return '.doc';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  if (mimeType === 'application/vnd.oasis.opendocument.text') return '.odt';
  if (mimeType === 'text/plain') return '.txt';
  if (mimeType === 'text/markdown') return '.md';
  return '';
}

function resolveMessageUploadExtension({ fileName, mimeType }) {
  const extFromName = path.extname(String(fileName || '')).toLowerCase();
  const allowedByName = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif']);
  if (allowedByName.has(extFromName)) return extFromName;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '';
}

function resolveImageUploadExtension({ fileName, mimeType }) {
  const extFromName = path.extname(String(fileName || '')).toLowerCase();
  const allowedByName = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  if (allowedByName.has(extFromName)) return extFromName;
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '';
}

function toPublicUploadUrl(req, relativeUrl) {
  const host = req.get('host');
  if (!host) return relativeUrl;
  return `${req.protocol}://${host}${relativeUrl}`;
}

const messageSubscribers = new Map();
let nextMessageSubscriberId = 1;

function messageThreadKey(a, b) {
  return [String(a || '').toLowerCase(), String(b || '').toLowerCase()].sort().join('::');
}

function resolveMessagingPair({ userEmail, peerEmail }) {
  const user = findUserByEmail(userEmail);
  const peer = findUserByEmail(peerEmail);
  if (!user || !peer) {
    return { ok: false, status: 404, errors: ['Utilisateur introuvable'] };
  }
  if (user.email === peer.email) {
    return { ok: false, status: 400, errors: ['Conversation invalide'] };
  }

  const validPair =
    (user.role === 'student' && peer.role === 'professor') ||
    (user.role === 'professor' && peer.role === 'student');
  if (!validPair) {
    return { ok: false, status: 403, errors: ['Messagerie autorisee uniquement entre etudiant et enseignant'] };
  }

  const student_email = user.role === 'student' ? user.email : peer.email;
  const teacher_email = user.role === 'professor' ? user.email : peer.email;
  const linked =
    hasSupervision({ student_email, teacher_email, role: 'supervisor' }) ||
    hasSupervision({ student_email, teacher_email, role: 'jury' });
  if (!linked) {
    return { ok: false, status: 403, errors: ['Aucune affectation entre ces utilisateurs'] };
  }

  return { ok: true, user, peer, student_email, teacher_email };
}

function addMessageSubscriber({ user, peer, res }) {
  const key = messageThreadKey(user, peer);
  const id = nextMessageSubscriberId++;
  let clients = messageSubscribers.get(key);
  if (!clients) {
    clients = new Map();
    messageSubscribers.set(key, clients);
  }
  clients.set(id, res);

  const cleanup = () => {
    clearInterval(heartbeatId);
    const bucket = messageSubscribers.get(key);
    if (!bucket) return;
    bucket.delete(id);
    if (!bucket.size) messageSubscribers.delete(key);
  };

  const heartbeatId = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 15000);

  return cleanup;
}

function publishMessageEvent(message) {
  const key = messageThreadKey(message.user, message.peer);
  const clients = messageSubscribers.get(key);
  if (!clients || !clients.size) return;
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const [id, res] of clients.entries()) {
    try {
      res.write(payload);
    } catch {
      clients.delete(id);
    }
  }
  if (!clients.size) messageSubscribers.delete(key);
}

function normalizeCriteriaWeights(criteria) {
  const wr0 = Number(criteria.report_weight) || 0;
  const wd0 = Number(criteria.defense_weight) || 0;
  const wi0 = Number(criteria.internship_weight) || 0;
  const sum0 = wr0 + wd0 + wi0;
  if (sum0 <= 0) {
    return { report: 0.4, defense: 0.3, internship: 0.3 };
  }
  return {
    report: wr0 / sum0,
    defense: wd0 / sum0,
    internship: wi0 / sum0
  };
}

function clampScore(v, max = FINAL_GRADE_SCALE_MAX) {
  return Math.max(0, Math.min(max, Number(v) || 0));
}

function clampSimulatorScore(v) {
  return clampScore(v, SIMULATOR_GRADE_SCALE_MAX);
}

function toSimulatorScale(scoreOn20) {
  return Number((clampScore(scoreOn20, FINAL_GRADE_SCALE_MAX) * SIMULATOR_SCALE_RATIO).toFixed(2));
}

function normalizeIncomingSimulatorScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > SIMULATOR_GRADE_SCALE_MAX && n <= FINAL_GRADE_SCALE_MAX) {
    // Backward compatibility: convert historical /20 simulator scores to /7.
    return toSimulatorScale(n);
  }
  return clampSimulatorScore(n);
}

function simulatorThresholdFrom20(scoreOn20) {
  return scoreOn20 * SIMULATOR_SCALE_RATIO;
}

function mentionFromGrade(grade) {
  return grade >= 16 ? 'Tres bien' : grade >= 14 ? 'Bien' : grade >= 12 ? 'Assez bien' : grade >= 10 ? 'Passable' : 'Insuffisant';
}

function notifyFinalGradePublished({ student_email, published_by }) {
  const email = String(student_email || '').trim().toLowerCase();
  if (!isEmail(email)) return;
  const row = getPublishedFinalGradeForStudent(email);
  if (!row || row.avg_grade === null || row.avg_grade === undefined) return;

  const grade = Number(Number(row.avg_grade).toFixed(2));
  if (!Number.isFinite(grade)) return;
  const mention = row.mention || mentionFromGrade(grade);
  const title = 'Final grade published';
  const message = `Votre note finale est publiee / Final grade published: ${grade.toFixed(2)}/20${mention ? ` (${mention})` : ''}.`;
  const author = String(published_by || '').trim().toLowerCase() || 'system';

  const batch_id = createNotificationBatch({
    title,
    message,
    target_type: 'email',
    target_value: email,
    created_by: author
  });
  addNotificationDeliveries({ batch_id, recipient_emails: [email] });
}

function mentionFromSimulatorGrade(grade) {
  return grade >= simulatorThresholdFrom20(16)
    ? 'Tres bien'
    : grade >= simulatorThresholdFrom20(14)
      ? 'Bien'
      : grade >= simulatorThresholdFrom20(12)
        ? 'Assez bien'
        : grade >= simulatorThresholdFrom20(10)
          ? 'Passable'
          : 'Insuffisant';
}

function recommendationForAxis(axis) {
  if (axis === 'report') return 'Improve your report structure: problem statement, methodology, experiments, and clear conclusions.';
  if (axis === 'defense') return 'Practice a timed defense rehearsal with slides and prepare concise answers for expected jury questions.';
  return 'Document concrete internship outcomes: measurable impact, tools used, and lessons learned linked to your project.';
}

function buildRuleBasedSimulatorFeedback({ report, defense, internship, grade, mention }) {
  const scores = [
    { key: 'report', label: 'Report', score: report },
    { key: 'defense', label: 'Defense', score: defense },
    { key: 'internship', label: 'Internship', score: internship }
  ];
  const byScore = [...scores].sort((a, b) => b.score - a.score);
  const strongest = byScore[0];
  const weakest = byScore[byScore.length - 1];
  const gap = strongest.score - weakest.score;

  const strengths = [];
  if (strongest.score >= simulatorThresholdFrom20(14)) strengths.push(`${strongest.label} is your strongest area (${strongest.score.toFixed(1)}/7).`);
  if (grade >= simulatorThresholdFrom20(12)) strengths.push(`Your current projection is ${grade.toFixed(2)}/7 (${mention}).`);
  if (scores.every((x) => x.score >= simulatorThresholdFrom20(10))) strengths.push('All components are above the pass threshold.');
  if (!strengths.length) strengths.push('You already have a baseline to build on before the final evaluation.');

  const risks = [];
  for (const item of scores) {
    if (item.score < simulatorThresholdFrom20(10)) risks.push(`${item.label} is below pass level and can heavily reduce the final result.`);
  }
  if (gap >= simulatorThresholdFrom20(6)) risks.push('The score spread is high; one weak axis can cap your final grade.');
  if (grade < simulatorThresholdFrom20(10)) risks.push('Current projection is below passing grade.');
  if (!risks.length) risks.push('No major risk detected if performance remains stable.');

  const recommendations = [];
  const under12 = scores.filter((x) => x.score < simulatorThresholdFrom20(12)).sort((a, b) => a.score - b.score);
  for (const item of under12) recommendations.push(recommendationForAxis(item.key));
  recommendations.push('Set a weekly target (+0.3 point) on your weakest axis and re-run the simulation to track progress.');
  recommendations.push('Keep the strongest axis stable while investing most effort in the lowest score first.');

  const dedupedRecommendations = Array.from(new Set(recommendations)).slice(0, 4);
  const summaryTarget = weakest.score < simulatorThresholdFrom20(12) ? weakest.label.toLowerCase() : 'consistency across all axes';
  return {
    source: 'rules',
    summary: `Projected grade: ${grade.toFixed(2)}/7 (${mention}). Priority focus: ${summaryTarget}.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    recommendations: dedupedRecommendations
  };
}

function extractAiOutputText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks = [];
  for (const item of output) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string' && part.text.trim()) chunks.push(part.text.trim());
    }
  }
  return chunks.join('\n').trim();
}

function normalizeAiFeedbackShape(raw, fallback) {
  if (!raw || typeof raw !== 'object') return null;
  const summaryRaw = String(raw.summary || '').trim();
  const strengthsRaw = Array.isArray(raw.strengths) ? raw.strengths : [];
  const risksRaw = Array.isArray(raw.risks) ? raw.risks : [];
  const recommendationsRaw = Array.isArray(raw.recommendations) ? raw.recommendations : [];

  const strengths = strengthsRaw.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3);
  const risks = risksRaw.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3);
  const recommendations = recommendationsRaw.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);

  if (!summaryRaw && !strengths.length && !risks.length && !recommendations.length) return null;
  return {
    source: 'openai',
    summary: summaryRaw || fallback.summary,
    strengths: strengths.length ? strengths : fallback.strengths,
    risks: risks.length ? risks : fallback.risks,
    recommendations: recommendations.length ? recommendations : fallback.recommendations
  };
}

async function buildSimulatorFeedback({ report, defense, internship, grade, mention, weights }) {
  const fallback = buildRuleBasedSimulatorFeedback({ report, defense, internship, grade, mention });
  if (!AI_SIMULATOR_ENABLED || !HAS_VALID_OPENAI_KEY || typeof fetch !== 'function') return fallback;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SIMULATOR_TIMEOUT_MS);
  try {
    const promptPayload = {
      grade: Number(grade.toFixed(2)),
      mention,
      scores: { report, defense, internship },
      normalized_weights: {
        report: Number(weights.report.toFixed(4)),
        defense: Number(weights.defense.toFixed(4)),
        internship: Number(weights.internship.toFixed(4))
      }
    };

    const apiRes = await fetch(AI_SIMULATOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_SIMULATOR_MODEL,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You are an academic advisor for an engineering final project simulator. Scores are on a 0..7 scale. Return ONLY valid JSON with keys: summary, strengths, risks, recommendations. Keep feedback concise, practical, and specific.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(promptPayload)
              }
            ]
          }
        ],
        max_output_tokens: 320,
        temperature: 0.35,
        text: {
          format: {
            type: 'json_schema',
            name: 'simulator_feedback',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 3
                },
                risks: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 3
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 2,
                  maxItems: 4
                }
              },
              required: ['summary', 'strengths', 'risks', 'recommendations']
            }
          }
        }
      })
    });

    if (!apiRes.ok) {
      const details = await apiRes.text();
      console.warn(`AI simulator request failed (${apiRes.status}):`, details);
      return fallback;
    }

    const payload = await apiRes.json();
    const outputText = extractAiOutputText(payload);
    if (!outputText) return fallback;

    let parsed = null;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return fallback;
    }
    return normalizeAiFeedbackShape(parsed, fallback) || fallback;
  } catch (e) {
    const reason = e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'unknown';
    console.warn(`AI simulator unavailable (${reason}). Falling back to local feedback.`);
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeFeedbackItems(items, max = 4) {
  return (Array.isArray(items) ? items : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeReportSignals(signals, fallbackScore) {
  const raw = signals && typeof signals === 'object' ? signals : {};
  const fallback = normalizeIncomingSimulatorScore(fallbackScore);
  const fallbackValue = fallback === null ? SIMULATOR_PASS_GRADE : fallback;
  const structure = normalizeIncomingSimulatorScore(raw.structure);
  const methodology = normalizeIncomingSimulatorScore(raw.methodology);
  const technicalDepth = normalizeIncomingSimulatorScore(raw.technical_depth);
  const results = normalizeIncomingSimulatorScore(raw.results);
  const writingQuality = normalizeIncomingSimulatorScore(raw.writing_quality);
  return {
    structure: structure === null ? fallbackValue : structure,
    methodology: methodology === null ? fallbackValue : methodology,
    technical_depth: technicalDepth === null ? fallbackValue : technicalDepth,
    results: results === null ? fallbackValue : results,
    writing_quality: writingQuality === null ? fallbackValue : writingQuality
  };
}

function resolveOpenAiUserError({ status, detailsText, fallbackMessage }) {
  let code = '';
  let message = '';
  try {
    const parsed = JSON.parse(String(detailsText || ''));
    code = String(parsed && parsed.error && parsed.error.code || '').toLowerCase();
    message = String(parsed && parsed.error && parsed.error.message || '');
  } catch {
    // Ignore parse issues, fall back to raw checks.
  }

  const raw = `${message}\n${detailsText || ''}`.toLowerCase();
  if (status === 401 || raw.includes('invalid_api_key')) {
    return 'OPENAI_API_KEY invalide. Regenerer une cle et redemarrer le backend.';
  }
  if (code === 'insufficient_quota' || raw.includes('insufficient_quota') || raw.includes('exceeded your current quota')) {
    return 'Quota OpenAI depasse. Verifiez votre billing/credits OpenAI puis reessayez.';
  }
  if (status === 429) {
    return 'Limite OpenAI atteinte. Reessayez dans quelques minutes.';
  }
  return fallbackMessage;
}

function extractPrintableSegments(raw) {
  return (String(raw || '').match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()_/\-'"%]{4,}/g) || []).join(' ');
}

function extractReportTextFromBuffer({ buffer, mimeType }) {
  const textMime = mimeType === 'text/plain' || mimeType === 'text/markdown';
  let mode = textMime ? 'utf8_direct' : 'binary_printable_segments';
  let text = '';

  if (textMime) {
    text = buffer.toString('utf8');
  } else {
    const utf8Segments = extractPrintableSegments(buffer.toString('utf8'));
    const latinSegments = extractPrintableSegments(buffer.toString('latin1'));
    const utf16Segments = extractPrintableSegments(buffer.toString('utf16le'));
    text = [utf8Segments, latinSegments, utf16Segments].sort((a, b) => b.length - a.length)[0] || '';
  }

  text = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 45000) {
    text = text.slice(0, 45000);
    mode = `${mode}_truncated`;
  }
  return { text, mode };
}

function countKeywordHits(textLower, keywords) {
  let hits = 0;
  for (const key of keywords) {
    if (textLower.includes(key)) hits += 1;
  }
  return hits;
}

function buildReportOnlyResult({
  source,
  grade,
  mention,
  summary,
  strengths,
  risks,
  recommendations,
  confidence,
  signals,
  fileName,
  mimeType,
  byteLength
}) {
  return {
    ok: true,
    data: {
      grade,
      mention,
      based_on: 'report_file_only',
      input: {
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: byteLength
      },
      ai_feedback: {
        source,
        summary,
        strengths,
        risks,
        recommendations,
        confidence,
        signals
      }
    }
  };
}

function buildReportOnlyEvaluationLocal({ fileName, mimeType, byteLength, buffer, note }) {
  const extracted = extractReportTextFromBuffer({ buffer, mimeType });
  const text = extracted.text;
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const lower = text.toLowerCase();
  const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const avgSentenceLength = wordCount / sentenceCount;

  const sections = [
    ['abstract', ['abstract', 'resume', 'summary']],
    ['introduction', ['introduction', 'problem statement', 'motivation']],
    ['methodology', ['methodology', 'approach', 'implementation', 'architecture']],
    ['results', ['results', 'evaluation', 'performance', 'experiment']],
    ['discussion', ['discussion', 'analysis', 'limitations']],
    ['conclusion', ['conclusion', 'future work']],
    ['references', ['references', 'bibliography', 'works cited']]
  ];
  const foundSections = sections.filter(([, keys]) => keys.some((k) => lower.includes(k))).length;

  const methodologyHits = countKeywordHits(lower, [
    'methodology',
    'approach',
    'dataset',
    'implementation',
    'algorithm',
    'architecture',
    'pipeline',
    'experiment',
    'validation'
  ]);
  const technicalHits = countKeywordHits(lower, [
    'model',
    'optimization',
    'complexity',
    'accuracy',
    'precision',
    'recall',
    'f1',
    'prototype',
    'integration',
    'benchmark',
    'security',
    'scalability'
  ]);
  const resultsHits = countKeywordHits(lower, [
    'result',
    'evaluation',
    'comparison',
    'improvement',
    'metric',
    'analysis',
    'discussion'
  ]);

  const structure20 = clampScore(7 + foundSections * 1.8 + (wordCount > 1700 ? 1.5 : 0));
  const methodology20 = clampScore(6 + Math.min(10, methodologyHits) + (wordCount > 2200 ? 1 : 0));
  const technicalDepth20 = clampScore(6 + Math.min(10, technicalHits) + (/[0-9]/.test(text) ? 1 : 0));
  const results20 = clampScore(6 + Math.min(10, resultsHits) + (wordCount > 2400 ? 1 : 0));

  let writingQuality20 = 9;
  if (avgSentenceLength >= 10 && avgSentenceLength <= 32) writingQuality20 += 3;
  if (avgSentenceLength < 6 || avgSentenceLength > 45) writingQuality20 -= 2;
  if (wordCount > 1300) writingQuality20 += 2;
  if (text.includes('???') || text.includes('@@@')) writingQuality20 -= 2;
  writingQuality20 = clampScore(writingQuality20);

  if (wordCount < 300) {
    // Too little extracted text: keep a conservative estimate.
    writingQuality20 = Math.min(writingQuality20, 11);
  }
  const structure = toSimulatorScale(structure20);
  const methodology = toSimulatorScale(methodology20);
  const technical_depth = toSimulatorScale(technicalDepth20);
  const results = toSimulatorScale(results20);
  const writing_quality = toSimulatorScale(writingQuality20);

  const signals = normalizeReportSignals(
    { structure, methodology, technical_depth, results, writing_quality },
    SIMULATOR_PASS_GRADE
  );
  const grade = Number(
    (
      0.28 * signals.structure +
      0.22 * signals.methodology +
      0.24 * signals.technical_depth +
      0.16 * signals.results +
      0.1 * signals.writing_quality
    ).toFixed(2)
  );
  const mention = mentionFromSimulatorGrade(grade);

  const namedSignals = [
    ['Structure', signals.structure],
    ['Methodology', signals.methodology],
    ['Technical depth', signals.technical_depth],
    ['Results', signals.results],
    ['Writing quality', signals.writing_quality]
  ];
  const high = [...namedSignals].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const low = [...namedSignals].sort((a, b) => a[1] - b[1]).slice(0, 2);

  const strengths = high.map(([label, score]) => `${label} looks relatively solid (${score.toFixed(1)}/7).`);
  if (wordCount > 2200) strengths.push('Report length suggests good overall coverage of the topic.');

  const risks = low.map(([label, score]) => `${label} may limit the final score (${score.toFixed(1)}/7).`);
  if (wordCount < 1200) risks.push('Extracted content appears short; missing sections may reduce jury confidence.');
  if (extracted.mode !== 'utf8_direct' && wordCount < 450) {
    risks.push('Limited text extraction from this file type can reduce confidence in the prediction.');
  }

  const recommendationMap = {
    Structure: 'Add explicit sections: abstract, introduction, methodology, results, conclusion, and references.',
    Methodology: 'Detail the methodology step-by-step, including tools, datasets, and validation protocol.',
    'Technical depth': 'Increase technical rigor with design decisions, trade-offs, and implementation details.',
    Results: 'Add measurable results and comparisons (tables/metrics) to support your claims.',
    'Writing quality': 'Improve clarity: shorter paragraphs, precise language, and consistent formatting.'
  };
  const recommendations = low.map(([label]) => recommendationMap[label]).filter(Boolean);
  recommendations.push('Ask your supervisor to review the weakest section before the defense.');
  recommendations.push('Re-run the simulator after revising key sections to track progress.');

  const confidence = Number(
    Math.max(
      0.25,
      Math.min(
        0.9,
        (mimeType === 'text/plain' || mimeType === 'text/markdown' ? 0.55 : 0.38) +
          Math.min(0.32, wordCount / 7000)
      )
    ).toFixed(2)
  );
  const summaryPrefix = note ? `${note} ` : '';
  const summary = `${summaryPrefix}Predicted grade from report file only: ${grade.toFixed(2)}/7 (${mention}).`;

  return buildReportOnlyResult({
    source: 'local',
    grade,
    mention,
    summary,
    strengths: normalizeFeedbackItems(strengths, 4),
    risks: normalizeFeedbackItems(risks, 4),
    recommendations: normalizeFeedbackItems(Array.from(new Set(recommendations)), 5),
    confidence,
    signals,
    fileName,
    mimeType,
    byteLength
  });
}

function normalizeModelReportOutput(parsed, fallbackGrade = SIMULATOR_PASS_GRADE) {
  const parsedGrade = normalizeIncomingSimulatorScore(parsed && parsed.grade);
  const grade = parsedGrade === null ? clampSimulatorScore(fallbackGrade) : parsedGrade;
  const mention = String((parsed && parsed.mention) || '').trim() || mentionFromSimulatorGrade(grade);
  const summary =
    String((parsed && parsed.summary) || '').trim() || `Predicted grade from report file only: ${grade.toFixed(2)}/7 (${mention}).`;
  const strengths = normalizeFeedbackItems(parsed && parsed.strengths, 4);
  const risks = normalizeFeedbackItems(parsed && parsed.risks, 4);
  const recommendations = normalizeFeedbackItems(parsed && parsed.recommendations, 5);
  const confidenceRaw = Number(parsed && parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : null;
  const signals = normalizeReportSignals(parsed && parsed.signals, grade);
  return {
    grade,
    mention,
    summary,
    strengths: strengths.length ? strengths : ['The report contains usable strengths to preserve.'],
    risks: risks.length ? risks : ['Some sections may still need stronger evidence and clarity.'],
    recommendations: recommendations.length
      ? recommendations
      : ['Strengthen the weakest section and validate it with your supervisor before defense.'],
    confidence,
    signals
  };
}

async function buildReportOnlyEvaluationOpenAi({ fileName, dataUrl, mimeType, byteLength }) {
  if (!HAS_VALID_OPENAI_KEY || typeof fetch !== 'function') {
    return { ok: false, status: 503, errors: ['OPENAI_API_KEY manquante ou invalide dans server/.env.'] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SIMULATOR_TIMEOUT_MS);
  try {
    const apiRes = await fetch(AI_SIMULATOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_SIMULATOR_FILE_MODEL,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You are an academic jury advisor. Evaluate only the uploaded final defense report (memoire). Predict a final grade out of 7 using only report quality, and return JSON only.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Analyze this report file only and return concise actionable feedback.' },
              { type: 'input_file', filename: fileName, file_data: dataUrl }
            ]
          }
        ],
        max_output_tokens: 700,
        temperature: 0.2,
        text: {
          format: {
            type: 'json_schema',
            name: 'report_only_grade_prediction',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                grade: { type: 'number', minimum: 0, maximum: 7 },
                mention: { type: 'string' },
                summary: { type: 'string' },
                strengths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
                risks: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
                recommendations: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                signals: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    structure: { type: 'number', minimum: 0, maximum: 7 },
                    methodology: { type: 'number', minimum: 0, maximum: 7 },
                    technical_depth: { type: 'number', minimum: 0, maximum: 7 },
                    results: { type: 'number', minimum: 0, maximum: 7 },
                    writing_quality: { type: 'number', minimum: 0, maximum: 7 }
                  },
                  required: ['structure', 'methodology', 'technical_depth', 'results', 'writing_quality']
                }
              },
              required: ['grade', 'mention', 'summary', 'strengths', 'risks', 'recommendations', 'confidence', 'signals']
            }
          }
        }
      })
    });

    if (!apiRes.ok) {
      const details = await apiRes.text();
      return {
        ok: false,
        status: 502,
        errors: [
          resolveOpenAiUserError({
            status: apiRes.status,
            detailsText: details,
            fallbackMessage: 'Echec de l analyse IA du memoire. Reessayez.'
          })
        ]
      };
    }

    const payload = await apiRes.json();
    const outputText = extractAiOutputText(payload);
    if (!outputText) return { ok: false, status: 502, errors: ['Reponse IA vide pour ce fichier.'] };

    let parsed = null;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return { ok: false, status: 502, errors: ['Format de reponse IA invalide.'] };
    }

    const normalized = normalizeModelReportOutput(parsed, SIMULATOR_PASS_GRADE);
    return buildReportOnlyResult({
      source: 'openai',
      ...normalized,
      fileName,
      mimeType,
      byteLength
    });
  } catch (e) {
    const reason = e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'unknown';
    return { ok: false, status: 502, errors: [`Service OpenAI indisponible (${reason}).`] };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildReportOnlyEvaluationOllama({ fileName, mimeType, byteLength, buffer }) {
  if (typeof fetch !== 'function') {
    return { ok: false, status: 503, errors: ['Fetch indisponible sur ce runtime.'] };
  }
  const extracted = extractReportTextFromBuffer({ buffer, mimeType });
  if (!extracted.text || extracted.text.length < 120) {
    return { ok: false, status: 422, errors: ['Texte insuffisant extrait du fichier pour Ollama.'] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SIMULATOR_TIMEOUT_MS + 6000);
  try {
    const prompt = [
      'Evaluate this final defense report text only.',
      'Return JSON with keys: grade, mention, summary, strengths, risks, recommendations, confidence, signals.',
      'Grade and signals must use a 0..7 scale.',
      'signals keys: structure, methodology, technical_depth, results, writing_quality (0..7).',
      '',
      'REPORT_TEXT_START',
      extracted.text.slice(0, 12000),
      'REPORT_TEXT_END'
    ].join('\n');

    const apiRes = await fetch(`${OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 }
      })
    });
    if (!apiRes.ok) {
      const details = await apiRes.text();
      return { ok: false, status: 502, errors: [`Ollama indisponible (${apiRes.status}): ${details.slice(0, 140)}`] };
    }

    const payload = await apiRes.json();
    const outputText = String(payload && payload.response || '').trim();
    if (!outputText) return { ok: false, status: 502, errors: ['Reponse Ollama vide.'] };

    let parsed = null;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return { ok: false, status: 502, errors: ['Format JSON Ollama invalide.'] };
    }

    const normalized = normalizeModelReportOutput(parsed, SIMULATOR_PASS_GRADE);
    return buildReportOnlyResult({
      source: 'ollama',
      ...normalized,
      fileName,
      mimeType,
      byteLength
    });
  } catch (e) {
    const reason = e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'unknown';
    return { ok: false, status: 502, errors: [`Service Ollama indisponible (${reason}).`] };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildReportOnlyEvaluation({ fileName, dataUrl, mimeType, byteLength, buffer }) {
  if (!AI_SIMULATOR_ENABLED) {
    return { ok: false, status: 503, errors: ['Simulateur IA desactive par configuration serveur'] };
  }

  const provider = ['auto', 'openai', 'ollama', 'local'].includes(AI_REPORT_PROVIDER)
    ? AI_REPORT_PROVIDER
    : 'auto';

  if (provider === 'local') {
    return buildReportOnlyEvaluationLocal({ fileName, mimeType, byteLength, buffer });
  }

  if (provider === 'openai') {
    const openaiRes = await buildReportOnlyEvaluationOpenAi({ fileName, dataUrl, mimeType, byteLength });
    if (openaiRes.ok) return openaiRes;
    return buildReportOnlyEvaluationLocal({
      fileName,
      mimeType,
      byteLength,
      buffer,
      note: `${openaiRes.errors && openaiRes.errors[0] ? openaiRes.errors[0] + ' ' : ''}Fallback local active.`
    });
  }

  if (provider === 'ollama') {
    const ollamaRes = await buildReportOnlyEvaluationOllama({ fileName, mimeType, byteLength, buffer });
    if (ollamaRes.ok) return ollamaRes;
    return buildReportOnlyEvaluationLocal({
      fileName,
      mimeType,
      byteLength,
      buffer,
      note: `${ollamaRes.errors && ollamaRes.errors[0] ? ollamaRes.errors[0] + ' ' : ''}Fallback local active.`
    });
  }

  // auto: try OpenAI, then Ollama, then guaranteed local fallback.
  if (HAS_VALID_OPENAI_KEY) {
    const openaiRes = await buildReportOnlyEvaluationOpenAi({ fileName, dataUrl, mimeType, byteLength });
    if (openaiRes.ok) return openaiRes;
  }

  const ollamaRes = await buildReportOnlyEvaluationOllama({ fileName, mimeType, byteLength, buffer });
  if (ollamaRes.ok) return ollamaRes;

  return buildReportOnlyEvaluationLocal({
    fileName,
    mimeType,
    byteLength,
    buffer,
    note: 'OpenAI/Ollama unavailable. Fallback local active.'
  });
}

function parseBooleanFlag(value) {
  const raw = String(value).toLowerCase();
  if (value === true || value === 1 || value === '1' || raw === 'true') return true;
  if (value === false || value === 0 || value === '0' || raw === 'false') return false;
  return null;
}

function isIsoDateOrEmpty(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function ensurePlanningEditable(res) {
  const planning = getPlanningStatus();
  if (planning && planning.validated) {
    res.status(409).json({ errors: ['Planning valide: repassez en brouillon pour modifier.'] });
    return false;
  }
  return true;
}

app.get('/', (req, res) => {
  res.json({ ok: true, name: 'Planner API' });
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, role, password, administratorId } = req.body || {};
    const errors = [];
    if (!name || name.trim().length < 2) errors.push('Nom invalide');
    if (!isEmail(email)) errors.push('Email invalide');
    if (!['student','professor','administrator'].includes(role)) errors.push('Rôle invalide');
    if (!isPassword(password)) errors.push('Mot de passe faible');
    if (role === 'administrator' && !/^\d+$/.test(String(administratorId || '').trim())) {
      errors.push('Identifiant administrateur requis');
    }
    if (errors.length) return res.status(400).json({ errors });

    const existing = findUserByEmail(email);
    if (existing) return res.status(409).json({ errors: ['Email déjà utilisé'] });

    if (role === 'administrator' && findUserById(Number(administratorId))) {
      return res.status(409).json({ errors: ['Identifiant administrateur deja utilise'] });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedName = name.trim();
    const normalizedEmail = email.toLowerCase();
    const id = createUser({
      id: role === 'administrator' ? Number(administratorId) : undefined,
      name: normalizedName,
      email: normalizedEmail,
      role,
      passwordHash,
      createdAt: Date.now()
    });

    // Ensure admin lists are populated even if details haven't been completed yet.
    try {
      const { first_name, last_name } = splitName(normalizedName);
      if (role === 'student') {
        upsertStudent({
          user_email: normalizedEmail,
          student_id: '',
          first_name,
          last_name,
          level: '',
          speciality: '',
          advisor_name: '',
          advisor_email: '',
          project_title: '',
          profile_completed: 0
        });
      } else if (role === 'professor') {
        upsertTeacher({
          user_email: normalizedEmail,
          teacher_id: '',
          first_name,
          last_name,
          grade: '',
          speciality: '',
          profile_completed: 0
        });
      }
    } catch (e) {
      console.warn('Failed to create initial details row for', normalizedEmail, e);
    }

    return res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body || {};
    const errors = [];
    if (!isEmail(email)) errors.push('Email invalide');
    if (!password) errors.push('Mot de passe requis');
    if (!['student','professor','administrator'].includes(role)) errors.push('Rôle invalide');
    if (errors.length) return res.status(400).json({ errors });
    const user = findUserByEmail(email);
    if (!user) return res.status(401).json({ errors: ['Identifiants incorrects'] });
    if (user.role !== role) return res.status(401).json({ errors: ['Rôle incorrect'] });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ errors: ['Identifiants incorrects'] });
    return res.json({ id: user.id, role: user.role, name: user.name });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/defense', (req, res) => {
  const email = req.query.email || '';
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  const d = getDefenseByEmail(email.toLowerCase());
  return res.json(d || null);
});
app.post('/api/defense', (req, res) => {
  const { email, date, time, classroom, jury, project_title, status } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  const normalizedEmail = email.toLowerCase();
  const id = upsertDefense({ user_email: normalizedEmail, date, time, classroom, jury, project_title, status });

  let roomSync = null;
  try {
    roomSync = syncRoomSlotForDefense({
      student_email: normalizedEmail,
      day: date,
      time,
      room_name: classroom
    });
  } catch (e) {
    console.warn('Unable to sync room slot for defense', normalizedEmail, e);
  }

  return res.json({ id, room_sync: roomSync });
});

app.get('/api/report', (req, res) => {
  const email = req.query.email || '';
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  const deadlines = getDocumentDeadlines();
  const deadlineEntries = listDeadlineEntries();
  const reportDeadline = String((deadlines && deadlines.report_deadline) || '').trim();
  const memoireDeadline = String((deadlines && deadlines.memoire_deadline) || '').trim();
  const r = getReportByEmail(email.toLowerCase());
  const documents = listDocumentsByStudent(email.toLowerCase());
  if (!r) {
    return res.json({
      user_email: email.toLowerCase(),
      status: 'not_submitted',
      deadline: reportDeadline,
      report_deadline: reportDeadline,
      memoire_deadline: memoireDeadline,
      report_url: '',
      memoire_url: '',
      documents,
      deadlines: deadlineEntries
    });
  }
  const hasUpload = !!String(r.report_url || '').trim() || !!String(r.memoire_url || '').trim();
  return res.json({
    ...r,
    deadline: reportDeadline || String(r.deadline || '').trim(),
    report_deadline: reportDeadline || String(r.deadline || '').trim(),
    memoire_deadline: memoireDeadline,
    status: hasUpload ? 'submitted' : 'not_submitted',
    documents,
    deadlines: deadlineEntries
  });
});
app.post('/api/report', (req, res) => {
  const { email, report_url, memoire_url } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  const normalizedEmail = email.toLowerCase();
  const normalizedReportUrl = String(report_url || '').trim();
  const normalizedMemoireUrl = String(memoire_url || '').trim();
  const existing = getReportByEmail(normalizedEmail);
  const deadlines = getDocumentDeadlines();
  const reportDeadline = String((deadlines && deadlines.report_deadline) || '').trim() || String((existing && existing.deadline) || '').trim();
  const memoireDeadline = String((deadlines && deadlines.memoire_deadline) || '').trim();
  const hasUpload = !!normalizedReportUrl || !!normalizedMemoireUrl;
  const status = hasUpload ? 'submitted' : 'not_submitted';
  const id = upsertReport({
    user_email: normalizedEmail,
    status,
    deadline: reportDeadline,
    report_url: normalizedReportUrl,
    memoire_url: normalizedMemoireUrl
  });
  return res.json({
    id,
    status,
    deadline: reportDeadline,
    report_deadline: reportDeadline,
    memoire_deadline: memoireDeadline,
    documents: listDocumentsByStudent(normalizedEmail),
    deadlines: listDeadlineEntries()
  });
});

app.post('/api/report/upload', async (req, res) => {
  try {
    const { email, kind, file_name, data_url } = req.body || {};
    const normalizedEmail = String(email || '').toLowerCase();
    const normalizedKind = String(kind || '').toLowerCase();
    if (!isEmail(normalizedEmail)) return res.status(400).json({ errors: ['Email invalide'] });
    if (!['report', 'memoire'].includes(normalizedKind)) {
      return res.status(400).json({ errors: ['Type de document invalide'] });
    }
    const user = findUserByEmail(normalizedEmail);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const parsed = parseDataUrlBase64(data_url);
    if (!parsed) {
      return res.status(400).json({ errors: ['Fichier invalide (types acceptes: PDF, DOC, DOCX, ODT)'] });
    }
    if (!parsed.buffer.length) return res.status(400).json({ errors: ['Fichier vide'] });
    if (parsed.buffer.length > MAX_REPORT_UPLOAD_BYTES) {
      return res.status(400).json({ errors: ['Fichier trop volumineux (max 15 Mo)'] });
    }

    const ext = resolveUploadExtension({ fileName: file_name, mimeType: parsed.mimeType });
    if (!ext) {
      return res.status(400).json({ errors: ['Extension non supportee (PDF, DOC, DOCX, ODT)'] });
    }

    const emailSlug = normalizedEmail.replace(/[^a-z0-9._-]/gi, '_');
    const uniqueName = `${normalizedKind}-${Date.now()}${ext}`;
    const relativeParts = ['reports', emailSlug, uniqueName];
    const absolutePath = path.join(uploadsRoot, ...relativeParts);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, parsed.buffer);
    const publicUrlRelative = `/${['uploads', ...relativeParts].join('/')}`;
    const publicUrl = toPublicUploadUrl(req, publicUrlRelative);

    const existing = getReportByEmail(normalizedEmail);
    const deadlines = getDocumentDeadlines();
    const nextReportDeadline = String((deadlines && deadlines.report_deadline) || '').trim() || String((existing && existing.deadline) || '').trim();
    const nextMemoireDeadline = String((deadlines && deadlines.memoire_deadline) || '').trim();
    const nextReportUrl =
      normalizedKind === 'report' ? publicUrl : String((existing && existing.report_url) || '').trim();
    const nextMemoireUrl =
      normalizedKind === 'memoire' ? publicUrl : String((existing && existing.memoire_url) || '').trim();
    const status = nextReportUrl || nextMemoireUrl ? 'submitted' : 'not_submitted';

    const id = upsertReport({
      user_email: normalizedEmail,
      status,
      deadline: nextReportDeadline,
      report_url: nextReportUrl,
      memoire_url: nextMemoireUrl
    });

    return res.json({
      id,
      url: publicUrl,
      status,
      deadline: nextReportDeadline,
      report_deadline: nextReportDeadline,
      memoire_deadline: nextMemoireDeadline,
      report_url: nextReportUrl,
      memoire_url: nextMemoireUrl,
      documents: listDocumentsByStudent(normalizedEmail),
      deadlines: listDeadlineEntries()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/document-deadlines', (req, res) => {
  const data = getDocumentDeadlines();
  return res.json({
    report_deadline: String((data && data.report_deadline) || '').trim(),
    memoire_deadline: String((data && data.memoire_deadline) || '').trim(),
    updated_at: data && data.updated_at ? data.updated_at : null,
    updated_by: String((data && data.updated_by) || '').trim(),
    deadlines: listDeadlineEntries()
  });
});

app.get('/api/messages', (req, res) => {
  const user = String(req.query.user || '').toLowerCase();
  const peer = String(req.query.peer || '').toLowerCase();
  if (!isEmail(user) || !isEmail(peer)) return res.status(400).json({ errors: ['Paramètres invalides'] });
  const access = resolveMessagingPair({ userEmail: user, peerEmail: peer });
  if (!access.ok) return res.status(access.status).json({ errors: access.errors });
  const rows = listMessages({ user, peer });
  return res.json(rows);
});
app.post('/api/messages', (req, res) => {
  const { user, peer, content } = req.body || {};
  const sender = String(user || '').toLowerCase();
  const recipient = String(peer || '').toLowerCase();
  const message = typeof content === 'string' ? content.trim() : '';
  if (!isEmail(sender) || !isEmail(recipient) || !message) return res.status(400).json({ errors: ['Parametres invalides'] });
  if (message.length > 5000) return res.status(400).json({ errors: ['Message trop long (max 5000 caracteres)'] });
  const access = resolveMessagingPair({ userEmail: sender, peerEmail: recipient });
  if (!access.ok) return res.status(access.status).json({ errors: access.errors });
  const created_at = Date.now();
  const id = addMessage({ user: sender, peer: recipient, content: message, created_at });
  publishMessageEvent({ id, user: sender, peer: recipient, content: message, created_at });
  return res.json({ id, created_at });
});

app.post('/api/messages/upload', async (req, res) => {
  try {
    const sender = String((req.body && req.body.user) || '').toLowerCase();
    const recipient = String((req.body && req.body.peer) || '').toLowerCase();
    const fileName = String((req.body && req.body.file_name) || '').trim();
    const dataUrl = req.body && req.body.data_url;

    if (!isEmail(sender) || !isEmail(recipient)) return res.status(400).json({ errors: ['Parametres invalides'] });
    const access = resolveMessagingPair({ userEmail: sender, peerEmail: recipient });
    if (!access.ok) return res.status(access.status).json({ errors: access.errors });

    const parsed = parseDataUrlBase64(dataUrl, ALLOWED_MESSAGE_UPLOAD_MIME);
    if (!parsed) return res.status(400).json({ errors: ['Fichier invalide (images et PDF uniquement)'] });
    if (!parsed.buffer.length) return res.status(400).json({ errors: ['Fichier vide'] });
    if (parsed.buffer.length > MAX_MESSAGE_UPLOAD_BYTES) {
      return res.status(400).json({ errors: ['Fichier trop volumineux (max 12 Mo)'] });
    }

    const ext = resolveMessageUploadExtension({ fileName, mimeType: parsed.mimeType });
    if (!ext) return res.status(400).json({ errors: ['Extension non supportee'] });

    const threadSlug = messageThreadKey(sender, recipient).replace(/[^a-z0-9._-]/gi, '_');
    const uniqueName = `att-${Date.now()}${ext}`;
    const relativeParts = ['messages', threadSlug, uniqueName];
    const absolutePath = path.join(uploadsRoot, ...relativeParts);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, parsed.buffer);

    const relativeUrl = `/${['uploads', ...relativeParts].join('/')}`;
    const absoluteUrl = toPublicUploadUrl(req, relativeUrl);
    const kind = IMAGE_MESSAGE_MIME.has(parsed.mimeType) ? 'image' : 'pdf';
    const safeName = fileName || (kind === 'image' ? `image${ext}` : `document${ext}`);

    return res.json({
      ok: true,
      url: absoluteUrl,
      name: safeName,
      mime_type: parsed.mimeType,
      kind
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/messages/stream', (req, res) => {
  const user = String(req.query.user || '').toLowerCase();
  const peer = String(req.query.peer || '').toLowerCase();
  if (!isEmail(user) || !isEmail(peer)) return res.status(400).json({ errors: ['Parametres invalides'] });

  const access = resolveMessagingPair({ userEmail: user, peerEmail: peer });
  if (!access.ok) return res.status(access.status).json({ errors: access.errors });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write('retry: 2500\n');
  res.write('event: ready\n');
  res.write('data: {"ok":true}\n\n');

  const cleanup = addMessageSubscriber({ user, peer, res });
  req.on('close', cleanup);
});

app.get('/api/student/ai-evaluations', (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase();
    const limit = req.query.limit;
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    return res.json(listAiEvaluationsByStudent(email, limit));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/simulator/grade', async (req, res) => {
  try {
    const { report = 0, defense = 0, internship = 0, email } = req.body || {};
    const reportScore = normalizeIncomingSimulatorScore(report) || 0;
    const defenseScore = normalizeIncomingSimulatorScore(defense) || 0;
    const internshipScore = normalizeIncomingSimulatorScore(internship) || 0;
    const criteria = getSimulatorCriteria();
    const weights = normalizeCriteriaWeights(criteria);
    const grade = Number(
      (
        weights.report * reportScore +
        weights.defense * defenseScore +
        weights.internship * internshipScore
      ).toFixed(2)
    );
    const mention = mentionFromSimulatorGrade(grade);
    const aiFeedback = await buildSimulatorFeedback({
      report: reportScore,
      defense: defenseScore,
      internship: internshipScore,
      grade,
      mention,
      weights
    });

    let evaluation_id = null;
    const studentEmail = String(email || '').trim().toLowerCase();
    const studentUser = studentEmail && isEmail(studentEmail) ? findUserByEmail(studentEmail) : null;
    if (studentUser && studentUser.role === 'student') {
      evaluation_id = createAiEvaluation({
        student_email: studentEmail,
        simulated_score: grade,
        strengths: aiFeedback && aiFeedback.strengths,
        weaknesses: aiFeedback && aiFeedback.recommendations ? aiFeedback.recommendations.slice(0, 2) : [],
        advice: aiFeedback && aiFeedback.recommendations,
        risks: aiFeedback && aiFeedback.risks,
        summary: aiFeedback && aiFeedback.summary,
        source: aiFeedback && aiFeedback.source,
        file_name: '',
        generated_at: Date.now()
      });
    }

    return res.json({
      grade,
      mention,
      breakdown: {
        report: reportScore,
        defense: defenseScore,
        internship: internshipScore,
        weights
      },
      ai_feedback: aiFeedback,
      evaluation_id
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/simulator/grade-from-report', async (req, res) => {
  try {
    const fileNameRaw = String((req.body && req.body.file_name) || '').trim();
    const dataUrl = req.body && req.body.data_url;
    const studentEmail = String((req.body && req.body.email) || '').trim().toLowerCase();

    const parsed = parseDataUrlBase64(dataUrl, ALLOWED_SIMULATOR_FILE_MIME);
    if (!parsed) {
      return res.status(400).json({
        errors: ['Fichier invalide (types acceptes: PDF, DOC, DOCX, ODT, TXT, MD)']
      });
    }
    if (!parsed.buffer.length) return res.status(400).json({ errors: ['Fichier vide'] });
    if (parsed.buffer.length > MAX_SIMULATOR_FILE_BYTES) {
      return res.status(400).json({ errors: ['Fichier trop volumineux (max 15 Mo)'] });
    }

    const ext = resolveSimulatorFileExtension({ fileName: fileNameRaw, mimeType: parsed.mimeType });
    if (!ext) {
      return res.status(400).json({ errors: ['Extension non supportee (PDF, DOC, DOCX, ODT, TXT, MD)'] });
    }

    const safeFileName = fileNameRaw || `memoire${ext}`;
    const evaluation = await buildReportOnlyEvaluation({
      fileName: safeFileName,
      dataUrl,
      mimeType: parsed.mimeType,
      byteLength: parsed.buffer.length,
      buffer: parsed.buffer
    });
    if (!evaluation.ok) {
      return res.status(evaluation.status || 500).json({ errors: evaluation.errors || ['Erreur IA'] });
    }
    let evaluation_id = null;
    const studentUser = studentEmail && isEmail(studentEmail) ? findUserByEmail(studentEmail) : null;
    if (studentUser && studentUser.role === 'student') {
      const aiFeedback = evaluation.data && evaluation.data.ai_feedback ? evaluation.data.ai_feedback : {};
      evaluation_id = createAiEvaluation({
        student_email: studentEmail,
        simulated_score: Number((evaluation.data && evaluation.data.grade) || 0),
        strengths: aiFeedback.strengths,
        weaknesses: aiFeedback.weaknesses,
        advice: aiFeedback.recommendations,
        risks: aiFeedback.risks,
        summary: aiFeedback.summary,
        source: aiFeedback.source,
        file_name: safeFileName,
        generated_at: Date.now()
      });
    }

    return res.json({
      ...evaluation.data,
      evaluation_id
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/simulator/criteria', (req, res) => {
  return res.json(getSimulatorCriteria());
});
app.post('/api/simulator/criteria', (req, res) => {
  try {
    const { report_weight, defense_weight, internship_weight, updated_by } = req.body || {};
    const rw = Number(report_weight);
    const dw = Number(defense_weight);
    const iw = Number(internship_weight);
    if (![rw, dw, iw].every(n => Number.isFinite(n) && n >= 0)) {
      return res.status(400).json({ errors: ['Criteres invalides'] });
    }
    const sum = rw + dw + iw;
    if (sum <= 0) return res.status(400).json({ errors: ['La somme des poids doit etre > 0'] });
    upsertSimulatorCriteria({ report_weight: rw, defense_weight: dw, internship_weight: iw, updated_by });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/student/profile', (req, res) => {
  const email = String(req.query.email || '').toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });

  const student = getStudentByEmail(email);
  if (!student) return res.status(404).json({ errors: ['Etudiant introuvable'] });
  const supervisors = listSupervisorsForStudent(email, 'supervisor');
  const firstSupervisor = supervisors && supervisors.length ? supervisors[0] : null;

  return res.json({
    user_email: student.user_email,
    account_name: student.account_name || '',
    first_name: student.first_name || '',
    last_name: student.last_name || '',
    student_id: student.student_id || '',
    level: student.level || '',
    speciality: student.speciality || '',
    phone: student.phone || '',
    registration_number: student.registration_number || '',
    department: student.department || '',
    academic_year: student.academic_year || '',
    advisor_name: student.advisor_name || '',
    advisor_email: student.advisor_email || '',
    project_title: student.project_title || '',
    profile_picture_url: student.profile_picture_url || '',
    profile_completed: Number(student.profile_completed) ? 1 : 0,
    supervisor_name: firstSupervisor ? String(firstSupervisor.teacher_name || '') : '',
    supervisor_email: firstSupervisor ? String(firstSupervisor.teacher_email || '') : '',
    supervisors: (supervisors || []).map((s) => ({
      teacher_name: String(s.teacher_name || ''),
      teacher_email: String(s.teacher_email || ''),
      role: String(s.role || 'supervisor')
    }))
  });
});

app.post('/api/student/profile', (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').toLowerCase();
    const first_name = String((req.body && req.body.first_name) || '').trim();
    const last_name = String((req.body && req.body.last_name) || '').trim();
    const student_id = String((req.body && req.body.student_id) || '').trim();
    const level = String((req.body && req.body.level) || '').trim();
    const speciality = String((req.body && req.body.speciality) || '').trim();
    const phone = String((req.body && req.body.phone) || '').trim();
    const registration_number = String((req.body && req.body.registration_number) || '').trim();
    const department = String((req.body && req.body.department) || '').trim();
    const academic_year = String((req.body && req.body.academic_year) || '').trim();
    const advisor_name = String((req.body && req.body.advisor_name) || '').trim();
    const advisor_email = String((req.body && req.body.advisor_email) || '').trim().toLowerCase();
    const project_title = String((req.body && req.body.project_title) || '').trim();

    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });

    const student = getStudentByEmail(email);
    if (!student) return res.status(404).json({ errors: ['Etudiant introuvable'] });

    const errors = [];
    if (!first_name) errors.push('First name requis');
    if (!last_name) errors.push('Last name requis');
    if (!student_id) errors.push('Student ID requis');
    if (!level) errors.push('Level requis');
    if (!speciality) errors.push('Speciality requise');
    if (advisor_email && !isEmail(advisor_email)) errors.push('Advisor email invalide');
    if (!project_title) errors.push('Project title requis');
    if (errors.length) return res.status(400).json({ errors });

    upsertStudent({
      user_email: email,
      student_id,
      first_name,
      last_name,
      level,
      speciality,
      phone,
      registration_number,
      department,
      academic_year,
      advisor_name,
      advisor_email,
      project_title,
      profile_completed: 1
    });

    const nextStudent = getStudentByEmail(email);

    return res.json({
      ok: true,
      profile: {
        user_email: email,
        first_name,
        last_name,
        student_id,
        level,
        speciality,
        phone,
        registration_number,
        department,
        academic_year,
        advisor_name,
        advisor_email,
        project_title,
        profile_picture_url: String((nextStudent && nextStudent.profile_picture_url) || ''),
        profile_completed: 1
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/student/profile/photo/upload', async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').toLowerCase();
    const fileName = String((req.body && req.body.file_name) || '').trim();
    const dataUrl = req.body && req.body.data_url;

    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const parsed = parseDataUrlBase64(dataUrl, IMAGE_MESSAGE_MIME);
    if (!parsed) return res.status(400).json({ errors: ['Image invalide (JPG, PNG, WEBP, GIF uniquement)'] });
    if (!parsed.buffer.length) return res.status(400).json({ errors: ['Fichier vide'] });
    if (parsed.buffer.length > MAX_PROFILE_PICTURE_BYTES) {
      return res.status(400).json({ errors: ['Image trop volumineuse (max 5 Mo)'] });
    }

    const ext = resolveImageUploadExtension({ fileName, mimeType: parsed.mimeType });
    if (!ext) return res.status(400).json({ errors: ['Extension non supportee'] });

    const emailSlug = email.replace(/[^a-z0-9._-]/gi, '_');
    const uniqueName = `avatar-${Date.now()}${ext}`;
    const relativeParts = ['avatars', 'students', emailSlug, uniqueName];
    const absolutePath = path.join(uploadsRoot, ...relativeParts);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, parsed.buffer);

    const relativeUrl = `/${['uploads', ...relativeParts].join('/')}`;
    const absoluteUrl = toPublicUploadUrl(req, relativeUrl);

    const student = getStudentByEmail(email);
    if (!student) return res.status(404).json({ errors: ['Etudiant introuvable'] });

    upsertStudent({
      user_email: email,
      student_id: String(student.student_id || ''),
      first_name: String(student.first_name || ''),
      last_name: String(student.last_name || ''),
      level: String(student.level || ''),
      speciality: String(student.speciality || ''),
      phone: String(student.phone || ''),
      registration_number: String(student.registration_number || ''),
      department: String(student.department || ''),
      academic_year: String(student.academic_year || ''),
      advisor_name: String(student.advisor_name || ''),
      advisor_email: String(student.advisor_email || ''),
      project_title: String(student.project_title || ''),
      profile_picture_url: absoluteUrl,
      profile_completed: Number(student.profile_completed) ? 1 : 0
    });

    return res.json({
      ok: true,
      url: absoluteUrl,
      profile_picture_url: absoluteUrl,
      mime_type: parsed.mimeType,
      name: fileName || `avatar${ext}`
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/student/final-grade', (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const row = getFinalGradeSummaryForStudent(email);
    if (!row) {
      return res.json({ published: false });
    }
    const hasPartialGrades = row.supervisor_grade !== null || row.jury_grade !== null;
    if (!row.published && !hasPartialGrades) {
      return res.json({ published: false });
    }
    const grade = row.avg_grade === null || row.avg_grade === undefined ? null : Number(Number(row.avg_grade).toFixed(2));
    return res.json({
      published: !!row.published && grade !== null,
      student_email: row.student_email,
      student_name: row.student_name,
      supervisor_grade:
        row.supervisor_grade === null || row.supervisor_grade === undefined ? null : Number(Number(row.supervisor_grade).toFixed(2)),
      jury_grade: row.jury_grade === null || row.jury_grade === undefined ? null : Number(Number(row.jury_grade).toFixed(2)),
      grade,
      mention: grade === null ? null : row.mention || mentionFromGrade(grade),
      grades_count: Number(row.grades_count) || 0,
      published_at: row.published_at || null,
      published_by: row.published_by || null
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/student/convocation', (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    return res.json(getConvocationByStudent(email) || null);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/student/convocation/generate', async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });

    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const student = getStudentByEmail(email);
    const defense = getDefenseByEmail(email);
    if (!defense || !String(defense.date || '').trim()) {
      return res.status(400).json({ errors: ['Aucune soutenance planifiee pour cet etudiant'] });
    }

    const participants = listSupervisorsForStudent(email, 'all');
    const supervisors = participants
      .filter((row) => String((row && row.role) || '').toLowerCase() === 'supervisor')
      .map((row) => String((row && (row.teacher_name || row.teacher_email)) || '').trim())
      .filter(Boolean);
    const juryParticipants = participants
      .filter((row) => String((row && row.role) || '').toLowerCase() === 'jury')
      .map((row) => {
        const name = String((row && (row.teacher_name || row.teacher_email)) || '').trim();
        const juryRole = String((row && row.jury_role) || '').trim();
        return juryRole ? `${name} (${juryRole})` : name;
      })
      .filter(Boolean);
    const juryFallback = splitCommaSeparated(defense.jury);
    const juries = juryParticipants.length ? juryParticipants : juryFallback;

    const studentName = [student && student.first_name, student && student.last_name].filter(Boolean).join(' ').trim() || user.name || email;
    const projectTitle = String((defense && defense.project_title) || (student && student.project_title) || '').trim();
    const html = buildConvocationHtml({
      studentEmail: email,
      studentName,
      projectTitle,
      date: String(defense.date || '').trim(),
      time: String(defense.time || '').trim(),
      room: String(defense.classroom || '').trim(),
      supervisors,
      juries
    });

    const emailSlug = email.replace(/[^a-z0-9._-]/gi, '_');
    const uniqueName = `convocation-${Date.now()}.html`;
    const relativeParts = ['convocations', emailSlug, uniqueName];
    const absolutePath = path.join(uploadsRoot, ...relativeParts);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, html, 'utf8');

    const relativeUrl = `/${['uploads', ...relativeParts].join('/')}`;
    const absoluteUrl = toPublicUploadUrl(req, relativeUrl);
    const generatedAt = Date.now();
    const id = upsertConvocation({
      student_email: email,
      file_path: absoluteUrl,
      generated_at: generatedAt
    });

    return res.json({
      id,
      student_email: email,
      generated_at: generatedAt,
      file_path: absoluteUrl,
      url: absoluteUrl
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/professor/profile', (req, res) => {
  const email = String(req.query.email || '').toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });

  const teacher = getTeacherByEmail(email);
  if (!teacher) return res.status(404).json({ errors: ['Enseignant introuvable'] });

  return res.json({
    user_email: teacher.user_email,
    account_name: teacher.account_name || '',
    first_name: teacher.first_name || '',
    last_name: teacher.last_name || '',
    teacher_id: teacher.teacher_id || '',
    grade: teacher.grade || '',
    speciality: teacher.speciality || '',
    phone: teacher.phone || '',
    department: teacher.department || '',
    academic_rank: teacher.academic_rank || '',
    profile_completed: Number(teacher.profile_completed) ? 1 : 0
  });
});

app.post('/api/professor/profile', (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').toLowerCase();
    const first_name = String((req.body && req.body.first_name) || '').trim();
    const last_name = String((req.body && req.body.last_name) || '').trim();
    const teacher_id = String((req.body && req.body.teacher_id) || '').trim();
    const grade = String((req.body && req.body.grade) || '').trim();
    const speciality = String((req.body && req.body.speciality) || '').trim();
    const phone = String((req.body && req.body.phone) || '').trim();
    const department = String((req.body && req.body.department) || '').trim();
    const academic_rank = String((req.body && req.body.academic_rank) || '').trim();

    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });

    const teacher = getTeacherByEmail(email);
    if (!teacher) return res.status(404).json({ errors: ['Enseignant introuvable'] });

    const errors = [];
    if (!first_name) errors.push('First name requis');
    if (!last_name) errors.push('Last name requis');
    if (!teacher_id) errors.push('Professor ID requis');
    if (!grade) errors.push('Grade requis');
    if (!speciality) errors.push('Speciality requise');
    if (errors.length) return res.status(400).json({ errors });

    upsertTeacher({
      user_email: email,
      teacher_id,
      first_name,
      last_name,
      grade,
      speciality,
      phone,
      department,
      academic_rank,
      profile_completed: 1
    });

    return res.json({
      ok: true,
      profile: {
        user_email: email,
        first_name,
        last_name,
        teacher_id,
        grade,
        speciality,
        phone,
        department,
        academic_rank,
        profile_completed: 1
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/student/supervisors', (req, res) => {
  const student_email = String(req.query.student_email || '').toLowerCase();
  const role = String(req.query.role || 'supervisor').toLowerCase();
  if (!isEmail(student_email)) return res.status(400).json({ errors: ['Email invalide'] });
  if (!['supervisor', 'jury', 'all'].includes(role)) return res.status(400).json({ errors: ['Role invalide'] });
  const user = findUserByEmail(student_email);
  if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
  if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
  return res.json(listSupervisorsForStudent(student_email, role));
});

app.get('/api/professor/students', (req, res) => {
  const teacher_email = String(req.query.teacher_email || '').toLowerCase();
  const role = String(req.query.role || 'supervisor');
  if (!isEmail(teacher_email)) return res.status(400).json({ errors: ['Email invalide'] });
  if (!['supervisor', 'jury', 'all'].includes(role)) return res.status(400).json({ errors: ['Role invalide'] });
  const user = findUserByEmail(teacher_email);
  if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
  if (user.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });
  return res.json(listStudentsForTeacher({ teacher_email, role }));
});

app.post('/api/professor/students/assign', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const teacher_email = String((req.body && req.body.teacher_email) || '').toLowerCase();
    const student_email = String((req.body && req.body.student_email) || '').toLowerCase();
    const role = String((req.body && req.body.role) || 'supervisor').toLowerCase();
    if (!isEmail(teacher_email) || !isEmail(student_email)) {
      return res.status(400).json({ errors: ['Emails invalides'] });
    }
    if (!['supervisor', 'jury'].includes(role)) {
      return res.status(400).json({ errors: ['Role invalide'] });
    }

    const teacher = findUserByEmail(teacher_email);
    if (!teacher) return res.status(404).json({ errors: ['Enseignant introuvable'] });
    if (teacher.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });

    const student = findUserByEmail(student_email);
    if (!student) return res.status(404).json({ errors: ['Etudiant introuvable'] });
    if (student.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const id = addSupervision({ student_email, teacher_email, role });
    return res.json({ id, student_email, teacher_email, role });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/professor/schedule', (req, res) => {
  const teacher_email = String(req.query.teacher_email || '').toLowerCase();
  const role = String(req.query.role || 'supervisor');
  if (!isEmail(teacher_email)) return res.status(400).json({ errors: ['Email invalide'] });
  if (!['supervisor', 'jury'].includes(role)) return res.status(400).json({ errors: ['Role invalide'] });
  const user = findUserByEmail(teacher_email);
  if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
  if (user.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });

  const rows = listStudentsForTeacher({ teacher_email, role })
    .filter(r => r.defense_date && r.defense_time)
    .sort((a, b) => String(a.defense_date).localeCompare(String(b.defense_date)) || String(a.defense_time).localeCompare(String(b.defense_time)));

  return res.json(rows);
});

app.get('/api/professor/announcements', (req, res) => {
  const teacher_email = String(req.query.teacher_email || '').toLowerCase();
  const limit = req.query.limit;
  if (!isEmail(teacher_email)) return res.status(400).json({ errors: ['Email invalide'] });
  const teacher = findUserByEmail(teacher_email);
  if (!teacher) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
  if (teacher.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });
  return res.json(listNotificationBatchesByCreator({ created_by: teacher_email, limit }));
});

app.post('/api/professor/announcements', (req, res) => {
  try {
    const teacher_email = String((req.body && req.body.teacher_email) || '').toLowerCase();
    const student_email = String((req.body && req.body.student_email) || '').toLowerCase();
    const title = String((req.body && req.body.title) || '').trim();
    const message = String((req.body && req.body.message) || '').trim();

    if (!isEmail(teacher_email)) return res.status(400).json({ errors: ['Email invalide'] });
    if (!message) return res.status(400).json({ errors: ['Message requis'] });

    const teacher = findUserByEmail(teacher_email);
    if (!teacher) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (teacher.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });

    const linked = listStudentsForTeacher({ teacher_email, role: 'all' });
    const allRecipients = Array.from(
      new Set(
        (Array.isArray(linked) ? linked : [])
          .map((r) => String((r && r.student_email) || '').toLowerCase().trim())
          .filter(Boolean)
      )
    );

    if (!allRecipients.length) return res.status(400).json({ errors: ['Aucun etudiant affecte'] });

    let recipients = allRecipients;
    let target_type = 'role';
    let target_value = 'student';

    if (student_email) {
      if (!isEmail(student_email)) return res.status(400).json({ errors: ['Email etudiant invalide'] });
      if (!allRecipients.includes(student_email)) {
        return res.status(403).json({ errors: ["Cet etudiant n'est pas affecte a cet enseignant"] });
      }
      recipients = [student_email];
      target_type = 'email';
      target_value = student_email;
    }

    const batch_id = createNotificationBatch({
      title,
      message,
      target_type,
      target_value,
      created_by: teacher_email
    });
    const deliveries = addNotificationDeliveries({ batch_id, recipient_emails: recipients });
    return res.json({ batch_id, recipients: recipients.length, deliveries });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/evaluations', (req, res) => {
  try {
    const { student_email, evaluator_email, evaluator_role, grade, comment } = req.body || {};
    const st = String(student_email || '').toLowerCase();
    const ev = String(evaluator_email || '').toLowerCase();
    const role = String(evaluator_role || '');
    const g = grade === null || grade === undefined || grade === '' ? null : Number(grade);

    if (!isEmail(st) || !isEmail(ev)) return res.status(400).json({ errors: ['Emails invalides'] });
    if (!['supervisor', 'jury'].includes(role)) return res.status(400).json({ errors: ['Role invalide'] });
    if (g !== null && !(Number.isFinite(g) && g >= 0 && g <= 20)) return res.status(400).json({ errors: ['Note invalide'] });

    if (!hasSupervision({ student_email: st, teacher_email: ev, role })) {
      return res.status(403).json({ errors: ["Vous n'etes pas affecte a cet etudiant (encadrant/jury)."] });
    }

    const id = upsertEvaluation({ student_email: st, evaluator_email: ev, evaluator_role: role, grade: g, comment });
    return res.json({ id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/admin/evaluations', (req, res) => {
  try {
    const student_email = String((req.body && req.body.student_email) || '').trim().toLowerCase();
    const evaluator_email = String((req.body && req.body.evaluator_email) || '').trim().toLowerCase();
    const evaluator_role = String((req.body && req.body.evaluator_role) || 'jury').trim().toLowerCase();
    const comment = String((req.body && req.body.comment) || '').trim();
    const gradeRaw = req.body && req.body.grade;
    const grade = gradeRaw === null || gradeRaw === undefined || String(gradeRaw).trim() === '' ? null : Number(gradeRaw);

    if (!isEmail(student_email)) return res.status(400).json({ errors: ['Email etudiant invalide'] });
    if (!isEmail(evaluator_email)) return res.status(400).json({ errors: ['Email evaluateur invalide'] });
    if (!['supervisor', 'jury'].includes(evaluator_role)) {
      return res.status(400).json({ errors: ['Role evaluateur invalide'] });
    }
    if (grade !== null && !(Number.isFinite(grade) && grade >= 0 && grade <= 20)) {
      return res.status(400).json({ errors: ['Note invalide'] });
    }

    const student = findUserByEmail(student_email);
    if (!student) return res.status(404).json({ errors: ['Etudiant introuvable'] });
    if (student.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    const id = upsertEvaluation({
      student_email,
      evaluator_email,
      evaluator_role,
      grade,
      comment
    });

    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// Admin APIs
app.get('/api/admin/stats', (req, res) => {
  return res.json(getStats());
});

app.get('/api/admin/document-deadlines', (req, res) => {
  const data = getDocumentDeadlines();
  return res.json({
    report_deadline: String((data && data.report_deadline) || '').trim(),
    memoire_deadline: String((data && data.memoire_deadline) || '').trim(),
    updated_at: data && data.updated_at ? data.updated_at : null,
    updated_by: String((data && data.updated_by) || '').trim(),
    deadlines: listDeadlineEntries()
  });
});

app.post('/api/admin/document-deadlines', (req, res) => {
  try {
    const report_deadline = String((req.body && req.body.report_deadline) || '').trim();
    const memoire_deadline = String((req.body && req.body.memoire_deadline) || '').trim();
    const updated_by = String((req.body && req.body.updated_by) || '').trim().toLowerCase();

    if (!isIsoDateOrEmpty(report_deadline)) {
      return res.status(400).json({ errors: ['report_deadline invalide (YYYY-MM-DD)'] });
    }
    if (!isIsoDateOrEmpty(memoire_deadline)) {
      return res.status(400).json({ errors: ['memoire_deadline invalide (YYYY-MM-DD)'] });
    }

    setDocumentDeadlines({ report_deadline, memoire_deadline, updated_by });
    const data = getDocumentDeadlines();
    return res.json({
      ok: true,
      report_deadline: String((data && data.report_deadline) || '').trim(),
      memoire_deadline: String((data && data.memoire_deadline) || '').trim(),
      updated_at: data && data.updated_at ? data.updated_at : null,
      updated_by: String((data && data.updated_by) || '').trim(),
      deadlines: listDeadlineEntries()
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/planning/status', (req, res) => {
  const s = getPlanningStatus();
  return res.json({
    validated: !!s.validated,
    validated_at: s.validated_at || null,
    validated_by: s.validated_by || null
  });
});
app.post('/api/admin/planning/status', (req, res) => {
  try {
    const { validated, validated_by } = req.body || {};
    const v0 = String(validated).toLowerCase();
    const isTrue = validated === true || validated === 1 || validated === '1' || v0 === 'true';
    const isFalse = validated === false || validated === 0 || validated === '0' || v0 === 'false';
    if (!isTrue && !isFalse) return res.status(400).json({ errors: ['validated invalide'] });
    setPlanningStatus({ validated: isTrue, validated_by });
    const s = getPlanningStatus();
    return res.json({
      ok: true,
      status: {
        validated: !!s.validated,
        validated_at: s.validated_at || null,
        validated_by: s.validated_by || null
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/reports', (req, res) => {
  const status = String(req.query.status || 'all');
  if (!['all', 'submitted', 'not_submitted'].includes(status)) {
    return res.status(400).json({ errors: ['Status invalide'] });
  }
  return res.json(listReportsAdmin({ status }));
});
app.post('/api/admin/reports', (req, res) => {
  try {
    const { user_email, email, status, deadline, report_url, memoire_url } = req.body || {};
    const rawEmail = String(user_email || email || '').toLowerCase();
    if (!isEmail(rawEmail)) return res.status(400).json({ errors: ['Email invalide'] });
    if (!['not_submitted', 'submitted'].includes(status)) return res.status(400).json({ errors: ['Status invalide'] });
    const user = findUserByEmail(rawEmail);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    const id = upsertReport({
      user_email: rawEmail,
      status,
      deadline: deadline || '',
      report_url: report_url || '',
      memoire_url: memoire_url || ''
    });
    return res.json({ id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/grades', (req, res) => {
  return res.json(listGradeSummaries());
});
app.get('/api/admin/final-grades', (req, res) => {
  return res.json(listFinalGradesAdmin());
});
app.post('/api/admin/final-grades/publish', (req, res) => {
  try {
    const published = parseBooleanFlag(req.body && req.body.published);
    if (published === null) return res.status(400).json({ errors: ['published invalide'] });
    const published_by = String((req.body && req.body.published_by) || '').trim().toLowerCase();
    const student_email = String((req.body && req.body.student_email) || '').trim().toLowerCase();

    if (student_email === 'all') {
      const rows = listFinalGradesAdmin();
      let changes = 0;
      if (published) {
        for (const row of rows) {
          if (row.avg_grade === null || row.avg_grade === undefined) continue;
          const r = setFinalGradePublication({
            student_email: row.student_email,
            published: true,
            published_by
          });
          changes += Number((r && r.changes) || 0);
          if (!row.published && Number((r && r.changes) || 0) > 0) {
            try {
              notifyFinalGradePublished({ student_email: row.student_email, published_by });
            } catch (notifyErr) {
              console.warn('Unable to notify final grade publication for', row.student_email, notifyErr);
            }
          }
        }
      } else {
        for (const row of rows) {
          const r = setFinalGradePublication({
            student_email: row.student_email,
            published: false,
            published_by
          });
          changes += Number((r && r.changes) || 0);
        }
      }
      return res.json({ ok: true, scope: 'all', published, changes });
    }

    if (!isEmail(student_email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(student_email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });

    if (published) {
      const summary = listFinalGradesAdmin().find((row) => row.student_email === student_email);
      if (!summary || summary.avg_grade === null || summary.avg_grade === undefined) {
        return res.status(400).json({ errors: ['Aucune note finale calculable pour cet etudiant'] });
      }
    }

    const result = setFinalGradePublication({ student_email, published, published_by });
    if (published && Number((result && result.changes) || 0) > 0) {
      try {
        notifyFinalGradePublished({ student_email, published_by });
      } catch (notifyErr) {
        console.warn('Unable to notify final grade publication for', student_email, notifyErr);
      }
    }
    return res.json({
      ok: true,
      scope: 'student',
      student_email,
      published,
      changes: Number((result && result.changes) || 0),
      published_at: result && result.published_at ? result.published_at : null
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});
app.get('/api/admin/evaluations', (req, res) => {
  return res.json(listEvaluationsAdmin());
});

app.get('/api/admin/notifications', (req, res) => {
  const limit = req.query.limit;
  return res.json(listNotificationBatches({ limit }));
});
app.post('/api/admin/notifications', (req, res) => {
  try {
    const { title, message, target_type, target_value, created_by } = req.body || {};
    const msg = String(message || '').trim();
    if (!msg) return res.status(400).json({ errors: ['Message requis'] });
    if (!['email', 'role'].includes(target_type)) return res.status(400).json({ errors: ['target_type invalide'] });

    let recipients = [];
    if (target_type === 'email') {
      const email = String(target_value || '').toLowerCase();
      if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
      const user = findUserByEmail(email);
      if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
      recipients = [email];
    } else {
      const role = String(target_value || '').toLowerCase();
      if (!['student', 'professor', 'all'].includes(role)) return res.status(400).json({ errors: ['Rôle cible invalide'] });
      if (role === 'all') {
        recipients = [...listUserEmailsByRole('student'), ...listUserEmailsByRole('professor')];
      } else {
        recipients = listUserEmailsByRole(role);
      }
    }

    if (!recipients.length) return res.status(400).json({ errors: ['Aucun destinataire'] });
    const batch_id = createNotificationBatch({ title, message: msg, target_type, target_value, created_by });
    const deliveries = addNotificationDeliveries({ batch_id, recipient_emails: recipients });
    return res.json({ batch_id, recipients: recipients.length, deliveries });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/exports', (req, res) => {
  try {
    const limit = req.query.limit;
    return res.json(listExportRecords({ limit }));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/admin/exports', (req, res) => {
  try {
    const type = String((req.body && req.body.type) || '').trim();
    const file_path = String((req.body && req.body.file_path) || '').trim();
    const generated_by = String((req.body && req.body.generated_by) || '').trim().toLowerCase();
    if (!type) return res.status(400).json({ errors: ['Type export requis'] });
    const id = createExportRecord({ type, file_path, generated_by });
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/notifications', (req, res) => {
  const email = String(req.query.email || '').toLowerCase();
  const limit = req.query.limit;
  if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
  return res.json(listNotificationsForRecipient({ recipient_email: email, limit }));
});
app.post('/api/notifications/read', (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const changes = markAllNotificationsRead(email);
    return res.json({ ok: true, changes });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/students', (req, res) => {
  return res.json(listStudents());
});
app.post('/api/admin/students', (req, res) => {
  (async () => {
    try {
      const {
        user_email,
        student_id,
        first_name,
        last_name,
        level,
        speciality,
        phone,
        registration_number,
        department,
        academic_year,
        advisor_name,
        advisor_email,
        project_title
      } = req.body || {};
      if (!isEmail(user_email)) return res.status(400).json({ errors: ['Email invalide'] });
      const email = user_email.toLowerCase();
      const existing = findUserByEmail(email);
      if (!existing) {
        const name = `${(first_name || '').trim()} ${(last_name || '').trim()}`.trim() || email;
        const passwordHash = await bcrypt.hash('Temp1234!', 10);
        createUser({ name, email, role: 'student', passwordHash, createdAt: Date.now() });
      }
      upsertStudent({
        user_email: email,
        student_id,
        first_name,
        last_name,
        level,
        speciality,
        phone,
        registration_number,
        department,
        academic_year,
        advisor_name,
        advisor_email,
        project_title
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ errors: ["Erreur serveur lors de l'ajout de l'etudiant"] });
    }
  })();
});
app.delete('/api/admin/students/:email', (req, res) => {
  try {
    const email = String(req.params.email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    deleteUserAccount(email);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});
app.get('/api/admin/teachers', (req, res) => {
  return res.json(listTeachers());
});
app.post('/api/admin/teachers', (req, res) => {
  (async () => {
    try {
      const { user_email, teacher_id, first_name, last_name, grade, speciality, phone, department, academic_rank } = req.body || {};
      if (!isEmail(user_email)) return res.status(400).json({ errors: ['Email invalide'] });
      const email = user_email.toLowerCase();
      const existing = findUserByEmail(email);
      if (!existing) {
        const name = `${(first_name || '').trim()} ${(last_name || '').trim()}`.trim() || email;
        const passwordHash = await bcrypt.hash('Temp1234!', 10);
        createUser({ name, email, role: 'professor', passwordHash, createdAt: Date.now() });
      }
      upsertTeacher({ user_email: email, teacher_id, first_name, last_name, grade, speciality, phone, department, academic_rank });
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ errors: ["Erreur serveur lors de l'ajout de l'enseignant"] });
    }
  })();
});
app.delete('/api/admin/teachers/:email', (req, res) => {
  try {
    const email = String(req.params.email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'professor') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un enseignant"] });
    deleteUserAccount(email);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});
app.get('/api/admin/rooms', (req, res) => {
  return res.json(listRooms());
});
app.post('/api/admin/rooms', (req, res) => {
  if (!ensurePlanningEditable(res)) return;
  const { name, capacity, availability_status } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ errors: ['Nom de salle requis'] });
  const normalizedCapacity = Math.max(0, Number(capacity) || 0);
  const normalizedStatus = String(availability_status || '').trim().toLowerCase() || 'available';
  if (!['available', 'limited', 'unavailable'].includes(normalizedStatus)) {
    return res.status(400).json({ errors: ['availability_status invalide'] });
  }
  const id = addRoom({ name: name.trim(), capacity: normalizedCapacity, availability_status: normalizedStatus });
  return res.json({ id });
});
app.delete('/api/admin/rooms/:id', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ errors: ['Id invalide'] });
    const changes = deleteRoomById(id);
    if (!changes) return res.status(404).json({ errors: ['Salle introuvable'] });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/rooms/slots', (req, res) => {
  return res.json(listRoomSlots());
});
app.post('/api/admin/rooms/slots', (req, res) => {
  if (!ensurePlanningEditable(res)) return;
  const { room_name, day, start, end } = req.body || {};
  if (!room_name || !day || !start || !end) return res.status(400).json({ errors: ['Paramètres manquants'] });
  const id = addRoomSlot({ room_name, day, start, end });
  return res.json({ id });
});
app.delete('/api/admin/rooms/slots/:id', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ errors: ['Id invalide'] });
    const changes = deleteRoomSlotById(id);
    if (!changes) return res.status(404).json({ errors: ['Créneau introuvable'] });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/admin/supervisions', (req, res) => {
  if (!ensurePlanningEditable(res)) return;
  const { student_email, teacher_email, role, status, jury_role } = req.body || {};
  if (!isEmail(student_email) || !isEmail(teacher_email)) return res.status(400).json({ errors: ['Emails invalides'] });
  if (!['supervisor','jury'].includes(role)) return res.status(400).json({ errors: ['Rôle invalide'] });
  const normalizedStatus = String(status || '').trim().toLowerCase() || 'active';
  if (!['active', 'completed', 'cancelled'].includes(normalizedStatus)) return res.status(400).json({ errors: ['Statut invalide'] });
  const id = addSupervision({
    student_email: student_email.toLowerCase(),
    teacher_email: teacher_email.toLowerCase(),
    role,
    status: normalizedStatus,
    jury_role: String(jury_role || '').trim()
  });
  return res.json({ id });
});
app.get('/api/admin/supervisions', (req, res) => {
  const student_email = (req.query.student_email || '').toLowerCase();
  if (!isEmail(student_email)) return res.status(400).json({ errors: ['Email invalide'] });
  return res.json(listSupervisionsByStudent(student_email));
});
app.delete('/api/admin/supervisions/:id', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ errors: ['Id invalide'] });
    const changes = deleteSupervisionById(id);
    if (!changes) return res.status(404).json({ errors: ['Affectation introuvable'] });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.get('/api/admin/schedule', (req, res) => {
  const rows = db.prepare(`
    SELECT
      d.date,
      d.time,
      d.classroom AS room,
      rs.id AS slot_id,
      COALESCE(NULLIF(TRIM(COALESCE(sd.first_name, '') || ' ' || COALESCE(sd.last_name, '')), ''), d.user_email) AS student,
      d.user_email AS student_email,
      sd.project_title AS title
    FROM defenses d
    LEFT JOIN student_details sd ON sd.user_email = d.user_email
    LEFT JOIN room_slots rs
      ON rs.reserved_by = d.user_email
     AND rs.day = d.date
     AND rs.room_name = d.classroom
     AND (rs.start || '-' || rs.end) = d.time
    WHERE d.date IS NOT NULL AND d.time IS NOT NULL
    ORDER BY d.date, d.time
  `).all();
  const result = rows.map(r => {
    const sups = listSupervisionsByStudent(r.student_email).filter(x => x.role === 'supervisor').map(x => x.teacher_email);
    const juries = listSupervisionsByStudent(r.student_email).filter(x => x.role === 'jury').map(x => x.teacher_email);
    return {
      day: r.date,
      time: r.time,
      room: r.room,
      slot_id: r.slot_id || null,
      student_email: r.student_email,
      student: r.student,
      supervisors: sups,
      juries,
      title: r.title
    };
  });
  return res.json(result);
});
app.post('/api/admin/schedule/reschedule', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const { student_email, slot_id } = req.body || {};
    const email = String(student_email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const id = Number(slot_id);
    if (!Number.isInteger(id)) return res.status(400).json({ errors: ['slot_id invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    const r = rescheduleDefenseToSlot({ student_email: email, slot_id: id });
    if (!r.ok) return res.status(409).json({ errors: r.errors || ['Impossible de planifier'] });
    return res.json({ ok: true, slot: r.slot });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});
app.delete('/api/admin/schedule/:email', (req, res) => {
  try {
    if (!ensurePlanningEditable(res)) return;
    const email = String(req.params.email || '').toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ errors: ['Email invalide'] });
    const user = findUserByEmail(email);
    if (!user) return res.status(404).json({ errors: ['Utilisateur introuvable'] });
    if (user.role !== 'student') return res.status(400).json({ errors: ["Cet utilisateur n'est pas un etudiant"] });
    deleteScheduleForStudent(email);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

app.post('/api/admin/schedule/auto', (req, res) => {
  if (!ensurePlanningEditable(res)) return;
  const students = db.prepare(`
    SELECT
      u.email AS user_email,
      COALESCE(NULLIF(TRIM(COALESCE(sd.first_name, '') || ' ' || COALESCE(sd.last_name, '')), ''), u.name, u.email) AS student,
      sd.project_title AS title
    FROM users u
    LEFT JOIN student_details sd ON sd.user_email = u.email
    WHERE u.role = 'student'
    ORDER BY u.email
  `).all();
  const slots = listRoomSlots().filter(s => !s.reserved_by);
  const created = [];
  for (const st of students) {
    const supervision = listSupervisionsByStudent(st.user_email);
    if (!supervision.length) continue;
    const slot = slots.shift();
    if (!slot) break;
    reserveRoomSlot({ slot_id: slot.id, student_email: st.user_email });
    const sups = supervision.filter(x => x.role === 'supervisor').map(x => x.teacher_email);
    const juries = supervision.filter(x => x.role === 'jury').map(x => x.teacher_email);
    const juryText = [...sups, ...juries].join(', ');
    upsertDefense({ user_email: st.user_email, date: slot.day, time: `${slot.start}-${slot.end}`, classroom: slot.room_name, jury: juryText });
    created.push({ day: slot.day, time: `${slot.start}-${slot.end}`, room: slot.room_name, student: st.student, supervisors: sups, juries, title: st.title });
  }
  return res.json({ created });
});

app.listen(PORT, () => {
  console.log(`Planner API en cours d’exécution: http://localhost:${PORT}/`);
});
