import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BookmarksContext = createContext();

const STORAGE_KEY = 'sift_bookmarks';

export function BookmarksProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse bookmarks from local storage', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks to local storage', e);
    }
  }, [bookmarks]);

  const addBookmark = useCallback((dateKey, color) => {
    setBookmarks(prev => {
      // Remove any existing bookmark for this date first to avoid duplicates
      const filtered = prev.filter(b => b.dateKey !== dateKey);
      return [...filtered, {
        id: Date.now().toString(),
        dateKey,
        color,
        timestamp: new Date().toISOString()
      }];
    });
  }, []);

  const removeBookmark = useCallback((dateKey) => {
    setBookmarks(prev => prev.filter(b => b.dateKey !== dateKey));
  }, []);

  const getBookmarkForDate = useCallback((dateKey) => {
    return bookmarks.find(b => b.dateKey === dateKey) || null;
  }, [bookmarks]);

  const value = {
    bookmarks,
    addBookmark,
    removeBookmark,
    getBookmarkForDate
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (context === undefined) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
}
