import { useState, useRef, useCallback, useEffect } from 'react';
import { ingestEntry, updateEntry } from '../../../utils/api';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import { useMemory } from '../../../context/MemoryContext';
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
const SNIPPET_MAX_CHARS = 2000;
const DEEP_MAX_CHARS = 30000;

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
  const [editText, setEditText]       = useState(entry.content);
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
    if (!trimmed || trimmed === (entry.content || '').trim() || isUpdating) return;

    setIsUpdating(true);
    setStatusMsg(null);

    try {
      await updateEntry({
        entryId: entry.id,
        originalText: entry.content,
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
  const hasChanges = editText.trim() !== (entry.content || '').trim();

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
              const max = entry.isSnippet ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS;
              if (e.target.value.length <= max) {
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
            maxLength={entry.isSnippet ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS}
            spellCheck
            autoCorrect="on"
          />
          <p className={`slate-modal__char-count ${charCount > (entry.isSnippet ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS) * 0.9 ? 'slate-modal__char-count--warn' : ''}`} aria-live="polite">
            {charCount}/{entry.isSnippet ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS}
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

/* ── Tripwire Alert Modal ───────────────────────────────────── */
function TripwireModal({ alertData, onGotIt, onDiscard }) {
  if (!alertData) return null;
  const { pattern } = alertData;
  return (
    <div className="slate-modal-overlay" role="presentation">
      <div className="slate-modal" role="dialog" aria-modal="true" aria-label="Tripwire Alert">
        <div className="slate-modal__header">
          <div>
            <p className="slate-modal__title" style={{ color: '#ff4d4f' }}>⚠️ Oracle Tripwire</p>
            <p className="slate-modal__meta">You are entering a known friction loop.</p>
          </div>
        </div>
        <div className="slate-modal__editor-wrap" style={{ padding: '16px', color: '#e5e7eb' }}>
          <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>{pattern?.title}</p>
          <p style={{ opacity: 0.8 }}>{pattern?.description}</p>
        </div>
        <div className="slate-modal__footer" style={{ marginTop: '16px' }}>
          <button className="slate-modal__btn-cancel" onClick={onDiscard}>Discard Entry</button>
          <button className="slate-modal__btn-update" style={{ background: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }} onClick={onGotIt}>Got it, thanks</button>
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
  const scrollContainerRef = useRef(null);
  const isAutoScrollEnabled = useRef(true);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Allow a small leeway of 10px to consider it "at the bottom"
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 10;
    isAutoScrollEnabled.current = isAtBottom;
  };

  // Auto-scroll to bottom of the card on new text inputs if user hasn't scrolled up
  useEffect(() => {
    if (scrollContainerRef.current && isAutoScrollEnabled.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [draftText, interimText]);

  const hasContent = !!(draftText.trim() || interimText?.trim());

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
        
        {/* Premium Scrollable Glass/Paper Transcription Card */}
        <div className="slate-voice-card">
          <div className="slate-voice-card__scrollable" ref={scrollContainerRef} onScroll={handleScroll}>
            {hasContent ? (
              <p className="slate-voice-sanctuary__transcript">
                {draftText}
                {interimText && <span className="slate-voice-sanctuary__interim"> {interimText}</span>}
              </p>
            ) : (
              <p className="slate-voice-card__placeholder">
                {orbState === 'listening' ? 'Listening... Speak now.' : 'Sanctuary ready. Tap the orb to record.'}
              </p>
            )}
          </div>
        </div>

        {isReviewMode && (
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
        )}
      </div>
    </div>
  );
}

/* ── Slate Card Component ───────────────────────────────────── */
function SlateCard({ entry, formatTime, fadingId, handleEntryClick, handleEntryDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSummary = !!entry.summary_snippet;
  const isLong = entry.content && entry.content.length > 200;
  const isExpandable = hasSummary || isLong;

  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const isSaved  = entry.status === 'saved';
  const isFading = fadingId === entry.id;

  /* ── Deep Diary Card ─────────────────────────────────────── */
  if (!entry.isSnippet) {
    return (
      <article
        className={`sc-deep ${isFading ? 'sc--fading' : ''} ${isExpanded ? 'sc-deep--expanded' : ''}`}
        onClick={isExpandable ? toggleExpand : undefined}
        style={{ cursor: isExpandable ? 'pointer' : 'default' }}
        aria-label="Deep diary entry"
      >
        {/* decorative top rule */}
        <div className="sc-deep__rule" aria-hidden="true" />

        {/* header row */}
        <div className="sc-deep__header">
          <div className="sc-deep__header-left">
            {/* book icon */}
            <svg className="sc-deep__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <time className="sc-deep__time" dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
            {entry.isVoice && <span className="sc-deep__voice" aria-label="Voice entry">🎙</span>}
          </div>
          <div className="sc-deep__header-right">
            <span className={`sc-deep__status sc-deep__status--${entry.status}`}>
              {entry.status === 'pending' && '●'}
              {entry.status === 'saved'   && '✓'}
              {entry.status === 'error'   && '✕'}
            </span>
            <span className="sc-deep__badge">DEEP</span>
          </div>
        </div>

        {/* heading */}
        {entry.heading && <h3 className="sc-deep__heading">{entry.heading}</h3>}

        {/* body */}
        <p className="sc-deep__body">
          {hasSummary && !isExpanded 
            ? entry.summary_snippet 
            : (!isExpanded && isLong ? entry.content.slice(0, 200) + '...' : entry.content)
          }
        </p>

        {/* expand hint */}
        {isExpandable && isSaved && (
          <p className="sc-deep__hint" aria-live="polite">
            {isExpanded ? '↑ Tap to Show less' : '↓ Tap to Read more'}
          </p>
        )}

        {/* action bar */}
        {isSaved && (
          <div className="sc-deep__actions">
            <button
              className="sc-deep__edit-btn"
              onClick={(e) => { e.stopPropagation(); handleEntryClick(entry); }}
              aria-label="Edit entry"
            >
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Edit
            </button>
            <button
              className="sc-deep__delete-btn"
              onClick={(e) => { e.stopPropagation(); handleEntryDelete(entry); }}
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
          </div>
        )}
      </article>
    );
  }

  /* ── Quick Snippet Card ───────────────────────────────────── */
  return (
    <article
      className={`sc-snip ${isFading ? 'sc--fading' : ''} ${isExpanded ? 'sc-snip--expanded' : ''}`}
      onClick={hasSummary ? toggleExpand : undefined}
      style={{ cursor: hasSummary ? 'pointer' : 'default' }}
      aria-label="Quick snippet entry"
    >
      {/* header row */}
      <div className="sc-snip__header">
        <div className="sc-snip__header-left">
          {/* lightning icon */}
          <svg className="sc-snip__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 2L4.09 12.96A1 1 0 0 0 5 14.5h6.5L11 22l8.91-10.96A1 1 0 0 0 19 9.5H12.5L13 2z"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <time className="sc-snip__time" dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
          {entry.isVoice && <span className="sc-snip__voice" aria-label="Voice entry">🎙</span>}
        </div>
        <div className="sc-snip__header-right">
          <span className={`sc-snip__status sc-snip__status--${entry.status}`}>
            {entry.status === 'pending' && '●'}
            {entry.status === 'saved'   && '✓'}
            {entry.status === 'error'   && '✕'}
          </span>
          <span className="sc-snip__badge">SNIPPET</span>
        </div>
      </div>

      {/* body */}
      <p className="sc-snip__body">
        {hasSummary && !isExpanded ? entry.summary_snippet : entry.content}
      </p>

      {/* expand hint */}
      {hasSummary && isSaved && (
        <p className="sc-snip__hint" aria-live="polite">
          {isExpanded ? '↑ Tap to Expand' : '↓ Tap to Collapse'}
        </p>
      )}

      {/* footer actions */}
      {isSaved && (
        <div className="sc-snip__footer">
          <div className="sc-snip__actions">
            <button
              className="sc-snip__edit-btn"
              onClick={(e) => { e.stopPropagation(); handleEntryClick(entry); }}
              aria-label="Edit snippet"
            >
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Edit
            </button>
            <button
              className="sc-snip__delete-btn"
              onClick={(e) => { e.stopPropagation(); handleEntryDelete(entry); }}
              aria-label="Dissolve this snippet"
              type="button"
              title="Dissolve memory"
            >
              <svg viewBox="0 0 24 24" fill="none" width="11" height="11" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}


/* ── Main Component ─────────────────────────────────────────── */
export default function SlateSection() {
  const { journalTimelineStream, submitMemory, updateMemory, deleteMemory } = useMemory();
  
  const todayKey = new Date().toLocaleDateString();
  const entries = journalTimelineStream.filter(
    e => new Date(e.timestamp).toLocaleDateString() === todayKey
  );
  const snippetEntries = entries.filter(e => e.isSnippet);
  const deepEntries    = entries.filter(e => !e.isSnippet);

  const [activeMode, setActiveMode]   = useState('snippet');
  const [draft, setDraft]             = useState(() => {
    return localStorage.getItem(SLATE_CACHE_KEY) || '';
  });
  const [editModal, setEditModal]     = useState(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [charCount, setCharCount]     = useState(0);
  const [inputMode, setInputMode]     = useState('typed');
  const [permError, setPermError]     = useState(null);
  const [voiceReviewMode, setVoiceReviewMode] = useState(false);
  const [safeguardTopic, setSafeguardTopic]   = useState(null); // For global reset
  const [safeguardEntry, setSafeguardEntry]   = useState(null); // For contextual deletion
  const [tripwireAlert, setTripwireAlert]     = useState(null);
  
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
    silenceTimeoutMs: 8000,
    onTranscriptUpdate: (text) => {
      // Allow voice to capture up to DEEP_MAX_CHARS, we will truncate on submit if snippet mode
      const merged = text.slice(0, DEEP_MAX_CHARS);
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
    const max = activeMode === 'snippet' ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS;
    if (val.length <= max) {
      setDraft(val);
      setCharCount(val.length);
      setInputMode('typed');
    }
  }, [activeMode]);

  const executeSubmit = useCallback((forceSave) => {
    if (!draft.trim() || isSubmitting) return;

    if (orbState === 'listening') stopListening();

    const isSnippet = activeMode === 'snippet';
    const max = isSnippet ? SNIPPET_MAX_CHARS : DEEP_MAX_CHARS;
    const activeInputString = draft.trim().slice(0, max);
    const wasVoice = inputMode === 'voice';

    setSubmitting(true);

    submitMemory(activeInputString, wasVoice, isSnippet, forceSave, (result) => {
      setSubmitting(false);

      if (!forceSave && result && result.status === 'tripwire_alert') {
        if (wasVoice) speakFeedback('Tripwire alert detected.');
        setTripwireAlert(result.data);
        return;
      }

      if (forceSave) {
        setTripwireAlert(null);
      }

      if (result && result.status === 'forget_confirmation' && result.data && result.data.topic) {
        if (wasVoice) speakFeedback('I understand. Please confirm this deletion.');
        setSafeguardTopic(result.data.topic);
        return;
      }
      
      if (result && result.status === 'error') {
        if (wasVoice) speakFeedback('Failed to save your entry. Please try again.');
        return;
      }
      
      // Post-Ingest State Splice
      if (wasVoice) {
        speakFeedback('Your entry is safely recorded.');
      }

      setDraft('');
      localStorage.removeItem(SLATE_CACHE_KEY);
      setCharCount(0);
      setInputMode('typed');
      resetTranscript();
      setVoiceReviewMode(false); // Close sanctuary if open

      setTimeout(() => {
        if (isSnippet && snippetRef.current) snippetRef.current.focus();
      }, 80);
    });
  }, [draft, isSubmitting, inputMode, activeMode, orbState, stopListening, resetTranscript, submitMemory]);

  const handleSubmit = useCallback((e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    executeSubmit(false);
  }, [executeSubmit]);

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
    updateMemory(id, null, newText);
  }, [updateMemory]);

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
        <DailyPrompt />
        
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
                if (val.length <= SNIPPET_MAX_CHARS) {
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
              maxLength={DEEP_MAX_CHARS}
              disabled={isSubmitting}
              spellCheck
              autoCorrect="on"
            />

            <div className="slate-compose__footer">
              <span className={`slate-compose__char-count ${charCount > DEEP_MAX_CHARS * 0.9 ? 'slate-compose__char-count--warn' : ''}`} aria-live="polite">
                {charCount}/{DEEP_MAX_CHARS}
              </span>
              <div className="slate-compose__actions">
                <span className="slate-compose__shortcut" aria-hidden="true">⌘↵ to save</span>
                <button
                  type="button"
                  className={`slate-compose__mic-inline ${orbState === 'listening' ? 'slate-compose__mic-inline--listening' : ''}`}
                  onClick={handleOrbClick}
                  disabled={isSubmitting}
                  aria-label={orbState === 'listening' ? 'Stop voice input' : 'Start voice input'}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill={orbState === 'listening' ? 'currentColor' : 'none'} fillOpacity={orbState === 'listening' ? 0.16 : 0} />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
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
      {(() => {
        const activeEntries = activeMode === 'snippet' ? snippetEntries : deepEntries;
        const modeLabel     = activeMode === 'snippet' ? '⚡ Quick Snippets' : '📖 Deep Diary';
        const emptyMsg      = activeMode === 'snippet'
          ? 'No quick snippets yet — type a thought above and press ↵ to capture it.'
          : 'No deep diary entries yet — start writing above and save your reflection.';

        return (
          <div className="slate-feed" aria-label="Today's journal entries" aria-live="polite">
            {activeEntries.length === 0 ? (
              <div className="slate-feed__empty">
                <div className="slate-feed__empty-icon" aria-hidden="true">
                  {activeMode === 'snippet' ? '⚡' : '📖'}
                </div>
                <p className="slate-feed__empty-title">Nothing here yet</p>
                <p className="slate-feed__empty-body">{emptyMsg}</p>
              </div>
            ) : (
              <>
                <p className="slate-feed__section-label">
                  {modeLabel} · {activeEntries.length} {activeEntries.length === 1 ? 'entry' : 'entries'}
                </p>
                {activeEntries.map(entry => (
                  <SlateCard
                    key={entry.id}
                    entry={entry}
                    formatTime={formatTime}
                    fadingId={fadingId}
                    handleEntryClick={handleEntryClick}
                    handleEntryDelete={handleEntryDelete}
                  />
                ))}
              </>
            )}
          </div>
        );
      })()}

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
          entry={safeguardEntry}
          topic={safeguardTopic} 
          onClose={() => {
            setSafeguardTopic(null);
            setSafeguardEntry(null);
          }} 
          onForgotten={() => {
            if (safeguardEntry) {
              setSafeguardEntry(null);
            }
            if (safeguardTopic) {
              setSafeguardTopic(null);
            }
          }} 
        />
      )}

      {/* ── Tripwire Modal ── */}
      {tripwireAlert && (
        <TripwireModal 
          alertData={tripwireAlert} 
          onDiscard={() => {
            setTripwireAlert(null);
            setDraft('');
            setCharCount(0);
            resetTranscript();
            setVoiceReviewMode(false);
          }}
          onGotIt={() => {
            executeSubmit(true);
          }}
        />
      )}

    </section>
  );
}
