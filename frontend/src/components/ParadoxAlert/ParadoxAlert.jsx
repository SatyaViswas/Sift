import { useEffect, useRef } from 'react';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import './ParadoxAlert.css';

/**
 * ParadoxAlert — Slide-up conflict warning overlay panel.
 *
 * Props:
 *   alert: { message: string, context?: string[], severity?: 'warning'|'critical' } | null
 *   onDismiss: () => void
 *   shouldSpeak: boolean — true if entry was voice-mode (reads aloud)
 */
export default function ParadoxAlert({ alert, onDismiss, shouldSpeak = false }) {
  const { speak, cancel } = useSpeechSynthesis();
  const hasSpokenRef = useRef(false);

  // Read aloud when alert appears in voice mode
  useEffect(() => {
    if (!alert || !shouldSpeak || hasSpokenRef.current) return;
    hasSpokenRef.current = true;
    const textToSpeak = `Cognitive paradox detected. ${alert.message}`;
    // Short delay feels more natural after the visual appears
    const timer = setTimeout(() => speak(textToSpeak), 600);
    return () => clearTimeout(timer);
  }, [alert, shouldSpeak, speak]);

  // Cancel speech when dismissed
  const handleDismiss = () => {
    cancel();
    hasSpokenRef.current = false;
    onDismiss?.();
  };

  // Reset spoken flag when alert changes
  useEffect(() => {
    if (!alert) {
      hasSpokenRef.current = false;
    }
  }, [alert]);

  if (!alert) return null;

  const severity = alert.severity || 'warning';

  return (
    <>
      {/* Backdrop */}
      <div
        className="paradox-backdrop"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Alert Panel */}
      <div
        className={`paradox-alert paradox-alert--${severity}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="paradox-title"
        aria-describedby="paradox-body"
      >
        {/* Header */}
        <div className="paradox-alert__header">
          <div className="paradox-alert__icon-wrap" aria-hidden="true">
            {severity === 'critical' ? (
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="17.5" r="0.8" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="15.5" r="0.8" fill="currentColor" />
              </svg>
            )}
          </div>

          <div className="paradox-alert__title-group">
            <h2 id="paradox-title" className="paradox-alert__title">
              Cognitive Paradox Detected
            </h2>
            <p className="paradox-alert__subtitle">
              Sift noticed a potential conflict in your recent entries
            </p>
          </div>

          <div className="paradox-alert__header-right">
            {/* Voice indicator */}
            {shouldSpeak && (
              <span className="paradox-alert__voice-badge" aria-label="Reading aloud">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                  <path d="M3 9h4l5-5v16l-5-5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M18 5c2.8 2.2 2.8 7.8 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M15 8c1.5 1.2 1.5 4.8 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Speaking
              </span>
            )}

            <button
              className="paradox-alert__close"
              onClick={handleDismiss}
              aria-label="Dismiss paradox alert"
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="paradox-alert__body" id="paradox-body">
          <p className="paradox-alert__message">{alert.message}</p>

          {/* Historical context trace */}
          {alert.context && alert.context.length > 0 && (
            <div className="paradox-alert__context">
              <p className="paradox-alert__context-label">Historical context:</p>
              <ul className="paradox-alert__context-list">
                {alert.context.map((item, i) => (
                  <li key={i} className="paradox-alert__context-item">
                    <span className="paradox-alert__context-bullet" aria-hidden="true">◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="paradox-alert__footer">
          <button
            id="paradox-oracle-btn"
            className="paradox-alert__cta"
            onClick={() => {
              handleDismiss();
              // Caller should navigate to Oracle — trigger via callback if needed
            }}
          >
            Explore with The Oracle
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            id="paradox-dismiss-btn"
            className="paradox-alert__dismiss"
            onClick={handleDismiss}
          >
            Acknowledge & continue
          </button>
        </div>
      </div>
    </>
  );
}
