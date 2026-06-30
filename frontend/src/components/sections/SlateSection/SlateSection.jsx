import { useState, useRef, useCallback, useEffect } from 'react';
import { ingestEntry, updateEntry } from '../../../utils/api';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import DailyPrompt from '../../DailyPrompt/DailyPrompt';
import MicOrb from '../../MicOrb/MicOrb';
import MemorySafeguardModal from '../../MemorySafeguardModal/MemorySafeguardModal';
import './SlateSection.css';

/**
 * SlateSection — Phase 2 Overhaul: Voice Sanctuary & Intelligent Audio Response.
 *
 * Features:
 *   ✓ Dual-mode compose: "Quick Snippets" (pill strip) + "Deep Diary" (full canvas)
 *   ✓ Fullscreen Voice Sanctuary overlay with glassmorphism
 *   ✓ 2.5s silence timeout threshold triggering review mode
 *   ✓ Intelligent audio response matrix (silent reset vs spoken voice feedback)
 *   ✓ Calibrated backend paradox handler
 */

const SLATE_CACHE_KEY        = 'sift_slate_draft_default_user';
const SLATE_ENTRIES_CACHE_KEY = 'sift_slate_entries_default_user';
const MAX_CHARS = 2000;

const speakFeedback = (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

/* ── Edit Modal ─────────────────────────────────────────────── */
function EditModal({ entry, onClose, onUpdated }) {
  const [editText, setEditText]       = useState(entry.text);
  const [isUpdating, setIsUpdating]   = useState(false);
  const [statusMsg, setStatusMsg]     = useState(null); // { text, isError }
  const textareaRef                   = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleUpdate = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === entry.text.trim() || isUpdating) return;

    setIsUpdating(true);
    setStatusMsg(null);

    try {
      await updateEntry({
        entryId: entry.id,
        originalText: entry.text,
        newText: trimmed,
      });
      setStatusMsg({ text: 'Memory updated ✓', isError: false });
      onUpdated(entry.id, trimmed);
      setTimeout(() => onClose(), 900);
    } catch (err) {
      console.error('Update failed:', err);
      setStatusMsg({ text: 'Update failed — please retry.', isError: true });
      setIsUpdating(false);
    }
  }, [editText, entry, isUpdating, onUpdated, onClose]);

  const charCount = editText.length;
  const hasChanges = editText.trim() !== entry.text.trim();

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="slate-modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="slate-modal" role="dialog" aria-modal="true" aria-label="Edit journal entry">
        <div className="slate-modal__header">
          <div>
            <p className="slate-modal__title">Edit Entry</p>
            <p className="slate-modal__meta">
              {formatTime(entry.timestamp)}
              {entry.isVoice ? ' · 🎙 Voice' : ''}
              {entry.isSnippet ? ' · ⚡ Snippet' : ' · 📖 Deep'}
            </p>
          </div>
          <button className="slate-modal__close" onClick={onClose} aria-label="Close edit modal">✕</button>
        </div>
        <div className="slate-modal__editor-wrap">
          <textarea
            ref={textareaRef}
            id="slate-modal-editor"
            className="slate-modal__textarea"
            value={editText}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setEditText(e.target.value);
                setStatusMsg(null);
              }
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleUpdate();
              }
            }}
            aria-label="Edit entry text"
            placeholder="Revise your thought…"
            disabled={isUpdating}
            maxLength={MAX_CHARS}
            spellCheck
            autoCorrect="on"
          />
          <p className={`slate-modal__char-count ${charCount > MAX_CHARS * 0.9 ? 'slate-modal__char-count--warn' : ''}`} aria-live="polite">
            {charCount}/{MAX_CHARS}
          </p>
        </div>
        <div className="slate-modal__footer">
          {statusMsg && (
            <span className={`slate-modal__status-msg ${statusMsg.isError ? 'slate-modal__status-msg--error' : ''}`} aria-live="polite">
              {statusMsg.text}
            </span>
          )}
          <button className="slate-modal__btn-cancel" onClick={onClose} disabled={isUpdating}>Cancel</button>
          <button
            id="slate-modal-update-btn"
            className={`slate-modal__btn-update ${isUpdating ? 'slate-modal__btn-update--loading' : ''}`}
            onClick={handleUpdate}
            disabled={!hasChanges || isUpdating}
            aria-label="Update memory with edited entry"
          >
            {isUpdating ? (
              <span className="slate-compose__dots" aria-label="Updating…"><span /><span /><span /></span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                  <path d="M12 3v1m0 16v1M4.22 4.22l.71.71m13.94 13.94.71.71M3 12h1m16 0h1M4.22 19.78l.71-.71M19.07 4.93l-.71.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Update Memory
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Voice Sanctuary Overlay ────────────────────────────────── */
function VoiceSanctuary({ 
  orbState, 
  isSupported, 
  isReviewMode, 
  draftText, 
  interimText, 
  onOrbClick, 
  onClose, 
  onSave, 
  onRecordAgain,
  isSubmitting
}) {
  return (
    <div className={`slate-voice-sanctuary ${isReviewMode ? 'slate-voice-sanctuary--review' : ''}`}>
      <button className="slate-voice-sanctuary__close" onClick={onClose} aria-label="Close voice sanctuary">✕</button>
      
      <div className="slate-voice-sanctuary__content">
        <div className="slate-voice-sanctuary__orb-wrap">
          <MicOrb
            orbState={orbState}
            isSupported={isSupported}
            onClick={onOrbClick}
            disabled={isSubmitting}
          />
        </div>
        
        {isReviewMode ? (
          <>
            <p className="slate-voice-sanctuary__transcript">{draftText}</p>
            <div className="slate-voice-sanctuary__actions">
              <button 
                className="slate-voice-sanctuary__btn" 
                onClick={onRecordAgain}
                disabled={isSubmitting}
              >
                Record Again
              </button>
              <button 
                className="slate-voice-sanctuary__btn slate-voice-sanctuary__btn--primary" 
                onClick={onSave}
                disabled={isSubmitting || !draftText.trim()}
              >
                {isSubmitting ? 'Saving...' : 'Save to Diary'}
              </button>
            </div>
          </>
        ) : (
          <p className="slate-voice-sanctuary__transcript">
            {draftText}
            {interimText && <span className="slate-voice-sanctuary__interim"> {interimText}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function SlateSection() {
  const [activeMode, setActiveMode]   = useState('snippet');
  const [draft, setDraft]             = useState(() => {
    return localStorage.getItem(SLATE_CACHE_KEY) || '';
  });
  const [entries, setEntries]         = useState(() => {
    try {
      const cached = localStorage.getItem(SLATE_ENTRIES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.date === new Date().toLocaleDateString()) {
          return parsed.entries;
        }
      }
    } catch (e) {
      console.error('Failed to parse cached Slate entries:', e);
    }
    return [];
  });
  const [editModal, setEditModal]     = useState(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [charCount, setCharCount]     = useState(0);
  const [inputMode, setInputMode]     = useState('typed');
  const [permError, setPermError]     = useState(null);
  const [voiceReviewMode, setVoiceReviewMode] = useState(false);
  const [safeguardTopic, setSafeguardTopic]   = useState(null); // For global reset
  const [safeguardEntry, setSafeguardEntry]   = useState(null); // For contextual deletion
  
  // Contextual Deletion Transition State
  const [fadingId, setFadingId] = useState(null);

  const textareaRef  = useRef(null);
  const snippetRef   = useRef(null);

  /* ── Speech recognition ─────────────────────────────────── */
  const {
    orbState,
    transcript,
    interimText,
    isSupported,
    errorMessage: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    silenceTimeoutMs: 2500,
    onTranscriptUpdate: (text) => {
      const merged = text.slice(0, MAX_CHARS);
      setDraft(merged);
      setCharCount(merged.length);
      setInputMode('voice');
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    },
    onSilence: () => {
      setVoiceReviewMode(true);
    }
  });

  useEffect(() => {
    if (speechError) setPermError(speechError);
    else setPermError(null);
  }, [speechError]);

  useEffect(() => {
    localStorage.setItem(SLATE_CACHE_KEY, draft);
  }, [draft]);

  const syncFromStorage = useCallback(() => {
    try {
      const cached = localStorage.getItem(SLATE_ENTRIES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.date === new Date().toLocaleDateString()) {
          setEntries(parsed.entries);
        }
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.error('Failed to sync Slate entries:', e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('sift_sync', syncFromStorage);
    return () => window.removeEventListener('sift_sync', syncFromStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem(SLATE_ENTRIES_CACHE_KEY, JSON.stringify({
        date: new Date().toLocaleDateString(),
        entries,
      }));
    } else {
      localStorage.setItem(SLATE_ENTRIES_CACHE_KEY, JSON.stringify({
        date: new Date().toLocaleDateString(),
        entries: [],
      }));
    }
  }, [entries]);

  const handleModeSwitch = useCallback((mode) => {
    if (mode === activeMode) return;
    if (orbState === 'listening') stopListening();
    setActiveMode(mode);
    setDraft('');
    setCharCount(0);
    setInputMode('typed');
    resetTranscript();
    setVoiceReviewMode(false);
    setTimeout(() => {
      if (mode === 'snippet' && snippetRef.current) snippetRef.current.focus();
      if (mode === 'deep' && textareaRef.current) textareaRef.current.focus();
    }, 80);
  }, [activeMode, orbState, stopListening, resetTranscript]);

  const handleOrbClick = useCallback(() => {
    if (orbState === 'listening') {
      stopListening();
      // Manual stop also transitions to review mode if there is a transcript
      if (draft.trim()) setVoiceReviewMode(true);
    } else if (orbState === 'idle' || orbState === 'error') {
      resetTranscript();
      setInputMode('voice');
      setVoiceReviewMode(false);
      startListening();
    }
  }, [orbState, draft, startListening, stopListening, resetTranscript]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setDraft(val);
      setCharCount(val.length);
      setInputMode('typed');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!draft.trim() || isSubmitting) return;

    if (orbState === 'listening') stopListening();

    const text     = draft.trim();
    const tempId   = Date.now();
    const wasVoice = inputMode === 'voice';
    const isSnippet = activeMode === 'snippet';

    const optimisticEntry = {
      id: tempId,
      text,
      timestamp: new Date().toISOString(),
      status: 'pending',
      isVoice: wasVoice,
      isSnippet,
    };

    setEntries(prev => [optimisticEntry, ...prev]);
    setDraft('');
    localStorage.removeItem(SLATE_CACHE_KEY);
    setCharCount(0);
    setInputMode('typed');
    resetTranscript();
    setVoiceReviewMode(false); // Close sanctuary if open
    setSubmitting(true);

    setTimeout(() => {
      if (isSnippet && snippetRef.current) snippetRef.current.focus();
    }, 80);

    try {
      const result = await ingestEntry({ text });

      if (result.status === 'forget_confirmation' && result.data && result.data.topic) {
        // Intent Interception: User asked to forget something
        if (wasVoice) speakFeedback('I understand. Please confirm this deletion.');
        setSafeguardTopic(result.data.topic);
        // Remove the optimistic entry since it was a command, not a journal entry
        setEntries(prev => prev.filter(e => e.id !== tempId));
        return;
      }

      if (wasVoice) {
        speakFeedback('Your entry is safely recorded.');
      }

      setEntries(prev =>
        prev.map(e => e.id === tempId ? { ...e, status: 'saved', heading: result.heading } : e)
      );
    } catch (err) {
      console.error('Ingest failed:', err);
      if (wasVoice) speakFeedback('Failed to save your entry. Please try again.');
      setEntries(prev =>
        prev.map(e => e.id === tempId ? { ...e, status: 'error' } : e)
      );
    } finally {
      setSubmitting(false);
    }
  }, [draft, isSubmitting, inputMode, activeMode, orbState, stopListening, resetTranscript]);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSnippetKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleEntryClick = useCallback((entry) => {
    if (entry.status !== 'saved') return;
    setEditModal({ entry });
  }, []);

  const handleModalClose = useCallback(() => {
    setEditModal(null);
  }, []);

  const handleEntryUpdated = useCallback((id, newText) => {
    setEntries(prev =>
      prev.map(e => e.id === id ? { ...e, text: newText } : e)
    );
  }, []);

  const handleEntryDelete = useCallback((entry) => {
    setSafeguardEntry(entry);
  }, []);

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const displayValue = orbState === 'listening' && interimText
    ? draft + interimText
    : draft;

  const isVoiceSanctuaryOpen = orbState === 'listening' || voiceReviewMode;

  return (
    <section className="slate-section" aria-label="The Slate — Journal Workspace">
      {/* ── Header ── */}
      <div className="slate-section__header">
        <div>
          <h1 className="slate-section__title">The Slate</h1>
          <p className="slate-section__subtitle">Your private diary workspace</p>
        </div>
        <div className="slate-section__entry-count" aria-live="polite">
          <span className="slate-section__count-num">{entries.length}</span>
          <span className="slate-section__count-label">entries today</span>
        </div>
      </div>

      <DailyPrompt />

      {/* ── Mode Switcher ── */}
      <div className="slate-mode-switcher" role="tablist" aria-label="Compose mode">
        <button
          id="slate-tab-snippet"
          role="tab"
          aria-selected={activeMode === 'snippet'}
          className={`slate-mode-tab ${activeMode === 'snippet' ? 'slate-mode-tab--active' : ''}`}
          onClick={() => handleModeSwitch('snippet')}
        >
          <span className="slate-mode-tab__icon">⚡</span>
          Quick Snippets
        </button>
        <button
          id="slate-tab-deep"
          role="tab"
          aria-selected={activeMode === 'deep'}
          className={`slate-mode-tab ${activeMode === 'deep' ? 'slate-mode-tab--active' : ''}`}
          onClick={() => handleModeSwitch('deep')}
        >
          <span className="slate-mode-tab__icon">📖</span>
          Deep Diary
        </button>
      </div>

      {permError && (
        <div className="slate-perm-error" role="alert" aria-live="assertive">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="15.5" r="0.8" fill="currentColor"/>
          </svg>
          <span>{permError}</span>
          <button className="slate-perm-error__close" onClick={() => setPermError(null)} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* ── Compose Area ── */}
      <div className="slate-compose" role="tabpanel" aria-labelledby={`slate-tab-${activeMode}`}>
        {/* Quick Snippets */}
        {activeMode === 'snippet' && (
          <div className="slate-compose__snippet-strip">
            <input
              ref={snippetRef}
              id="slate-snippet-input"
              type="text"
              className="slate-compose__snippet-input"
              value={draft}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= MAX_CHARS) {
                  setDraft(val);
                  setCharCount(val.length);
                  setInputMode('typed');
                }
              }}
              onKeyDown={handleSnippetKeyDown}
              placeholder="Quick thought… press ↵ to capture"
              aria-label="Quick snippet input — press Enter to save"
              disabled={isSubmitting}
              autoComplete="off"
              spellCheck
            />
            
            <button
              className="slate-compose__snippet-mic"
              onClick={handleOrbClick}
              aria-label="Voice input"
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
            <span className="slate-compose__snippet-hint" aria-hidden="true">↵</span>
            <button
              id="slate-snippet-submit-btn"
              className="slate-compose__snippet-submit"
              onClick={handleSubmit}
              disabled={!draft.trim() || isSubmitting}
              aria-label="Save snippet"
            >
              {isSubmitting ? (
                <span className="slate-compose__dots" aria-label="Saving…"><span /><span /><span /></span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Deep Diary */}
        {activeMode === 'deep' && (
          <div className="slate-compose__deep-canvas">
            <div className="slate-compose__deep-header">
              <span className="slate-compose__deep-label">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              id="slate-deep-textarea"
              className="slate-compose__textarea"
              value={displayValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Begin writing. No filters, no judgment…"
              aria-label="Deep diary entry"
              rows={7}
              maxLength={MAX_CHARS}
              disabled={isSubmitting}
              spellCheck
              autoCorrect="on"
            />

            <div className="slate-compose__footer">
              <span className={`slate-compose__char-count ${charCount > MAX_CHARS * 0.9 ? 'slate-compose__char-count--warn' : ''}`} aria-live="polite">
                {charCount}/{MAX_CHARS}
              </span>
              <div className="slate-compose__actions">
                <span className="slate-compose__shortcut" aria-hidden="true">⌘↵ to save</span>
                <button
                  id="slate-deep-submit-btn"
                  className={`slate-compose__submit ${isSubmitting ? 'slate-compose__submit--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={!draft.trim() || isSubmitting}
                  aria-label="Save journal entry"
                >
                  {isSubmitting ? (
                    <span className="slate-compose__dots" aria-label="Saving…"><span /><span /><span /></span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mic Orb — Deep mode only ── */}
      {activeMode === 'deep' && !isVoiceSanctuaryOpen && (
        <div className="slate-orb-zone" aria-label="Voice input control">
          <MicOrb
            orbState={orbState}
            isSupported={isSupported}
            onClick={handleOrbClick}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* ── Entry Feed ── */}
      <div className="slate-feed" aria-label="Today's journal entries" aria-live="polite">
        {entries.length === 0 ? (
          <div className="slate-feed__empty">
            <div className="slate-feed__empty-icon" aria-hidden="true">🌿</div>
            <p className="slate-feed__empty-title">Your slate is clear</p>
            <p className="slate-feed__empty-body">
              Capture a quick snippet or start a deep reflection above.
              Every thought flows to The Oracle from here.
            </p>
          </div>
        ) : (
          <>
            <p className="slate-feed__section-label" aria-label="Today's entries">
              Today · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </p>
            {entries.map(entry => (
              <article
                key={entry.id}
                className={`slate-entry slate-entry--${entry.status} ${entry.isSnippet ? 'slate-entry--snippet' : ''} ${fadingId === entry.id ? 'slate-entry--fading' : ''}`}
              >
                <button
                  className="slate-entry__body-btn"
                  aria-label={`Journal entry at ${formatTime(entry.timestamp)}${entry.status === 'saved' ? '. Click to edit.' : ''}`}
                  onClick={() => handleEntryClick(entry)}
                  disabled={entry.status !== 'saved'}
                  type="button"
                >
                  <div className="slate-entry__meta">
                    <div className="slate-entry__meta-left">
                      <time className="slate-entry__time" dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
                      <span className="slate-entry__type-badge" aria-hidden="true">{entry.isSnippet ? '⚡ snippet' : '📖 deep'}</span>
                    </div>
                    <div className="slate-entry__badges">
                      {entry.isVoice && <span className="slate-entry__voice-badge" aria-label="Voice entry">🎙</span>}
                      <span className={`slate-entry__status-badge slate-entry__status-badge--${entry.status}`}>
                        {entry.status === 'pending' && '●'}
                        {entry.status === 'saved'   && '✓'}
                        {entry.status === 'error'   && '✕'}
                      </span>
                    </div>
                  </div>
                  {entry.heading ? (
                    <>
                      <h3 className="slate-entry__heading">{entry.heading}</h3>
                      <p className="slate-entry__text slate-entry__text--clamped">{entry.text}</p>
                    </>
                  ) : (
                    <p className="slate-entry__text">{entry.text}</p>
                  )}
                  {entry.status === 'saved' && (
                    <div className="slate-entry__edit-hint" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" width="11" height="11">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      tap to edit
                    </div>
                  )}
                </button>
                {entry.status === 'saved' && (
                  <button
                    className="slate-entry__delete-btn"
                    onClick={() => handleEntryDelete(entry)}
                    aria-label="Dissolve this memory entry"
                    type="button"
                    title="Dissolve memory"
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </article>
            ))}
          </>
        )}
      </div>

      {/* ── Voice Sanctuary Overlay ── */}
      {isVoiceSanctuaryOpen && (
        <VoiceSanctuary 
          orbState={orbState}
          isSupported={isSupported}
          isReviewMode={voiceReviewMode}
          draftText={draft}
          interimText={interimText}
          onOrbClick={handleOrbClick}
          onClose={() => {
            stopListening();
            setVoiceReviewMode(false);
          }}
          onSave={handleSubmit}
          onRecordAgain={() => {
            setDraft('');
            setCharCount(0);
            resetTranscript();
            setVoiceReviewMode(false);
            startListening();
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ── Edit Modal ── */}
      {editModal && (
        <EditModal entry={editModal.entry} onClose={handleModalClose} onUpdated={handleEntryUpdated} />
      )}

      {/* ── Safeguard Modal ── */}
      {(safeguardTopic || safeguardEntry) && (
        <MemorySafeguardModal 
          topic={safeguardTopic || (safeguardEntry ? (safeguardEntry.heading || safeguardEntry.text) : '')} 
          onClose={() => {
            setSafeguardTopic(null);
            setSafeguardEntry(null);
          }} 
          onForgotten={() => {
            if (safeguardEntry) {
              const idToRemove = safeguardEntry.id;
              
              // Immediate sync to avoid unmount race conditions
              const nextEntries = entries.filter(e => e.id !== idToRemove);
              localStorage.setItem(SLATE_ENTRIES_CACHE_KEY, JSON.stringify({
                date: new Date().toLocaleDateString(),
                entries: nextEntries,
              }));
              window.dispatchEvent(new Event('sift_sync'));

              setSafeguardEntry(null);
              setFadingId(idToRemove);
              
              setTimeout(() => {
                setEntries(prev => prev.filter(e => e.id !== idToRemove));
                setFadingId(null);
              }, 400);
            } else {
              localStorage.setItem(SLATE_ENTRIES_CACHE_KEY, JSON.stringify({
                date: new Date().toLocaleDateString(),
                entries: [],
              }));
              window.dispatchEvent(new Event('sift_sync'));

              setEntries([]);
              setSafeguardTopic(null);
            }
          }} 
        />
      )}

    </section>
  );
}
