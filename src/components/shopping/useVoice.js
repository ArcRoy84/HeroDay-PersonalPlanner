// Web Speech API wrapper for dictating shopping items.
import { useState, useCallback, useRef } from 'react';

const VOICE_ERROR_MSGS = {
  'not-allowed':         'Microphone access denied. Allow it in browser settings.',
  'audio-capture':       'No microphone found on this device.',
  'network':             'Network error — speech service unavailable.',
  'no-speech':           'No speech detected. Try speaking closer to the mic.',
  'service-not-allowed': 'Speech service blocked. Open the app over HTTPS.',
  'aborted':             null, // user cancelled — no message needed
};

function useVoice(onResult, onError) {
  const [listening, setListening] = useState(false);
  const [interim,   setInterim]   = useState('');
  const recRef = useRef(null);
  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported) { onError?.('Voice input is not supported in this browser.'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    r.onstart  = () => setListening(true);
    r.onend    = () => { setListening(false); setInterim(''); };
    r.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInterim(t);
      if (e.results[e.results.length - 1].isFinal) { onResult(t); setInterim(''); }
    };
    r.onerror = (e) => {
      setListening(false);
      setInterim('');
      const msg = VOICE_ERROR_MSGS[e.error];
      if (msg) onError?.(msg);
    };
    recRef.current = r;
    r.start();
  }, [supported, onResult, onError]);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { listening, interim, start, stop, supported };
}

export { useVoice, VOICE_ERROR_MSGS };
