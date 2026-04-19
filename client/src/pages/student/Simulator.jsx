import React, { useEffect, useMemo, useState } from 'react';
import { getStudentAiEvaluations, simulateGradeFromReportFile } from '../../lib/studentApi.js';

const SIMULATOR_SCALE_MAX = 7;
const SIMULATOR_SCALE_RATIO = SIMULATOR_SCALE_MAX / 20;

function scaleFromTwenty(v) {
  return v * SIMULATOR_SCALE_RATIO;
}

function sourceLabel(source) {
  if (source === 'openai') return 'OpenAI model';
  if (source === 'ollama') return 'Ollama local model';
  return 'Local AI engine';
}

function signalTone(value) {
  if (value >= scaleFromTwenty(14)) return 'high';
  if (value >= scaleFromTwenty(10)) return 'mid';
  return 'low';
}

function readinessLabel(value) {
  if (value >= scaleFromTwenty(15)) return 'High readiness';
  if (value >= scaleFromTwenty(12)) return 'Good readiness';
  if (value >= scaleFromTwenty(10)) return 'Moderate readiness';
  return 'Needs reinforcement';
}

function readinessTone(value) {
  if (value >= scaleFromTwenty(15)) return 'high';
  if (value >= scaleFromTwenty(12)) return 'mid';
  return 'low';
}

function FeedbackList({ title, items, tone = 'neutral' }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <div className={`sim-ai-feedback sim-ai-feedback-${tone}`}>
      <p className="sim-ai-feedback-title">{title}</p>
      <ul className="sim-ai-feedback-list">
        {list.map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function fmtDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(Number(value)).toLocaleString();
  } catch {
    return '-';
  }
}

export default function Simulator({ email }) {
  const [reportFile, setReportFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let active = true;
    if (!email) {
      setHistory([]);
      return () => {};
    }
    (async () => {
      const r = await getStudentAiEvaluations({ email, limit: 6 });
      if (!active) return;
      setHistory(r.ok && Array.isArray(r.data) ? r.data : []);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  const confidencePct = Math.max(
    0,
    Math.min(100, Math.round(Number(result && result.ai_feedback && result.ai_feedback.confidence ? result.ai_feedback.confidence : 0) * 100))
  );

  const signals = useMemo(() => {
    if (!(result && result.ai_feedback && result.ai_feedback.signals)) return [];
    return [
      { key: 'structure', label: 'Structure', value: Number(result.ai_feedback.signals.structure || 0) },
      { key: 'methodology', label: 'Methodology', value: Number(result.ai_feedback.signals.methodology || 0) },
      { key: 'technical_depth', label: 'Technical Depth', value: Number(result.ai_feedback.signals.technical_depth || 0) },
      { key: 'results', label: 'Results', value: Number(result.ai_feedback.signals.results || 0) },
      { key: 'writing_quality', label: 'Writing', value: Number(result.ai_feedback.signals.writing_quality || 0) }
    ];
  }, [result]);

  const meanSignal = useMemo(() => {
    if (!signals.length) return 0;
    const total = signals.reduce((acc, item) => acc + item.value, 0);
    return total / signals.length;
  }, [signals]);

  const topSignal = useMemo(() => {
    if (!signals.length) return null;
    return [...signals].sort((a, b) => b.value - a.value)[0];
  }, [signals]);

  const lowSignal = useMemo(() => {
    if (!signals.length) return null;
    return [...signals].sort((a, b) => a.value - b.value)[0];
  }, [signals]);

  const recommendations = useMemo(() => {
    if (!(result && result.ai_feedback && Array.isArray(result.ai_feedback.recommendations))) return [];
    return result.ai_feedback.recommendations.filter(Boolean);
  }, [result]);

  const activePipelineStep = loading ? (reportFile ? 1 : -1) : result ? 3 : reportFile ? 0 : -1;
  const pipelineSteps = [
    { key: 'ingestion', label: 'Ingestion', done: Boolean(reportFile) },
    { key: 'semantic', label: 'Semantic Parse', done: Boolean(result) },
    { key: 'risk', label: 'Risk Mapping', done: Boolean(result) },
    { key: 'score', label: 'Score Synthesis', done: Boolean(result) }
  ];

  const traceItems = useMemo(() => {
    if (!result) return [];
    return [
      {
        title: 'Document Ingestion',
        detail: result.input ? `${result.input.file_name || 'memoire'} loaded (${result.input.mime_type || 'unknown'})` : 'Report loaded for analysis.'
      },
      {
        title: 'Semantic Extraction',
        detail: topSignal ? `Strongest detected axis: ${topSignal.label} (${topSignal.value.toFixed(1)}/7).` : 'Core sections and language patterns were extracted.'
      },
      {
        title: 'Risk Modeling',
        detail: lowSignal ? `Main risk axis: ${lowSignal.label} (${lowSignal.value.toFixed(1)}/7).` : 'Risk profile generated from current report quality.'
      },
      {
        title: 'Score Synthesis',
        detail: `Final prediction generated at ${Number(result.grade || 0).toFixed(2)}/7 (${result.mention || 'N/A'}).`
      }
    ];
  }, [result, topSignal, lowSignal]);

  function onFileChange(e) {
    const selected = e && e.target && e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setReportFile(selected || null);
    setResult(null);
    setError('');
  }

  async function analyzeReport() {
    if (!reportFile) {
      setError('Please select your memoire file first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await simulateGradeFromReportFile({ email, file: reportFile });
      if (!r.ok) {
        const msg = (r.data && r.data.errors && r.data.errors[0]) || 'Unable to analyze this report file.';
        setResult(null);
        setError(msg);
        return;
      }
      setResult(r.data || null);
      if (email) {
        const nextHistory = await getStudentAiEvaluations({ email, limit: 6 });
        if (nextHistory.ok && Array.isArray(nextHistory.data)) setHistory(nextHistory.data);
      }
    } catch {
      setResult(null);
      setError('Unable to reach backend API for file analysis.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sim-ai-shell sim-ai-shell-pro">
      <section className="sim-ai-hero">
        <span className="sim-ai-hero-badge">AI Defense Intelligence</span>
        <h2 className="title sim-ai-title">
          <span className="sim-ai-robot-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="img" focusable="false">
              <rect x="14" y="18" width="36" height="30" rx="10" />
              <circle cx="26" cy="33" r="4" />
              <circle cx="38" cy="33" r="4" />
              <rect x="27" y="12" width="10" height="6" rx="2" />
              <line x1="32" y1="12" x2="32" y2="7" />
              <circle cx="32" cy="6" r="2.5" />
              <rect x="24" y="41" width="16" height="4" rx="2" />
              <rect x="8" y="28" width="6" height="10" rx="3" />
              <rect x="50" y="28" width="6" height="10" rx="3" />
            </svg>
          </span>
          <span>Intelligent Grade Simulator</span>
        </h2>
        <p className="subtitle sim-ai-subtitle">
          Upload your defense report and get an AI-style evaluation dashboard with predicted final note, confidence, diagnostic signals, and actionable improvements.
        </p>
        <div className="sim-ai-hero-meta">
          <span className="sim-ai-hero-meta-item">Mode: Report-only evaluation</span>
          <span className="sim-ai-hero-meta-item">Output: Grade + strategic guidance</span>
        </div>
        <div className="sim-ai-pipeline">
          {pipelineSteps.map((step, idx) => (
            <div
              className={`sim-ai-pipeline-step ${step.done ? 'is-done' : ''} ${activePipelineStep === idx ? 'is-live' : ''}`}
              key={step.key}
            >
              <span className="sim-ai-step-index">{String(idx + 1).padStart(2, '0')}</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sim-ai-upload-card">
        <div className="sim-ai-upload-head">
          <span className="sim-ai-chip">AI Report Analyzer</span>
          {reportFile && <span className="sim-ai-chip sim-ai-chip-soft">{(reportFile.size / 1024 / 1024).toFixed(2)} MB</span>}
        </div>
        <label>
          <span className="sim-ai-file-label">Defense report file</span>
          <input
            className="sim-ai-file-input"
            type="file"
            accept=".pdf,.doc,.docx,.odt,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/markdown"
            onChange={onFileChange}
          />
        </label>
        <p className="sim-ai-helper">Accepted: PDF, DOC, DOCX, ODT, TXT, MD (max 15 MB).</p>
        <p className="sim-ai-picked">{reportFile ? `Selected file: ${reportFile.name}` : 'No file selected yet.'}</p>
      </section>

      <div className="sim-ai-actions">
        <button className="primary sim-ai-action-btn" onClick={analyzeReport} disabled={loading}>
          {loading ? 'Analyzing report...' : 'Analyze report'}
        </button>
        {loading && <span className="sim-ai-live">AI is reviewing your memoire...</span>}
      </div>

      {error && <div className="errors sim-ai-error">{error}</div>}

      {result && (
        <div className="sim-ai-result-stack">
          <div className="sim-ai-result-layout">
            <div className="sim-ai-main-col">
              <section className="sim-ai-kpi-grid">
                <article className="sim-ai-kpi-card sim-ai-kpi-grade">
                  <span className="sim-ai-kicker">Predicted Final Note</span>
                  <p className="sim-ai-grade">
                    {Number(result.grade || 0).toFixed(2)}
                    <span>/7</span>
                  </p>
                  <p className="sim-ai-mention">{result.mention || 'N/A'}</p>
                </article>

                <article className="sim-ai-kpi-card sim-ai-kpi-confidence">
                  <span className="sim-ai-kicker">Confidence Level</span>
                  <div className="sim-ai-ring" style={{ '--sim-ai-confidence': `${confidencePct}%` }}>
                    <div className="sim-ai-ring-inner">
                      <strong>{confidencePct}%</strong>
                      <span>confidence</span>
                    </div>
                  </div>
                  <p className="sim-ai-kpi-foot">{readinessLabel(meanSignal)}</p>
                </article>

                <article className="sim-ai-kpi-card sim-ai-kpi-source">
                  <span className="sim-ai-provider">Source: {sourceLabel(result.ai_feedback && result.ai_feedback.source)}</span>
                  {result.input && (
                    <p className="sim-ai-meta-text">
                      File: {result.input.file_name || 'memoire'} ({result.input.mime_type || 'unknown'})
                    </p>
                  )}
                  <p className={`sim-ai-readiness tone-${readinessTone(meanSignal)}`}>
                    Quality index: {meanSignal ? meanSignal.toFixed(1) : '0.0'} / 7
                  </p>
                </article>
              </section>

              <section className="sim-ai-system-panel">
                <article className="sim-ai-system-item">
                  <span>Strongest axis</span>
                  <strong>{topSignal ? `${topSignal.label} (${topSignal.value.toFixed(1)}/7)` : 'Pending analysis'}</strong>
                </article>
                <article className="sim-ai-system-item">
                  <span>Main risk</span>
                  <strong>{lowSignal ? `${lowSignal.label} (${lowSignal.value.toFixed(1)}/7)` : 'Pending analysis'}</strong>
                </article>
                <article className="sim-ai-system-item">
                  <span>Action package</span>
                  <strong>{recommendations.length ? `${recommendations.length} recommendations` : 'No actions generated'}</strong>
                </article>
              </section>

              {result.ai_feedback && (
                <section className="sim-ai-guidance sim-ai-guidance-pro">
                  <p className="sim-ai-guidance-title">AI Strategic Summary</p>
                  <p className="sim-ai-summary">{result.ai_feedback.summary}</p>

                  {!!signals.length && (
                    <div className="sim-ai-signals-grid sim-ai-signals-grid-pro">
                      {signals.map((signal) => {
                        const widthPct = Math.max(0, Math.min(100, (signal.value / SIMULATOR_SCALE_MAX) * 100));
                        return (
                          <div key={signal.key} className={`sim-ai-signal-card tone-${signalTone(signal.value)}`}>
                            <div className="sim-ai-signal-head">
                              <span>{signal.label}</span>
                              <strong>{signal.value.toFixed(1)}</strong>
                            </div>
                            <div className="sim-ai-signal-track">
                              <span style={{ width: `${widthPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {!!traceItems.length && (
                <section className="sim-ai-trace-card">
                  <p className="sim-ai-guidance-title">Reasoning Trace</p>
                  <div className="sim-ai-trace-list">
                    {traceItems.map((item, idx) => (
                      <div className="sim-ai-trace-item" key={item.title}>
                        <span className="sim-ai-trace-index">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="sim-ai-trace-copy">
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="sim-ai-side-col">
              <div className="sim-ai-feedback-grid sim-ai-feedback-grid-pro">
                <FeedbackList title="Strengths" items={result.ai_feedback && result.ai_feedback.strengths} tone="good" />
                <FeedbackList title="Risks" items={result.ai_feedback && result.ai_feedback.risks} tone="risk" />
              </div>

              <section className="sim-ai-actions-board">
                <p className="sim-ai-guidance-title">Priority Action Plan</p>
                <div className="sim-ai-plan-grid">
                  {(recommendations.length ? recommendations : ['No recommendations generated for this report yet.'])
                    .slice(0, 4)
                    .map((item, idx) => (
                      <article className="sim-ai-plan-card" key={`plan-${idx}`}>
                        <span className="sim-ai-plan-priority">Priority {idx + 1}</span>
                        <p>{item}</p>
                      </article>
                    ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}

      {!!history.length && (
        <section className="sim-ai-trace-card" style={{ marginTop: 18 }}>
          <p className="sim-ai-guidance-title">Recent AI Evaluations</p>
          <div className="sim-ai-trace-list">
            {history.map((item) => (
              <div className="sim-ai-trace-item" key={item.id || item.generated_at}>
                <span className="sim-ai-trace-index">{String(item.id || '').padStart(2, '0') || 'AI'}</span>
                <div className="sim-ai-trace-copy">
                  <strong>
                    {Number(item.simulated_score || 0).toFixed(2)}/7
                    {item.source ? ` - ${item.source}` : ''}
                  </strong>
                  <p>{item.summary || item.file_name || 'Stored AI evaluation'}</p>
                  <p>{fmtDateTime(item.generated_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
