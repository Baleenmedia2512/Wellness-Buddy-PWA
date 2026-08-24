/**
 * Web Speech API wrapper for multi-food voice insert.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseVoiceFoodNames } from '../domain/parseVoiceFoodNames';

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * @param {{
 *   onNames?: (names: string[], transcript: string) => void | Promise<void>,
 *   onUnsupported?: () => void,
 *   lang?: string,
 * }} [options]
 */
export default function useFoodVoiceInput(options = {}) {
  const { onNames, onUnsupported, lang = 'en-IN' } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef(null);
  const onNamesRef = useRef(onNames);
  const onUnsupportedRef = useRef(onUnsupported);

  useEffect(() => {
    onNamesRef.current = onNames;
  }, [onNames]);

  useEffect(() => {
    onUnsupportedRef.current = onUnsupported;
  }, [onUnsupported]);

  const supported = Boolean(getSpeechRecognitionCtor());

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore stop errors
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('voice_unsupported');
      setStatus('Voice not available');
      onUnsupportedRef.current?.();
      return;
    }

    setError(null);
    setStatus('Listening…');
    stop();

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onerror = (event) => {
      const code = event?.error || 'voice_error';
      setError(code);
      setListening(false);
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setStatus('Microphone permission denied');
      } else if (code === 'no-speech') {
        setStatus('No speech detected');
      } else {
        setStatus('Voice not available');
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      const result = event?.results?.[0]?.[0];
      const transcript = String(result?.transcript || '').trim();
      const names = parseVoiceFoodNames(transcript);
      if (names.length === 0) {
        setStatus(transcript ? 'No food names found' : 'No speech detected');
        return;
      }
      setStatus(`Adding ${names.join(', ')}…`);
      Promise.resolve(onNamesRef.current?.(names, transcript)).catch(() => {
        setStatus('Could not add foods');
      });
    };

    try {
      recognition.start();
    } catch (err) {
      setError(err?.message || 'voice_start_failed');
      setListening(false);
      setStatus('Voice not available');
      onUnsupportedRef.current?.();
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return {
    supported,
    listening,
    error,
    status,
    setStatus,
    start,
    stop,
    toggle,
  };
}
