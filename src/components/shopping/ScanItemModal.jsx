// Barcode scanning via the BarcodeDetector API, with a camera preview.
import React, { useState, useEffect, useRef } from 'react';
import { IconX, IconCheck } from './icons.jsx';

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

function ScanItemModal({ onCode, onClose }) {
  const [manualCode,  setManualCode]  = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [feed,        setFeed]        = useState([]);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const lastRef   = useRef({ code: '', at: 0 });

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  function handleCode(code) {
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < 2500) return; // debounce repeat frames
    lastRef.current = { code, at: now };
    const result = onCode(code);
    if (!result?.found) { onClose(); return; }
    setFeed(f => [{ code, name: result.name }, ...f].slice(0, 6));
  }

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });

    async function loop() {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length) handleCode(codes[0].rawValue);
      } catch { /* transient decode error — keep scanning */ }
      rafRef.current = requestAnimationFrame(loop);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        loop();
      } catch {
        setCameraError('Camera access unavailable — enter the code manually below.');
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitManual() {
    const code = manualCode.trim();
    if (!code) return;
    handleCode(code);
    setManualCode('');
  }

  return (
    <div className="shop-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="shop-dialog scan-dialog">
        <div className="shop-dialog-header">
          <h4 className="shop-dialog-title">Scan Item</h4>
          <button className="sic-act" onClick={onClose}><IconX /></button>
        </div>

        {supported ? (
          <div className="scan-video-wrap">
            <video ref={videoRef} className="scan-video" muted playsInline />
            <div className="scan-reticle" />
            {!scanning && !cameraError && <div className="scan-video-hint">Starting camera…</div>}
          </div>
        ) : (
          <p className="scan-unsupported">
            Live camera scanning isn't supported in this browser — enter the barcode below instead.
          </p>
        )}
        {cameraError && <p className="field-error">{cameraError}</p>}

        <div className="shop-field">
          <label className="shop-field-label">Or enter the code manually</label>
          <div className="scan-manual-row">
            <input className="form-input" placeholder="e.g. 041631234567" value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManual()} autoFocus={!supported} />
            <button className="btn-primary sm" onClick={submitManual} disabled={!manualCode.trim()}>Look Up</button>
          </div>
        </div>

        {feed.length > 0 && (
          <div className="scan-feed">
            {feed.map((f, i) => (
              <div key={i} className="scan-feed-row">
                <span className="scan-feed-icon"><IconCheck /></span>
                <span className="scan-feed-text">Added <strong>{f.name}</strong></span>
              </div>
            ))}
          </div>
        )}

        <div className="shop-dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

export { ScanItemModal };
