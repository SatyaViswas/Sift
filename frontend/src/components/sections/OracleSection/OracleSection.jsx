import { useState, useCallback, useRef, useEffect } from 'react';
import { recoverMemory } from '../../../utils/api';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import MicOrb from '../../MicOrb/MicOrb';
import './OracleSection.css';

/**
 * OracleSection — Phase 6: Choice Shield UI & API Integration.
 * 
 * Ambient conversational question terminal.
 * Parses { data: { food, activity, reason } } into a Choice Shield.
 */
const ORACLE_CACHE_KEY = 'sift_oracle_chat_default_user';

export default function OracleSection() {
  const [query, setQuery]         = useState('');
  const [messages, setMessages]   = useState(() => {
    try {
      const cached = localStorage.getItem(ORACLE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only restore messages from the current calendar day
        if (parsed.date === new Date().toLocaleDateString()) {
          return parsed.messages;
        }
      }
    } catch (e) {
      console.error('Failed to parse cached Oracle chat:', e);
    }
    return [];
  });
  const [isThinking, setThinking] = useState(false);
  const inputRef = useRef(null);

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

  // Phase 7: State Retention - Sync messages to localStorage for the current day
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(ORACLE_CACHE_KEY, JSON.stringify({
        date: new Date().toLocaleDateString(),
        messages: messages
      }));
    }
  }, [messages]);


  const sendQuery = useCallback(async (text) => {
    const q = (text || query).trim();
    if (!q || isThinking) return;
    
    // If voice is still running, stop it gracefully
    if (orbState === 'listening') stopListening();

    setQuery('');
    resetTranscript();

    const userMsg = { id: Date.now(), role: 'user', text: q, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    try {
      // Phase 6: Call the backend endpoint
      const result = await recoverMemory({ question: q });
      
      const oracleMsg = {
        id: Date.now() + 1,
        role: 'oracle',
        timestamp: new Date().toISOString(),
      };

      // Check if response matches the Schema { data: { type, headline, recommendation, rationale } }
      if (result.status === 'success' && result.data && result.data.headline && result.data.recommendation) {
        oracleMsg.type = 'choice_shield';
        oracleMsg.data = result.data;
      } else {
        // Fallback to raw text or error message
        oracleMsg.type = 'text';
        oracleMsg.text = result.message || (result.data ? JSON.stringify(result.data) : 'I processed your thoughts, but the response was unclear.');
      }
      
      setMessages(prev => [...prev, oracleMsg]);
    } catch (err) {
      console.error('Oracle failed:', err);
      // Determine if it's the 404 DatasetNotFoundError
      const is404 = err.message && err.message.includes('404');
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'oracle',
          type: 'text',
          text: is404 
            ? "I don't have enough memories in the graph yet. Keep journaling in The Slate, and I will build your cognitive map." 
            : "I couldn't reach my memory banks right now. The backend may be offline.",
          timestamp: new Date().toISOString(),
          isError: true,
        }
      ]);
    } finally {
      setThinking(false);
    }
  }, [query, isThinking, orbState, stopListening, resetTranscript]);

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
  }, [messages, isThinking, interimText]);

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
        <div className="oracle-section__orb-mini" aria-hidden="true">
          <div className={`oracle-orb-mini ${isThinking ? 'oracle-orb-mini--thinking' : ''}`} />
        </div>
      </div>

      {/* ── Chat Feed ── */}
      <div className="oracle-feed" ref={feedRef} aria-label="Oracle conversation" aria-live="polite">
        {messages.length === 0 ? (
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
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`oracle-message oracle-message--${msg.role} ${msg.isError ? 'oracle-message--error' : ''} ${msg.type === 'choice_shield' ? 'oracle-message--shield' : ''}`}
              >
                {msg.role === 'oracle' && (
                  <div className="oracle-message__avatar" aria-hidden="true">
                    <div className="oracle-message__avatar-dot" />
                  </div>
                )}
                
                {msg.type === 'choice_shield' ? (
                  /* ── Choice Shield Layout ── */
                  <div className={`choice-shield choice-shield--${msg.data.type || 'general'}`}>
                    <div className="choice-shield__header">
                      <span className="choice-shield__label">{msg.data.type || 'General'} Insight</span>
                      <h3 className="choice-shield__headline">{msg.data.headline}</h3>
                    </div>
                    <div className="choice-shield__body">
                      <p className="choice-shield__recommendation">{msg.data.recommendation}</p>
                    </div>
                    <div className="choice-shield__footer">
                      <p className="choice-shield__rationale">{msg.data.rationale}</p>
                      <time className="oracle-message__time" dateTime={msg.timestamp}>
                        {formatTime(msg.timestamp)}
                      </time>
                    </div>
                  </div>
                ) : (
                  /* ── Standard Text Bubble ── */
                  <div className="oracle-message__bubble">
                    <p className="oracle-message__text">{msg.text}</p>
                    <div className="oracle-message__footer">
                      <time className="oracle-message__time" dateTime={msg.timestamp}>
                        {formatTime(msg.timestamp)}
                      </time>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Voice Interim Display in Chat Feed */}
            {orbState === 'listening' && interimText && (
               <div className="oracle-message oracle-message--user oracle-message--interim">
                 <div className="oracle-message__bubble">
                   <p className="oracle-message__text">{query} <span className="oracle-interim-text">...{interimText}</span></p>
                 </div>
               </div>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="oracle-message oracle-message--oracle" aria-label="Oracle is thinking">
                <div className="oracle-message__avatar" aria-hidden="true">
                  <div className="oracle-message__avatar-dot oracle-message__avatar-dot--thinking" />
                </div>
                <div className="oracle-message__bubble oracle-message__bubble--thinking">
                  {/* Premium Geometric Wave Loader */}
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
        )}
      </div>

      {/* ── Query Input Bar ── */}
      <div className="oracle-input-zone">
        <div className={`oracle-input-bar ${isThinking ? 'oracle-input-bar--loading' : ''} ${orbState === 'listening' ? 'oracle-input-bar--voice' : ''}`}>
          
          <div className="oracle-input-bar__mic-wrapper">
             <MicOrb
              orbState={orbState}
              isSupported={isSupported}
              onClick={handleOrbClick}
              disabled={isThinking}
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
            disabled={isThinking}
            autoComplete="off"
          />
          <button
            id="oracle-send-btn"
            className="oracle-input-bar__send"
            onClick={() => sendQuery()}
            disabled={(!query.trim() && !interimText.trim()) || isThinking}
            aria-label="Send query to Oracle"
          >
            {isThinking ? (
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

    </section>
  );
}
