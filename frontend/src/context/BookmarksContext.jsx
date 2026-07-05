import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const BookmarksContext = createContext();

const STORAGE_KEY = 'sift_bookmarks';

export function BookmarksProvider({ children }) {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState(() => {
    // Initial local cache
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse bookmarks from local storage', e);
      return [];
    }
  });

  // Fetch from Supabase on mount
  useEffect(() => {
    if (!user) return;
    
    const fetchBookmarks = async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        // Map Supabase rows to our app format
        const mapped = data.map(row => ({
          id: row.id,
          dateKey: row.date_key,
          color: row.color,
          timestamp: row.created_at
        }));
        setBookmarks(mapped);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      } else if (error) {
        console.error('Error fetching bookmarks from Supabase:', error);
      }
    };
    
    fetchBookmarks();
  }, [user]);

  // Save to local storage whenever bookmarks change (as fallback/cache)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks to local storage', e);
    }
  }, [bookmarks]);

  const addBookmark = useCallback(async (dateKey, color) => {
    // Optimistic UI Update
    const newBookmark = {
      id: Date.now().toString(), // temporary ID
      dateKey,
      color,
      timestamp: new Date().toISOString()
    };
    
    setBookmarks(prev => {
      const filtered = prev.filter(b => b.dateKey !== dateKey);
      return [...filtered, newBookmark];
    });

    if (user) {
      // Upsert to Supabase
      const { error } = await supabase
        .from('bookmarks')
        .upsert({
          user_id: user.id,
          date_key: dateKey,
          color: color,
          created_at: newBookmark.timestamp
        }, { onConflict: 'user_id,date_key' });
        
      if (error) {
        console.error('Error syncing bookmark to Supabase:', error);
      }
    }
  }, [user]);

  const removeBookmark = useCallback(async (dateKey) => {
    // Optimistic UI Update
    setBookmarks(prev => prev.filter(b => b.dateKey !== dateKey));

    if (user) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('date_key', dateKey);

      if (error) {
        console.error('Error removing bookmark from Supabase:', error);
      }
    }
  }, [user]);

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
