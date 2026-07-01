import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import MicOrb from '../../MicOrb/MicOrb';
import MemorySafeguardModal from '../../MemorySafeguardModal/MemorySafeguardModal';
import { useMemory } from '../../../context/MemoryContext';
import './OracleSection.css';

/**
 * OracleSection — Phase 6: Choice Shield UI & API Integration.
 * 
 * Ambient conversational question terminal.
 * Parses { data: { food, activity, reason } } into a Choice Shield.
 */

export default function OracleSection() {
  const [query, setQuery] = useState('');
  const [safeguardTopic, setSafeguardTopic] = useState(null);
  const inputRef = useRef(null);

  const { oracleCardsStream, isOracleThinking, sendOracleQuery, submitOracleFeedback, clearOracleChat } = useMemory();

  const QUICK_PROMPTS = [
    "I am fried, what should I do?",
    "What patterns have you noticed?",
    "Help me make a decision",
    "What did I learn this week?",
  ];

  /* ── Speech recognition ───────────────────────────────── */
  const {
    orbState,
    interimText,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onTranscriptUpdate: (text) => {
      setQuery(text);
    },
    onFinalResult: (text) => {
      // Auto-send when voice stops
      if (text.trim()) {
        sendQuery(text);
      }
    }
  });

  const handleOrbClick = useCallback(() => {
    if (orbState === 'listening') {
      stopListening();
    } else if (orbState === 'idle' || orbState === 'error') {
      resetTranscript();
      startListening();
    }
  }, [orbState, startListening, stopListening, resetTranscript]);


  const sendQuery = useCallback(async (text) => {
    const q = (text || query).trim();
    if (!q || isOracleThinking) return;
    
    // If voice is still running, stop it gracefully
    if (orbState === 'listening') stopListening();

    setQuery('');
    resetTranscript();

    await sendOracleQuery(q);
  }, [query, isOracleThinking, orbState, stopListening, resetTranscript, sendOracleQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Auto-scroll to bottom of chat when messages change
  const feedRef = useRef(null);
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [oracleCardsStream, isOracleThinking, interimText]);

  // Combine query and interim text for live preview
  const displayValue = orbState === 'listening' && interimText ? query + interimText : query;

  return (
    <section className="oracle-section" aria-label="The Oracle — Cognitive Recovery Assistant">

      {/* ── Section Header ── */}
      <div className="oracle-section__header">
        <div>
          <h1 className="oracle-section__title">The Oracle</h1>
          <p className="oracle-section__subtitle">Ask, and it remembers for you</p>
        </div>
        <div className="oracle-section__header-actions">
          {oracleCardsStream.length > 0 && (
            <button 
              className="oracle-section__clear-btn" 
              onClick={clearOracleChat}
              aria-label="Clear chat"
            >
              Clear Chat
            </button>
          )}
          <div className="oracle-section__orb-mini" aria-hidden="true">
            <div className={`oracle-orb-mini ${isOracleThinking ? 'oracle-orb-mini--thinking' : ''}`} />
          </div>
        </div>
      </div>

      {/* ── Chat Feed ── */}
      <div className="oracle-feed" ref={feedRef} aria-label="Oracle conversation" aria-live="polite">
        {oracleCardsStream.length === 0 ? (
          <div className="oracle-feed__empty">
            <div className="oracle-feed__empty-glyph" aria-hidden="true">
              <div className="oracle-glyph" />
            </div>
            <p className="oracle-feed__empty-title">Your cognitive mirror</p>
            <p className="oracle-feed__empty-body">
              Ask anything about your patterns, decisions, or thoughts.
              The Oracle surfaces what you've already written.
            </p>

            {/* Quick-start prompts */}
            <div className="oracle-quick-prompts" role="list" aria-label="Suggested questions">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  id={`oracle-quick-${i}`}
                  className="oracle-quick-prompt"
                  role="listitem"
                  onClick={() => sendQuery(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="oracle-messages">
            {oracleCardsStream.map(card => (
              <div key={card.id} className="oracle-card-pair">
                {/* User Query Bubble */}
                <div className="oracle-message oracle-message--user">
                  <div className="oracle-message__bubble">
                    <p className="oracle-message__text">{card.query}</p>
                    <div className="oracle-message__footer">
                      <time className="oracle-message__time" dateTime={card.timestamp}>
                        {formatTime(card.timestamp)}
                      </time>
                    </div>
                  </div>
                </div>

                {/* Oracle Response Card / Bubble */}
                {card.answer ? (
                  <div className={`oracle-message oracle-message--oracle ${card.answer.isError ? 'oracle-message--error' : ''} ${card.type === 'choice_shield' ? 'oracle-message--shield' : ''}`}>
                    <div className="oracle-message__avatar" aria-hidden="true">
                      <div className="oracle-message__avatar-dot" />
                    </div>
                    
                    {card.type === 'choice_shield' ? (
                      /* ── Choice Shield Layout ── */
                      <div className={`choice-shield choice-shield--${card.answer.type || 'general'} ${card.feedbackStatus ? `choice-shield--${card.feedbackStatus}` : ''} ${card.syncState === 'calibrated' ? 'choice-shield--success' : ''}`}>
                        {card.syncState === 'calibrated' && (
                           <div key={card.feedbackStatus} className="choice-shield__success-indicator">
                             <span>Ontology Aligned</span>
                           </div>
                        )}
                        <div className="choice-shield__header">
                          <span className="choice-shield__label">{card.answer.type || 'General'} Insight</span>
                          <h3 className="choice-shield__headline">{card.answer.headline}</h3>
                        </div>
                        <div className="choice-shield__body">
                          <p className="choice-shield__recommendation">{card.answer.recommendation}</p>
                        </div>
                        <div className="choice-shield__footer">
                          <p className="choice-shield__rationale">{card.answer.rationale}</p>
                          
                          <div className="choice-shield__actions">
                            <div className="choice-shield__feedback">
                              <button 
                                className={`choice-shield__btn-feedback ${card.feedbackStatus === 'helpful' ? 'choice-shield__btn-feedback--active' : (card.feedbackStatus ? 'choice-shield__btn-feedback--inactive' : '')} ${card.syncState === 'processing' && card.feedbackStatus === 'helpful' ? 'choice-shield__btn-feedback--calibrating' : ''}`}
                                onClick={() => submitOracleFeedback(card.id, true, card.lookupToken)}
                                disabled={card.syncState === 'processing'}
                                aria-label="Helpful"
                              >
                                {card.syncState === 'processing' && card.feedbackStatus === 'helpful' ? <div className="feedback-spinner feedback-spinner--ink-drop" /> : '👍'}
                              </button>
                              <button 
                                className={`choice-shield__btn-feedback ${card.feedbackStatus === 'unhelpful' ? 'choice-shield__btn-feedback--active' : (card.feedbackStatus ? 'choice-shield__btn-feedback--inactive' : '')} ${card.syncState === 'processing' && card.feedbackStatus === 'unhelpful' ? 'choice-shield__btn-feedback--calibrating' : ''}`}
                                onClick={() => submitOracleFeedback(card.id, false, card.lookupToken)}
                                disabled={card.syncState === 'processing'}
                                aria-label="Not helpful"
                              >
                                {card.syncState === 'processing' && card.feedbackStatus === 'unhelpful' ? <div className="feedback-spinner feedback-spinner--ink-drop" /> : '👎'}
                              </button>
                            </div>
                            
                            {/* Conditional Guardrail for Prune Memory */}
                            <div className={`choice-shield__prune-container ${card.feedbackStatus && card.syncState === 'calibrated' ? 'choice-shield__prune-container--revealed' : ''}`}>
                                <button 
                                  className="choice-shield__btn-prune"
                                  onClick={() => setSafeguardTopic(card.answer.headline)}
                                >
                                  Prune Memory
                                </button>
                            </div>
                          </div>

                          <time className="oracle-message__time" dateTime={card.timestamp}>
                            {formatTime(card.timestamp)}
                          </time>
                        </div>
                      </div>
                    ) : (
                      /* ── Standard Text Bubble ── */
                      <div className="oracle-message__bubble">
                        <p className="oracle-message__text">{card.answer.text}</p>
                        <div className="oracle-message__footer">
                          <time className="oracle-message__time" dateTime={card.timestamp}>
                            {formatTime(card.timestamp)}
                          </time>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                   /* ── Thinking / Pending State for this specific query ── */
                   <div className="oracle-message oracle-message--oracle" aria-label="Oracle is thinking">
                     <div className="oracle-message__avatar" aria-hidden="true">
                       <div className="oracle-message__avatar-dot oracle-message__avatar-dot--thinking" />
                     </div>
                     <div className="oracle-message__bubble oracle-message__bubble--thinking">
                       <div className="oracle-wave-loader" aria-hidden="true">
                         <div className="oracle-wave-loader__bar" />
                         <div className="oracle-wave-loader__bar" />
                         <div className="oracle-wave-loader__bar" />
                         <div className="oracle-wave-loader__bar" />
                       </div>
                     </div>
                   </div>
                )}
              </div>
            ))}

            {/* Voice Interim Display in Chat Feed */}
            {orbState === 'listening' && interimText && (
               <div className="oracle-card-pair">
                 <div className="oracle-message oracle-message--user oracle-message--interim">
                   <div className="oracle-message__bubble">
                     <p className="oracle-message__text">{query} <span className="oracle-interim-text">...{interimText}</span></p>
                   </div>
                 </div>
               </div>
            )}
          </div>
        )}
      </div>

      {/* ── Query Input Bar ── */}
      <div className="oracle-input-zone">
        <div className={`oracle-input-bar ${isOracleThinking ? 'oracle-input-bar--loading' : ''} ${orbState === 'listening' ? 'oracle-input-bar--voice' : ''}`}>
          
          <div className="oracle-input-bar__mic-wrapper">
             <MicOrb
              orbState={orbState}
              isSupported={isSupported}
              onClick={handleOrbClick}
              disabled={isOracleThinking}
              hideHint={true}
             />
          </div>

          <input
            ref={inputRef}
            type="text"
            id="oracle-query-input"
            className="oracle-input-bar__field"
            value={displayValue}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={orbState === 'listening' ? 'Listening...' : 'Ask the Oracle anything…'}
            aria-label="Oracle query"
            disabled={isOracleThinking}
            autoComplete="off"
          />
          <button
            id="oracle-send-btn"
            className="oracle-input-bar__send"
            onClick={() => sendQuery()}
            disabled={(!query.trim() && !interimText.trim()) || isOracleThinking}
            aria-label="Send query to Oracle"
          >
            {isOracleThinking ? (
              <div className="oracle-input-bar__spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
        <p className="oracle-input-zone__hint">Backed by your journal memories</p>
      </div>

      {safeguardTopic && (
        <MemorySafeguardModal 
          topic={safeguardTopic} 
          onClose={() => setSafeguardTopic(null)} 
          onForgotten={() => {
            setSafeguardTopic(null);
            // Optional: visually remove the message or show a toast
          }} 
        />
      )}

    </section>
  );
}
