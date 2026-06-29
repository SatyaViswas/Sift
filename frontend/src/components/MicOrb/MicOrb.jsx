import './MicOrb.css';

/**
 * MicOrb — The premium interactive microphone orb.
 *
 * Props:
 *   orbState: 'idle' | 'listening' | 'processing' | 'error' | 'speaking'
 *   isSupported: boolean — whether Web Speech API is available
 *   onClick: () => void — toggle listening on/off
 *   disabled: boolean
 */
export default function MicOrb({ orbState = 'idle', isSupported = true, onClick, disabled = false, hideHint = false }) {
  const label = {
    idle:       'Tap to start voice input',
    listening:  'Tap to stop recording',
    processing: 'Processing your entry…',
    error:      'Voice input error — tap to retry',
    speaking:   'Speaking your insight…',
  }[orbState] || 'Microphone';

  const hint = {
    idle:       'Hold to speak',
    listening:  'Listening…',
    processing: 'Processing…',
    error:      'Try again',
    speaking:   'Reading back…',
  }[orbState];

  return (
    <div className="mic-orb-container">
      {/* Ambient outer ring — only visible when active */}
      {orbState === 'listening' && (
        <>
          <span className="mic-orb__ring mic-orb__ring--1" aria-hidden="true" />
          <span className="mic-orb__ring mic-orb__ring--2" aria-hidden="true" />
        </>
      )}

      <button
        id="slate-orb"
        className={`mic-orb mic-orb--${orbState}`}
        data-orb-state={orbState}
        onClick={onClick}
        disabled={disabled || !isSupported || orbState === 'processing'}
        aria-label={label}
        aria-pressed={orbState === 'listening'}
        title={!isSupported ? 'Voice input is not supported in this browser' : label}
      >
        {/* Microphone Icon — idle & listening */}
        {(orbState === 'idle' || orbState === 'listening') && (
          <svg
            className="mic-orb__icon"
            viewBox="0 0 24 24"
            fill="none"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <path
              d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill={orbState === 'listening' ? 'currentColor' : 'none'}
              fillOpacity={orbState === 'listening' ? 0.15 : 0}
            />
            <path
              d="M19 10v2a7 7 0 0 1-14 0v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="8"  y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}

        {/* Spinner dots — processing */}
        {orbState === 'processing' && (
          <span className="mic-orb__dots" aria-label="Processing">
            <span /><span /><span />
          </span>
        )}

        {/* Waveform bars — speaking */}
        {orbState === 'speaking' && (
          <span className="mic-orb__wave" aria-label="Speaking">
            <span /><span /><span /><span /><span />
          </span>
        )}

        {/* Error X — error */}
        {orbState === 'error' && (
          <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {!hideHint && <p className="mic-orb__hint" aria-live="polite">{hint}</p>}

      {!isSupported && (
        <p className="mic-orb__unsupported" role="alert">
          Voice input unavailable in this browser.
          <br />Use Chrome or Safari for best results.
        </p>
      )}
    </div>
  );
}
