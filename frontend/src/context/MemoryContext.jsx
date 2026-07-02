import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchTimeline, ingestEntry, updateEntry, forgetMemory, recoverMemory, improveMemory } from '../utils/api';

const ORACLE_CACHE_KEY = 'sift_oracle_cards_stream';

const MemoryContext = createContext();

export function MemoryProvider({ children }) {
  const [journalTimelineStream, setJournalTimelineStream] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Deletion Verification State ---
  const [forgetVerificationStream, setForgetVerificationStream] = useState({
    isOpen: false,
    topic: '',
    candidateEntries: []
  });

  // --- Oracle Context State ---
  const [oracleCardsStream, setOracleCardsStream] = useState(() => {
    try {
      const cached = localStorage.getItem(ORACLE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.date === new Date().toLocaleDateString()) {
          return parsed.cards;
        }
      }
    } catch (e) {
      console.error('Failed to parse cached Oracle cards:', e);
    }
    return [];
  });
  const [isOracleThinking, setIsOracleThinking] = useState(false);

  useEffect(() => {
    localStorage.setItem(ORACLE_CACHE_KEY, JSON.stringify({
      date: new Date().toLocaleDateString(),
      cards: oracleCardsStream
    }));
  }, [oracleCardsStream]);

  const loadTimeline = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchTimeline();
      if (response.status === 'success' && response.timeline) {
        // Map backend database format to frontend state format
        const formatted = response.timeline.map(record => ({
          id: record.id,
          content: record.content,
          timestamp: record.created_at,
          // Infer isSnippet from text length as fallback (adjust length as needed)
          isSnippet: (record.content || '').length <= 150,
          isVoice: false,
          status: 'saved',
          profile_id: record.profile_id,
          summary_snippet: record.summary_snippet || null
        }));
        setJournalTimelineStream(formatted);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setError(err.message || 'Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Network Dispatch: Submit
  const submitMemory = useCallback(async (text, isVoice = false, isSnippet = false, onComplete = null) => {
    try {
      const result = await ingestEntry({ text });
      
      // Intercept verification request
      if (result && result.status === 'verification_required') {
        setForgetVerificationStream({
          isOpen: true,
          topic: result.topic,
          candidateEntries: result.matches || []
        });
        if (onComplete) onComplete(result);
        return; // Halt normal ingestion logic
      }

      // Add to global stream
      if (result.databaseRecord) {
        setJournalTimelineStream(prev => {
          const newEntry = {
            id: result.databaseRecord.id,
            content: result.databaseRecord.content,
            timestamp: result.databaseRecord.created_at,
            isSnippet: isSnippet,
            isVoice: isVoice,
            status: 'saved',
            profile_id: result.databaseRecord.profile_id,
            summary_snippet: result.databaseRecord.summary_snippet || null
          };
          return [newEntry, ...prev];
        });
      }
      if (onComplete) onComplete(result);
    } catch (err) {
      console.error('Background Ingest failed:', err);
      if (onComplete) onComplete({ status: 'error', error: err });
    }
  }, []);

  // Network Dispatch: Update
  const updateMemory = useCallback(async (id, originalText, newText) => {
    try {
      // Optimistic update
      setJournalTimelineStream(prev => 
        prev.map(entry => entry.id === id ? { ...entry, content: newText } : entry)
      );
      await updateEntry({ entryId: id, originalText, newText });
    } catch (err) {
      console.error('Background Update failed:', err);
      // Revert optimistic update? Or just let it be handled by user reloading
    }
  }, []);

  // Network Dispatch: Delete
  const deleteMemory = useCallback(async (entry) => {
    try {
      const response = await forgetMemory({ topic: entry.content, entryId: entry.id });
      if (response && response.status === 'success') {
        setJournalTimelineStream(prev => prev.filter(e => e.id !== entry.id));
      }
    } catch (err) {
      console.error('Background Delete failed:', err);
    }
  }, []);

  // Network Dispatch: Bulk Delete Confirmed
  const confirmBulkForget = useCallback(async (selectedIds) => {
    try {
      // Find the entries based on IDs in the verification stream
      const entriesToDelete = forgetVerificationStream.candidateEntries.filter(
        entry => selectedIds.includes(entry.id)
      );

      // Loop through selected and dispatch
      for (const entry of entriesToDelete) {
        // Optimistic UI clear
        setJournalTimelineStream(prev => prev.filter(e => e.id !== entry.id));
        // Fire network deletion
        await forgetMemory({ topic: entry.content, entryId: entry.id });
      }

      // Flush verification context stream
      setForgetVerificationStream({ isOpen: false, topic: '', candidateEntries: [] });
    } catch (err) {
      console.error('Background Bulk Delete failed:', err);
    }
  }, [forgetVerificationStream.candidateEntries]);

  // --- Oracle Interactions ---
  const sendOracleQuery = useCallback(async (queryText) => {
    if (!queryText.trim() || isOracleThinking) return;

    setIsOracleThinking(true);
    
    const pendingId = Date.now();
    const newCard = {
      id: pendingId,
      query: queryText.trim(),
      answer: null, // Indicates thinking
      lookupToken: null,
      feedbackStatus: null,
      syncState: 'idle',
      timestamp: new Date().toISOString(),
      type: 'pending'
    };
    
    setOracleCardsStream(prev => [...prev, newCard]);

    try {
      const result = await recoverMemory({ question: queryText });
      
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === pendingId) {
          if (result.status === 'success' && result.data && result.data.headline && result.data.primary_content) {
            return {
              ...card,
              answer: result.data,
              lookupToken: result.data.headline,
              type: 'oracle_shield'
            };
          } else {
            return {
              ...card,
              answer: { text: result.message || (result.data ? JSON.stringify(result.data) : 'I processed your thoughts, but the response was unclear.') },
              type: 'text'
            };
          }
        }
        return card;
      }));
    } catch (err) {
      console.error('Oracle failed:', err);
      const is404 = err.message && err.message.includes('404');
      
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === pendingId) {
          return {
            ...card,
            answer: { 
              text: is404 
                ? "I don't have enough memories in the graph yet. Keep journaling in The Slate, and I will build your cognitive map." 
                : "I couldn't reach my memory banks right now. The backend may be offline.",
              isError: true 
            },
            type: 'text'
          };
        }
        return card;
      }));
    } finally {
      setIsOracleThinking(false);
    }
  }, [isOracleThinking]);

  const submitOracleFeedback = useCallback(async (cardId, isHelpful, lookupToken) => {
    const feedbackType = isHelpful ? 'helpful' : 'unhelpful';
    
    setOracleCardsStream(prev => prev.map(card => {
      if (card.id === cardId) {
        return { ...card, feedbackStatus: feedbackType, syncState: 'processing' };
      }
      return card;
    }));

    try {
      await improveMemory({ helpful: isHelpful, context: lookupToken });
      
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === cardId) {
          return { ...card, syncState: 'calibrated' };
        }
        return card;
      }));
    } catch (err) {
      console.error('Feedback failed:', err);
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === cardId) {
          return { ...card, feedbackStatus: null, syncState: 'idle' };
        }
        return card;
      }));
    }
  }, []);

  const clearOracleChat = useCallback(() => {
    setOracleCardsStream([]);
  }, []);

  const value = {
    journalTimelineStream,
    isLoading,
    error,
    refreshTimeline: loadTimeline,
    submitMemory,
    updateMemory,
    deleteMemory,
    oracleCardsStream,
    isOracleThinking,
    sendOracleQuery,
    submitOracleFeedback,
    clearOracleChat,
    forgetVerificationStream,
    setForgetVerificationStream,
    confirmBulkForget,
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory() {
  const context = useContext(MemoryContext);
  if (context === undefined) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
}
