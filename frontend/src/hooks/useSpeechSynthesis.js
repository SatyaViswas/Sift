import { useCallback, useRef } from 'react';

/**
 * useSpeechSynthesis — Native browser TTS wrapper.
 *
 * Provides speak() and cancel() using window.speechSynthesis.
 * Selects a warm, natural-sounding voice (prefers female en-US voices).
 */
export function useSpeechSynthesis() {
  const utteranceRef = useRef(null);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /**
   * Pick the most natural-feeling voice available.
   * Priority: non-default en-US female → any en-US → first available.
   */
  const selectVoice = useCallback(() => {
    if (!isSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Preferred voice names (Chrome, Safari, Firefox)
    const preferred = [
      'Samantha',   // macOS/Safari — warm, natural
      'Karen',      // macOS Australian
      'Moira',      // macOS Irish
      'Google US English',
      'Microsoft Aria Online (Natural)',
      'Microsoft Jenny Online (Natural)',
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) return match;
    }

    // Fallback: first en-US voice
    const enUs = voices.find(v => v.lang.startsWith('en') && !v.default);
    return enUs || voices[0];
  }, [isSupported]);

  /**
   * Speak text aloud with comforting, measured pace.
   * @param {string} text - Text to read aloud
   * @param {{ onEnd?: () => void, onError?: () => void }} callbacks
   */
  const speak = useCallback((text, { onEnd, onError } = {}) => {
    if (!isSupported || !text) return;

    // Cancel anything currently playing
    window.speechSynthesis.cancel();

    // Voices may not be loaded yet — wait if needed
    const trySpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice  = selectVoice();
      utterance.rate   = 0.92;   // Slightly slower = more comforting
      utterance.pitch  = 1.05;   // Slightly warmer
      utterance.volume = 0.95;

      utterance.onend   = onEnd || null;
      utterance.onerror = (e) => {
        // 'interrupted' is normal when cancelled — not a real error
        if (e.error !== 'interrupted') onError?.();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    // Chrome bug: voices are async; retry if empty
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        trySpeak();
      };
    } else {
      trySpeak();
    }
  }, [isSupported, selectVoice]);

  const cancel = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel();
  }, [isSupported]);

  const isSpeaking = useCallback(() => {
    return isSupported ? window.speechSynthesis.speaking : false;
  }, [isSupported]);

  return { speak, cancel, isSpeaking, isSupported };
}
