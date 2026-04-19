import React, { useEffect, useState } from 'react';
import { getReport, setReport, uploadReportFile } from '../../lib/studentApi.js';
import { readDeadlineFallback } from '../../lib/deadlineFallback.js';

const ACCEPTED_DOC_TYPES = '.pdf,.doc,.docx,.odt';

function resolveSubmissionStatus(report) {
  const hasReportUrl = !!String((report && report.report_url) || '').trim();
  const hasMemoireUrl = !!String((report && report.memoire_url) || '').trim();
  return hasReportUrl || hasMemoireUrl ? 'submitted' : 'not_submitted';
}

export default function Report({ email }) {
  const [data, setData] = useState({
    deadline: '',
    report_deadline: '',
    memoire_deadline: '',
    report_url: '',
    memoire_url: '',
    documents: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState({ report: null, memoire: null });
  const [uploading, setUploading] = useState({ report: false, memoire: false });

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getReport({ email });
      if (!active) return;
      const base = r.data || { deadline: '', report_deadline: '', memoire_deadline: '', report_url: '', memoire_url: '', documents: [] };
      const localDeadlines = readDeadlineFallback();
      const reportDeadline = base.report_deadline || base.deadline || localDeadlines.report_deadline || '';
      const memoireDeadline = base.memoire_deadline || localDeadlines.memoire_deadline || '';
      setData({
        deadline: reportDeadline,
        report_deadline: reportDeadline,
        memoire_deadline: memoireDeadline,
        report_url: base.report_url || '',
        memoire_url: base.memoire_url || '',
        documents: Array.isArray(base.documents) ? base.documents : []
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  if (loading) return <p className="subtitle">Loading...</p>;

  const currentStatus = resolveSubmissionStatus(data);

  function onUrlChange(kind, value) {
    if (kind === 'report') setData((prev) => ({ ...prev, report_url: value }));
    else setData((prev) => ({ ...prev, memoire_url: value }));
  }

  function onPickFile(kind, file) {
    setFiles((prev) => ({ ...prev, [kind]: file || null }));
  }

  async function onUploadFile(kind) {
    const selectedFile = files[kind];
    if (!selectedFile) {
      alert('Please select a file first.');
      return;
    }
    setUploading((prev) => ({ ...prev, [kind]: true }));
    try {
      const r = await uploadReportFile({ email, kind, file: selectedFile });
      if (!r.ok) {
        alert((r.data && r.data.errors && r.data.errors[0]) || 'Upload failed');
        return;
      }
      setData((prev) => ({
        ...prev,
        report_url:
          (r.data && r.data.report_url) ||
          (kind === 'report' ? (r.data && r.data.url) || prev.report_url : prev.report_url),
        memoire_url:
          (r.data && r.data.memoire_url) ||
          (kind === 'memoire' ? (r.data && r.data.url) || prev.memoire_url : prev.memoire_url),
        deadline: (r.data && (r.data.report_deadline || r.data.deadline)) || prev.deadline,
        report_deadline: (r.data && (r.data.report_deadline || r.data.deadline)) || prev.report_deadline,
        memoire_deadline: (r.data && r.data.memoire_deadline) || prev.memoire_deadline,
        documents: Array.isArray(r.data && r.data.documents) ? r.data.documents : prev.documents
      }));
      setFiles((prev) => ({ ...prev, [kind]: null }));
      const inputId = kind === 'report' ? 'report-file' : 'memoire-file';
      const fileInput = document.getElementById(inputId);
      if (fileInput) fileInput.value = '';
      alert('File uploaded');
    } catch (e) {
      alert((e && e.message) || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [kind]: false }));
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        report_url: data.report_url,
        memoire_url: data.memoire_url,
        status: currentStatus
      };
      const r = await setReport({ email, ...payload });
      if (!r.ok) {
        alert((r.data && r.data.errors && r.data.errors[0]) || 'Save failed');
        return;
      }
      alert('Saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-report-shell">
      <header className="student-report-head">
        <h2 className="title student-report-title">Documents</h2>
        <p className="student-report-subtitle">
          Upload your report and thesis in one place. You can also keep direct document links.
        </p>
      </header>

      <div className="student-report-meta">
        <div className="student-report-meta-card">
          <div className="student-report-meta-label">Submission status</div>
          <span className={'status-pill ' + (currentStatus === 'submitted' ? 'ok' : '')}>
            {currentStatus === 'submitted' ? 'Submitted' : 'Not submitted'}
          </span>
        </div>
        <div className="student-report-meta-card">
          <div className="student-report-meta-label">Report deadline</div>
          <div className="student-report-deadline">{data.report_deadline || data.deadline || 'Set by administration'}</div>
        </div>
        <div className="student-report-meta-card">
          <div className="student-report-meta-label">Thesis deadline</div>
          <div className="student-report-deadline">{data.memoire_deadline || 'Set by administration'}</div>
        </div>
      </div>

      <div className="student-report-grid">
        <article className="student-doc-card">
          <header className="student-doc-card-head">
            <h3 className="student-doc-card-title">Report document</h3>
            {data.report_url ? (
              <a className="student-doc-open" href={data.report_url} target="_blank" rel="noreferrer">
                Open current
              </a>
            ) : (
              <span className="student-doc-empty">No file yet</span>
            )}
          </header>

          <label className="student-doc-label" htmlFor="report-url">
            Document link
          </label>
          <input
            id="report-url"
            className="student-doc-input"
            value={data.report_url || ''}
            placeholder="https://..."
            onChange={(e) => onUrlChange('report', e.target.value)}
          />

          <label className="student-doc-label" htmlFor="report-file">
            Upload file
          </label>
          <div className="student-doc-upload-row">
            <input
              id="report-file"
              className="student-doc-file"
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              onChange={(e) => onPickFile('report', e.target.files && e.target.files[0])}
            />
            <button className="btn" type="button" onClick={() => onUploadFile('report')} disabled={uploading.report}>
              {uploading.report ? 'Uploading...' : 'Upload report'}
            </button>
          </div>
          <p className="student-doc-helper">Accepted: PDF, DOC, DOCX, ODT (max 15 MB).</p>
          {files.report ? <p className="student-doc-picked">Selected: {files.report.name}</p> : null}
        </article>

        <article className="student-doc-card">
          <header className="student-doc-card-head">
            <h3 className="student-doc-card-title">Thesis document</h3>
            {data.memoire_url ? (
              <a className="student-doc-open" href={data.memoire_url} target="_blank" rel="noreferrer">
                Open current
              </a>
            ) : (
              <span className="student-doc-empty">No file yet</span>
            )}
          </header>

          <label className="student-doc-label" htmlFor="memoire-url">
            Document link
          </label>
          <input
            id="memoire-url"
            className="student-doc-input"
            value={data.memoire_url || ''}
            placeholder="https://..."
            onChange={(e) => onUrlChange('memoire', e.target.value)}
          />

          <label className="student-doc-label" htmlFor="memoire-file">
            Upload file
          </label>
          <div className="student-doc-upload-row">
            <input
              id="memoire-file"
              className="student-doc-file"
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              onChange={(e) => onPickFile('memoire', e.target.files && e.target.files[0])}
            />
            <button className="btn" type="button" onClick={() => onUploadFile('memoire')} disabled={uploading.memoire}>
              {uploading.memoire ? 'Uploading...' : 'Upload thesis'}
            </button>
          </div>
          <p className="student-doc-helper">Accepted: PDF, DOC, DOCX, ODT (max 15 MB).</p>
          {files.memoire ? <p className="student-doc-picked">Selected: {files.memoire.name}</p> : null}
        </article>
      </div>

      {!!data.documents.length && (
        <section className="student-doc-card" style={{ marginTop: 18 }}>
          <header className="student-doc-card-head">
            <h3 className="student-doc-card-title">Stored document records</h3>
            <span className="student-doc-empty">{data.documents.length} item(s)</span>
          </header>
          <div style={{ display: 'grid', gap: 10 }}>
            {data.documents.map((doc) => (
              <div key={doc.id || `${doc.type}-${doc.file_path}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{doc.title || doc.type || 'Document'}</strong>
                  <p className="student-doc-helper" style={{ margin: '4px 0 0' }}>
                    {doc.status || 'stored'}
                    {doc.upload_date ? ` - ${new Date(Number(doc.upload_date)).toLocaleString()}` : ''}
                  </p>
                </div>
                <a className="student-doc-open" href={doc.file_path} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="student-report-footer">
        <button className="primary" type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}
