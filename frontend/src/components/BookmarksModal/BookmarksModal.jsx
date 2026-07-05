import { useEffect, useRef } from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import './BookmarksModal.css';

export default function BookmarksModal({ onClose, onSelectDate }) {
  const { bookmarks, removeBookmark } = useBookmarks();
  const modalRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    // Slight delay to prevent immediate close if triggered by a button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Sort bookmarks by date (newest first)
  const sortedBookmarks = [...bookmarks].sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));

  return (
    <div className="bookmarks-modal-overlay" aria-modal="true" role="dialog" aria-label="Saved Bookmarks">
      <div className="bookmarks-modal" ref={modalRef}>
        <div className="bookmarks-modal__header">
          <h2 className="bookmarks-modal__title">Saved Bookmarks</h2>
          <button className="bookmarks-modal__close" onClick={onClose} aria-label="Close bookmarks">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bookmarks-modal__content">
          {sortedBookmarks.length === 0 ? (
            <div className="bookmarks-modal__empty">
              <div className="bookmarks-modal__empty-icon">🔖</div>
              <p>No bookmarks saved yet.</p>
              <span>Bookmark a day in The Archives to save it here.</span>
            </div>
          ) : (
            <ul className="bookmarks-modal__list">
              {sortedBookmarks.map((bookmark) => {
                const dateObj = new Date(bookmark.dateKey);
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                  weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
                });

                return (
                  <li key={bookmark.id} className="bookmarks-modal__item">
                    <button 
                      className="bookmarks-modal__item-btn"
                      onClick={() => {
                        onSelectDate(dateObj);
                        onClose();
                      }}
                    >
                      <span 
                        className="bookmarks-modal__color-indicator" 
                        style={{ backgroundColor: bookmark.color }}
                        aria-hidden="true"
                      />
                      <span className="bookmarks-modal__date">{formattedDate}</span>
                    </button>
                    <button 
                      className="bookmarks-modal__remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBookmark(bookmark.dateKey);
                      }}
                      aria-label="Remove bookmark"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
