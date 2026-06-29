import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSpeechRecognition — Cross-browser Web Speech API wrapper.
 *
 * Returns:
 *   orbState: 'idle' | 'listening' | 'processing' | 'error'
 *   transcript: string (live accumulating text)
 *   interimText: string (unstable mid-word partial)
 *   isSupported: boolean
 *   permissionState: 'unknown' | 'granted' | 'denied' | 'prompt'
 *   errorMessage: string | null
 *   startListening()
 *   stopListening()
 *   resetTranscript()
 */
export function useSpeechRecognition({ 
  onTranscriptUpdate, 
  onFinalResult, 
  onSilence,
  silenceTimeoutMs = 2500 
} = {}) {
  const [orbState, setOrbState]       = useState('idle');
  const [transcript, setTranscript]   = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [permissionState, setPermState] = useState('unknown');

  const recognitionRef = useRef(null);
  const accumulatedRef = useRef(''); // stable across re-renders
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);

  // Feature detection
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSupported = Boolean(SpeechRecognition);

  // Query microphone permission on mount
  useEffect(() => {
    if (!isSupported) return;
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' })
      .then(result => {
        setPermState(result.state);
        result.onchange = () => setPermState(result.state);
      })
      .catch(() => setPermState('unknown'));
  }, [isSupported]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setOrbState('processing'); // Briefly show processing before idle
    setTimeout(() => setOrbState('idle'), 800);
  }, [clearSilenceTimer]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (isListeningRef.current && onSilence) {
      silenceTimerRef.current = setTimeout(() => {
        // Silence threshold hit
        stopListening();
        onSilence();
      }, silenceTimeoutMs);
    }
  }, [clearSilenceTimer, isListeningRef, stopListening, onSilence, silenceTimeoutMs]);

  const buildRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous      = true;  // Keep listening until explicitly stopped
    rec.interimResults  = true;  // Stream partial results
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setOrbState('listening');
      setErrorMessage(null);
      isListeningRef.current = true;
      resetSilenceTimer();
    };

    rec.onresult = (event) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalChunk) {
        // Append final text to the accumulated transcript
        accumulatedRef.current += finalChunk;
        const newTranscript = accumulatedRef.current;
        setTranscript(newTranscript);
        setInterimText('');
        onTranscriptUpdate?.(newTranscript);
      }
      if (interim) {
        setInterimText(interim);
      }
      
      // Reset the silence timer since we heard something
      resetSilenceTimer();
    };

    rec.onerror = (event) => {
      isListeningRef.current = false;
      clearSilenceTimer();
      const msgMap = {
        'not-allowed':      'Microphone access was denied. Please allow microphone access in your browser settings.',
        'no-speech':        'No speech detected. Please speak clearly and try again.',
        'audio-capture':    'No microphone found. Please connect a microphone and try again.',
        'network':          'Network error during recognition. Please check your connection.',
        'aborted':          null, // User-triggered stop — not an error
        'service-not-allowed': 'Speech service is not available on this page.',
      };
      const msg = msgMap[event.error];
      if (event.error !== 'aborted') {
        setOrbState('error');
        setErrorMessage(msg || `Recognition error: ${event.error}`);
        if (event.error === 'not-allowed') setPermState('denied');
      }
    };

    rec.onend = () => {
      // If we're still supposed to be listening (e.g. brief silence), restart
      if (isListeningRef.current) {
        try {
          rec.start();
        } catch (_) {
          // Already started — ignore
        }
      } else {
        setOrbState('idle');
        setInterimText('');
        clearSilenceTimer();
        // Signal final result to parent
        if (accumulatedRef.current) {
          onFinalResult?.(accumulatedRef.current);
        }
      }
    };

    return rec;
  }, [SpeechRecognition, onTranscriptUpdate, onFinalResult, resetSilenceTimer, clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    if (isListeningRef.current) return;

    setErrorMessage(null);
    accumulatedRef.current = '';
    setTranscript('');
    setInterimText('');

    try {
      const rec = buildRecognition();
      recognitionRef.current = rec;
      rec.start();
      // onstart will fire and set orbState → 'listening'
    } catch (err) {
      setOrbState('error');
      setErrorMessage('Could not start microphone. Please try again.');
    }
  }, [isSupported, buildRecognition]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = '';
    setTranscript('');
    setInterimText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      clearSilenceTimer();
      recognitionRef.current?.stop();
    };
  }, [clearSilenceTimer]);

  return {
    orbState,
    transcript,
    interimText,
    isSupported,
    permissionState,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
    setOrbState,  // Allow external override (e.g., for processing state)
  };
}
