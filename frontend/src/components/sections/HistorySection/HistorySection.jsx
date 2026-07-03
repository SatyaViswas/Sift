import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { updateEntry } from '../../../utils/api';
import { useMemory } from '../../../context/MemoryContext';
import MemorySafeguardModal from '../../MemorySafeguardModal/MemorySafeguardModal';
import './HistorySection.css';

/* ─── Constants ─────────────────────────────────────────────── */
const MAX_CHARS = 2000;

/* ─── Helpers ───────────────────────────────────────────────── */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toDateKey(date) {
  return date.toLocaleDateString();
}

function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}

function buildWeek(centerDate, count = 14) {
  const arr = [];
  const start = new Date(centerDate);
  start.setDate(start.getDate() - Math.floor(count / 2));
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(d);
  }
  return arr;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  return grid;
}

function isDateOutsideWeekWindow(date, center, count = 14) {
  const start = new Date(center);
  start.setDate(start.getDate() - Math.floor(count / 2));
  const end = new Date(start);
  end.setDate(start.getDate() + count - 1);
  return date < start || date > end;
}

/* ─── EntryCard ──────────────────────────────────────────────── */
function EntryCard({ entry, onEdit, onDelete, isFading }) {
  const [hovered, setHovered] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <article
      className={`hist-entry ${entry.isSnippet ? 'hist-entry--snippet' : 'hist-entry--deep'} ${hovered ? 'hist-entry--hovered' : ''} ${isFading ? 'hist-entry--fading' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setTimeout(() => setHovered(false), 1200)}
    >
      <div className="hist-entry__gutter">
        <span className={`hist-entry__type-pip hist-entry__type-pip--${entry.isSnippet ? 'snippet' : 'deep'}`} aria-hidden="true" />
        <time className="hist-entry__time" dateTime={entry.timestamp}>{time}</time>
        <span className="hist-entry__badge" aria-label={entry.isSnippet ? 'snippet' : 'deep reflection'}>
          {entry.isSnippet ? '⚡ Snippet' : '📖 Reflection'}
        </span>
      </div>
      <p className="hist-entry__text">{entry.content}</p>

      <div
        className={`hist-entry__actions ${hovered ? 'hist-entry__actions--visible' : ''}`}
        aria-hidden={!hovered}
      >
        <button
          className="hist-entry__btn hist-entry__btn--edit"
          onClick={() => onEdit(entry)}
          aria-label="Edit this entry"
        >
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Edit
        </button>
        <button
          className="hist-entry__btn hist-entry__btn--delete"
          onClick={() => onDelete(entry)}
          aria-label="Dissolve this memory entry"
        >
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Dissolve
        </button>
      </div>
    </article>
  );
}

/* ─── InlineEditor ───────────────────────────────────────────── */
function InlineEditor({ entry, onSave, onCancel }) {
  const [text, setText] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === (entry.content || '').trim() || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateEntry({ entryId: entry.id, originalText: entry.content, newText: trimmed });
      setStatus('saved');
      onSave(entry.id, trimmed);
      setTimeout(onCancel, 700);
    } catch {
      setStatus('error');
      setSaving(false);
    }
  }, [text, entry, saving, onSave, onCancel]);

  const hasChanges = text.trim() !== (entry.content || '').trim();
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="hist-inline-editor">
      <div className="hist-inline-editor__header">
        <span className="hist-inline-editor__label">
          {entry.isSnippet ? '⚡' : '📖'} {time} — Editing on paper
        </span>
        <button className="hist-inline-editor__close" onClick={onCancel} aria-label="Cancel edit">✕</button>
      </div>
      <textarea
        ref={textareaRef}
        className="hist-inline-editor__textarea"
        value={text}
        onChange={e => {
          if (e.target.value.length <= MAX_CHARS) {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }
        }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
          if (e.key === 'Escape') onCancel();
        }}
        disabled={saving}
        maxLength={MAX_CHARS}
        aria-label="Edit entry text"
        spellCheck
      />
      <div className="hist-inline-editor__footer">
        <span
          className={`hist-inline-editor__status${status === 'error' ? ' hist-inline-editor__status--error' : status === 'saved' ? ' hist-inline-editor__status--saved' : ''}`}
          aria-live="polite"
        >
          {status === 'saved' && '✓ Memory updated'}
          {status === 'error' && '✕ Update failed — retry'}
        </span>
        <span className="hist-inline-editor__hint" aria-hidden="true">⌘↵ to save · Esc to cancel</span>
        <button
          className={`hist-inline-editor__save${saving ? ' hist-inline-editor__save--loading' : ''}`}
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving
            ? <span className="hist-dots"><span/><span/><span/></span>
            : 'Update Memory'
          }
        </button>
      </div>
    </div>
  );
}

/* ─── JournalPage ────────────────────────────────────────────── */
function JournalPage({ title, entries, editingId, onEdit, onDelete, onSave, onCancelEdit, isRight, fadingId }) {
  return (
    <div className={`hist-page${isRight ? ' hist-page--right-tint' : ''}`}>
      {/* Page margin line (left gutter rule) */}
      <div className="hist-page__margin" aria-hidden="true" />

      <div className="hist-page__header">
        <span className="hist-page__corner-fold" aria-hidden="true" />
        <p className="hist-page__title">{title}</p>
      </div>

      {/* Horizontal ruling lines under content */}
      <div className="hist-page__rules" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="hist-page__rule-line" />
        ))}
      </div>

      <div className="hist-page__body">
        {entries.length === 0 ? (
          <div className="hist-page__empty">
            <div className="hist-page__empty-icon" aria-hidden="true">✦</div>
            <p className="hist-page__empty-text">Nothing written here yet.</p>
            <p className="hist-page__empty-sub">Entries captured in The Slate will appear on this page.</p>
          </div>
        ) : (
          entries.map(entry => (
            editingId === entry.id ? (
              <InlineEditor
                key={entry.id}
                entry={entry}
                onSave={onSave}
                onCancel={onCancelEdit}
              />
            ) : (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                isFading={fadingId === entry.id}
              />
            )
          ))
        )}
      </div>
    </div>
  );
}

/* ─── WeekCalendar ───────────────────────────────────────────── */
function WeekCalendar({ selectedDate, onSelectDate, hasEntries }) {
  const today = useMemo(() => new Date(), []);
  const [weekCenter, setWeekCenter] = useState(() => new Date(today));
  const days = useMemo(() => buildWeek(weekCenter, 14), [weekCenter]);
  const stripRef = useRef(null);

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const shiftWeek = useCallback((delta) => {
    setWeekCenter(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }, []);

  useEffect(() => {
    if (!stripRef.current) return;
    const activeEl = stripRef.current.querySelector('.hist-cal-day--active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (isDateOutsideWeekWindow(selectedDate, weekCenter, 14)) {
      setWeekCenter(new Date(selectedDate));
    }
  }, [selectedDate, weekCenter]);

  return (
    <div className="hist-week-cal" aria-label="Day selector">
      <button
        className="hist-week-cal__arrow"
        onClick={() => shiftWeek(-1)}
        aria-label="Previous two weeks"
      >
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="hist-week-cal__strip" ref={stripRef}>
        {days.map((date, i) => {
          const dk = toDateKey(date);
          const isActive = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const hasDot = hasEntries(dk);
          const isFuture = date > today && !isToday;
          return (
            <button
              key={i}
              className={[
                'hist-cal-day',
                isActive  ? 'hist-cal-day--active'  : '',
                isToday   ? 'hist-cal-day--today'   : '',
                isFuture  ? 'hist-cal-day--future'  : '',
              ].join(' ').trim()}
              onClick={() => onSelectDate(date)}
              aria-label={`${date.toDateString()}${hasDot ? ', has entries' : ''}`}
              aria-pressed={isActive}
              disabled={isFuture}
            >
              <span className="hist-cal-day__weekday">{DAY_LABELS[date.getDay()]}</span>
              <span className="hist-cal-day__num">{date.getDate()}</span>
              {hasDot && <span className="hist-cal-day__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <button
        className="hist-week-cal__arrow"
        onClick={() => shiftWeek(1)}
        aria-label="Next two weeks"
      >
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ─── MonthPopover ───────────────────────────────────────────── */
function MonthPopover({ selectedDate, onSelectDate, onClose }) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));
  const popoverRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    };
    // slight delay so the trigger click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const grid = useMemo(() => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const today = new Date();
  const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const shiftMonth = (delta) => {
    setViewDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  return (
    <div
      className="hist-month-popover"
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Month calendar picker"
    >
      <div className="hist-month-popover__header">
        <button className="hist-month-popover__arrow" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>

        <span className="hist-month-popover__title">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>

        <button className="hist-month-popover__arrow" onClick={() => shiftMonth(1)} aria-label="Next month">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="hist-month-popover__grid">
        {DAY_ABBR.map(d => (
          <span key={d} className="hist-month-popover__dayname">{d}</span>
        ))}
        {grid.map((date, i) => {
          if (!date) return <span key={`e-${i}`} className="hist-month-popover__empty" />;
          const isActive  = isSameDay(date, selectedDate);
          const isToday   = isSameDay(date, today);
          const isFuture  = date > today && !isToday;
          return (
            <button
              key={date.getTime()}
              className={[
                'hist-month-popover__day',
                isActive  ? 'hist-month-popover__day--active'  : '',
                isToday   ? 'hist-month-popover__day--today'   : '',
                isFuture  ? 'hist-month-popover__day--future'  : '',
              ].join(' ').trim()}
              onClick={() => { onSelectDate(date); onClose(); }}
              aria-label={date.toDateString()}
              aria-pressed={isActive}
              disabled={isFuture}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function HistorySection() {
  const { journalTimelineStream, updateMemory, deleteMemory } = useMemory();
  
  const allEntries = useMemo(() => {
    const grouped = {};
    journalTimelineStream.forEach(entry => {
      const key = toDateKey(new Date(entry.timestamp));
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    });
    return grouped;
  }, [journalTimelineStream]);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [editingId, setEditingId] = useState(null);
  const [safeguardEntry, setSafeguardEntry] = useState(null);
  const [fadingId, setFadingId] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [mobileTab, setMobileTab] = useState('deep');
  const [bookMounted, setBookMounted] = useState(false);

  // Page-flip animation state
  const [pageFlipping, setPageFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState('forward'); // 'forward' | 'backward'
  const prevDateRef = useRef(selectedDate);

  useEffect(() => {
    const t = setTimeout(() => setBookMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const currentDateKey = toDateKey(selectedDate);
  const dayEntries = allEntries[currentDateKey] || [];
  const deepEntries = dayEntries.filter(e => !e.isSnippet);
  const snippetEntries = dayEntries.filter(e => e.isSnippet);

  const hasEntries = useCallback((dk) => {
    return !!(allEntries[dk] && allEntries[dk].length > 0);
  }, [allEntries]);

  /** Navigate to a new date with a page-flip animation */
  const navigateToDate = useCallback((date) => {
    if (isSameDay(date, selectedDate)) return;
    const isForward = date > selectedDate;
    setFlipDirection(isForward ? 'forward' : 'backward');
    setPageFlipping(true);
    setEditingId(null);

    // After the flip-out completes (200ms), swap the date, then flip in
    setTimeout(() => {
      setSelectedDate(date);
      prevDateRef.current = date;
      // Allow one paint cycle then flip in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPageFlipping(false);
        });
      });
    }, 200);
  }, [selectedDate]);

  const handleEdit = useCallback((entry) => setEditingId(entry.id), []);
  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleSave = useCallback((id, newText) => {
    updateMemory(id, null, newText);
  }, [updateMemory]);

  const handleDelete = useCallback((entry) => {
    setSafeguardEntry(entry);
  }, []);

  const handleForgotten = useCallback(() => {
    setSafeguardEntry(null);
  }, []);

  const spreadClass = [
    'hist-book',
    bookMounted ? 'hist-book--open' : '',
    pageFlipping ? `hist-book--flip-${flipDirection}` : '',
  ].filter(Boolean).join(' ');

  const mobilPageClass = [
    'hist-mobile-page',
    pageFlipping ? `hist-mobile-page--flip-${flipDirection}` : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="hist-section" aria-label="The Archives — Historical journal entries">

      {/* ── Section Header ── */}
      <div className="hist-section__header">
        <div className="hist-section__header-left">
          <h1 className="hist-section__title">The Archives</h1>
          <p className="hist-section__subtitle">
            {dayEntries.length > 0
              ? `${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'} · ${formatDate(selectedDate)}`
              : formatDate(selectedDate)}
          </p>
        </div>

        <div className="hist-section__header-right">
          <button
            className={`hist-month-trigger${showMonthPicker ? ' hist-month-trigger--open' : ''}`}
            onClick={() => setShowMonthPicker(s => !s)}
            aria-label="Open month calendar"
            aria-expanded={showMonthPicker}
          >
            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {formatMonthYear(selectedDate)}
          </button>

          {showMonthPicker && (
            <MonthPopover
              selectedDate={selectedDate}
              onSelectDate={navigateToDate}
              onClose={() => setShowMonthPicker(false)}
            />
          )}
        </div>
      </div>

      {/* ── Week Calendar Strip ── */}
      <WeekCalendar
        selectedDate={selectedDate}
        onSelectDate={navigateToDate}
        hasEntries={hasEntries}
      />

      {/* ── Mobile Sub-Tab Switcher ── */}
      <div className="hist-mobile-tabs" role="tablist" aria-label="Entry type filter">
        <button
          id="hist-tab-deep"
          role="tab"
          aria-selected={mobileTab === 'deep'}
          className={`hist-mobile-tab${mobileTab === 'deep' ? ' hist-mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('deep')}
        >
          <span aria-hidden="true">📖</span> Reflections
        </button>
        <button
          id="hist-tab-snippet"
          role="tab"
          aria-selected={mobileTab === 'snippet'}
          className={`hist-mobile-tab${mobileTab === 'snippet' ? ' hist-mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('snippet')}
        >
          <span aria-hidden="true">⚡</span> Snippets
        </button>
      </div>

      {/* ── Desktop Book Spread ── */}
      <div className={spreadClass} aria-label="Journal open spread">
        <div className="hist-book__page hist-book__page--left">
          <JournalPage
            title="Deep Reflections"
            entries={deepEntries}
            editingId={editingId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
            isRight={false}
            fadingId={fadingId}
          />
        </div>

        {/* Spine */}
        <div className="hist-book__spine" aria-hidden="true">
          <span className="hist-book__spine-label">
            {selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="hist-book__page hist-book__page--right">
          <JournalPage
            title="Day Snippets"
            entries={snippetEntries}
            editingId={editingId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
            isRight={true}
            fadingId={fadingId}
          />
        </div>
      </div>

      {/* ── Mobile Single Page ── */}
      <div className={mobilPageClass} aria-live="polite">
        <JournalPage
          title={mobileTab === 'deep' ? 'Deep Reflections' : 'Day Snippets'}
          entries={mobileTab === 'deep' ? deepEntries : snippetEntries}
          editingId={editingId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSave={handleSave}
          onCancelEdit={handleCancelEdit}
          isRight={mobileTab === 'snippet'}
          fadingId={fadingId}
        />
      </div>

      {/* ── Memory Safeguard Modal ── */}
      {safeguardEntry && (
        <MemorySafeguardModal
          entry={safeguardEntry}
          topic={safeguardEntry.content}
          onClose={() => setSafeguardEntry(null)}
          onForgotten={handleForgotten}
        />
      )}

    </section>
  );
}
