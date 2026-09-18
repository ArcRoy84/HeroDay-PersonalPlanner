import React, { useState, useRef, useEffect } from 'react';
import {
  exportToJSON, backupFilename, importFromJSON,
  countLegacyKeys, clearLegacyStorage, InvalidBackupError,
} from '../db/backup';

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1v8" /><polyline points="4 6.5 7 9.5 10 6.5" /><path d="M1.5 11.5h11" />
  </svg>
);

const IconUpload = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 9.5v-8" /><polyline points="4 4.5 7 1.5 10 4.5" /><path d="M1.5 11.5h11" />
  </svg>
);

/** Triggers a browser download for `text` without leaving the page. */
function downloadFile(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export, import and legacy-storage cleanup.
 *
 * Import replaces everything, so it asks for confirmation first and points the
 * user at the export button — the one irreversible action in the app.
 */
export default function DataSection() {
  const [status, setStatus] = useState(null); // { kind: 'ok' | 'error', text }
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => { setLegacyCount(countLegacyKeys()); }, []);

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const text = await exportToJSON();
      downloadFile(text, backupFilename());
      setStatus({ kind: 'ok', text: 'Backup downloaded.' });
    } catch (error) {
      setStatus({ kind: 'error', text: `Export failed: ${error.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleFilePicked = (event) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;
    setStatus(null);
    setPendingFile(file);
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const text = await pendingFile.text();
      const result = await importFromJSON(text, 'replace');
      setStatus({ kind: 'ok', text: `Restored ${result.total} record${result.total === 1 ? '' : 's'}.` });
      setPendingFile(null);
    } catch (error) {
      const text = error instanceof InvalidBackupError
        ? error.message
        : `Import failed: ${error.message}`;
      setStatus({ kind: 'error', text });
      setPendingFile(null);
    } finally {
      setBusy(false);
    }
  };

  const handleClearLegacy = () => {
    const removed = clearLegacyStorage();
    setLegacyCount(countLegacyKeys());
    setStatus({ kind: 'ok', text: `Removed ${removed} old storage key${removed === 1 ? '' : 's'}.` });
  };

  return (
    <section>
      <div className="settings-section-title">Your Data</div>

      <p className="data-hint">
        Everything is stored on this device. Export a backup before clearing your
        browser data or moving to another machine.
      </p>

      <div className="data-actions">
        <button className="data-btn" onClick={handleExport} disabled={busy}>
          <IconDownload />
          Export backup
        </button>
        <button className="data-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <IconUpload />
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFilePicked}
          hidden
        />
      </div>

      {pendingFile && (
        <div className="data-confirm">
          <p className="data-confirm-text">
            Restore from <strong>{pendingFile.name}</strong>? This replaces
            everything currently in HeroDay and cannot be undone.
          </p>
          <div className="data-confirm-actions">
            <button className="btn-ghost sm" onClick={() => setPendingFile(null)} disabled={busy}>
              Cancel
            </button>
            <button className="data-btn data-btn-danger" onClick={confirmImport} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace my data'}
            </button>
          </div>
        </div>
      )}

      {status && (
        <p className={`data-status ${status.kind === 'error' ? 'data-status-error' : ''}`}>
          {status.text}
        </p>
      )}

      {legacyCount > 0 && (
        <div className="data-legacy">
          <p className="data-hint">
            {legacyCount} key{legacyCount === 1 ? '' : 's'} from the old storage
            format {legacyCount === 1 ? 'is' : 'are'} still taking up space. Your
            data has already been moved, so these are safe to remove — export a
            backup first if you want to be certain.
          </p>
          <button className="btn-ghost sm" onClick={handleClearLegacy} disabled={busy}>
            Remove old storage
          </button>
        </div>
      )}
    </section>
  );
}
