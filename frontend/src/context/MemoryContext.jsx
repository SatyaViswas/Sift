import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchTimeline, ingestEntry, updateEntry, forgetMemory, recoverMemory, improveMemory, generateFeedback, fetchBlindspots } from '../utils/api';
import { useAuth } from './AuthContext';

const ORACLE_CACHE_KEY = 'sift_oracle_cards_stream';

const MemoryContext = createContext();

export function MemoryProvider({ children }) {
  const { user } = useAuth();
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
  const [oracleInputValue, setOracleInputValue] = useState(() => {
    return localStorage.getItem('sift_oracle_input') || '';
  });
  const oracleAbortControllerRef = useRef(null);

  // --- Blindspots State ---
  const [blindspotsData, setBlindspotsData] = useState(null);
  const [isBlindspotsLoading, setIsBlindspotsLoading] = useState(false);

  // --- Feedback Modal State ---
  const [feedbackModalConfig, setFeedbackModalConfig] = useState({
    isOpen: false,
    cardId: null,
    isHelpful: null,
    generatedText: '',
    isUpdate: false,
    originalFeedbackStatus: null
  });

  useEffect(() => {
    localStorage.setItem(ORACLE_CACHE_KEY, JSON.stringify({
      date: new Date().toLocaleDateString(),
      cards: oracleCardsStream
    }));
  }, [oracleCardsStream]);

  useEffect(() => {
    localStorage.setItem('sift_oracle_input', oracleInputValue);
  }, [oracleInputValue]);

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

  // Reload timeline whenever the logged-in user changes
  useEffect(() => {
    // Clear previous user's data immediately to prevent leakage
    setJournalTimelineStream([]);
    setOracleCardsStream([]);
    setError(null);
    if (user) {
      loadTimeline();
    } else {
      setIsLoading(false);
    }
  }, [user, loadTimeline]);

  // Network Dispatch: Submit
  const submitMemory = useCallback(async (text, isVoice = false, isSnippet = false, forceSave = false, onComplete = null) => {
    try {
      const timestamp = new Date().toISOString();
      const result = await ingestEntry({ text, isSnippet, timestamp, force_save: forceSave });
      
      // Intercept tripwire alert
      if (result && result.status === 'tripwire_alert') {
        if (onComplete) onComplete(result);
        return; // Halt ingestion and let UI show popup
      }

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
      return result;
    } catch (err) {
      console.error('Background Ingest failed:', err);
      if (onComplete) onComplete({ status: 'error', error: err });
      throw err;
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

    oracleAbortControllerRef.current = new AbortController();

    try {
      const result = await recoverMemory({ question: queryText, signal: oracleAbortControllerRef.current.signal });
      
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
      oracleAbortControllerRef.current = null;
    }
  }, [isOracleThinking]);

  const cancelOracleQuery = useCallback(() => {
    if (oracleAbortControllerRef.current) {
      oracleAbortControllerRef.current.abort();
      oracleAbortControllerRef.current = null;
      setIsOracleThinking(false);
      
      // Remove or mark the pending card as cancelled
      setOracleCardsStream(prev => prev.map(card => {
        if (card.type === 'pending') {
          return {
            ...card,
            answer: { text: "Query stopped.", isError: true },
            type: 'text'
          };
        }
        return card;
      }));
    }
  }, []);

  const generateOracleFeedback = useCallback(async (cardId, isHelpful, lookupToken, scenario) => {
    const card = oracleCardsStream.find(c => c.id === cardId);
    const originalStatus = card ? card.feedbackStatus : null;

    setOracleCardsStream(prev => prev.map(card => {
      if (card.id === cardId) {
        return { ...card, feedbackStatus: isHelpful ? 'helpful' : 'unhelpful', syncState: 'processing' };
      }
      return card;
    }));

    try {
      const result = await generateFeedback({ helpful: isHelpful, context: lookupToken, scenario });
      
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === cardId) {
          // Revert processing state since modal takes over
          return { ...card, syncState: 'idle' };
        }
        return card;
      }));

      const currentCard = oracleCardsStream.find(c => c.id === cardId);
      setFeedbackModalConfig({
        isOpen: true,
        cardId,
        isHelpful,
        generatedText: result.summary || '',
        isUpdate: !!(currentCard && currentCard.feedbackEntryId),
        originalFeedbackStatus: originalStatus
      });
    } catch (err) {
      console.error('Generate feedback failed:', err);
      setOracleCardsStream(prev => prev.map(card => {
        if (card.id === cardId) {
          return { ...card, feedbackStatus: originalStatus, syncState: 'idle' };
        }
        return card;
      }));
    }
  }, [oracleCardsStream]);

  const cancelOracleFeedback = useCallback(() => {
    const { cardId, originalFeedbackStatus } = feedbackModalConfig;
    setFeedbackModalConfig(prev => ({ ...prev, isOpen: false }));
    
    if (cardId) {
      setOracleCardsStream(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, feedbackStatus: originalFeedbackStatus, syncState: 'idle' };
        }
        return c;
      }));
    }
  }, [feedbackModalConfig]);

  const saveOracleFeedback = useCallback(async (cardId, text) => {
    const config = feedbackModalConfig;
    setFeedbackModalConfig({ ...config, isOpen: false });

    setOracleCardsStream(prev => prev.map(card => {
      if (card.id === cardId) {
        return { ...card, syncState: 'processing' };
      }
      return card;
    }));

    try {
      const card = oracleCardsStream.find(c => c.id === cardId);
      if (!card) return;

      let entryId = card.feedbackEntryId;

      if (config.isUpdate && entryId) {
        // Update existing memory
        await updateMemory(entryId, card.feedbackText || '', text);
      } else {
        // Ingest new memory
        const result = await submitMemory(text, false, false);
        if (result && result.databaseRecord) {
          entryId = result.databaseRecord.id;
        }
      }

      setOracleCardsStream(prev => prev.map(c => {
        if (c.id === cardId) {
          return { 
            ...c, 
            syncState: 'calibrated',
            feedbackEntryId: entryId,
            feedbackText: text
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Save feedback failed:', err);
      setOracleCardsStream(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, syncState: 'idle' };
        }
        return c;
      }));
    }
  }, [feedbackModalConfig, oracleCardsStream, updateMemory, submitMemory]);

  const resetOracleFeedbackUI = useCallback((cardId) => {
    setOracleCardsStream(prev => prev.map(c => {
      if (c.id === cardId) {
        return { 
          ...c, 
          feedbackStatus: null,
          syncState: 'idle',
          feedbackEntryId: null,
          feedbackText: null
        };
      }
      return c;
    }));
  }, []);

  const deleteOracleFeedback = useCallback(async (cardId) => {
    const card = oracleCardsStream.find(c => c.id === cardId);
    if (!card || !card.feedbackEntryId) return;

    setOracleCardsStream(prev => prev.map(c => {
      if (c.id === cardId) {
        return { ...c, syncState: 'processing' };
      }
      return c;
    }));

    try {
      await deleteMemory({ id: card.feedbackEntryId, content: card.feedbackText });
      
      setOracleCardsStream(prev => prev.map(c => {
        if (c.id === cardId) {
          return { 
            ...c, 
            feedbackStatus: null,
            syncState: 'idle',
            feedbackEntryId: null,
            feedbackText: null
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Delete feedback failed:', err);
      setOracleCardsStream(prev => prev.map(c => {
        if (c.id === cardId) {
          return { ...c, syncState: 'calibrated' };
        }
        return c;
      }));
    }
  }, [oracleCardsStream, deleteMemory]);

  const clearOracleChat = useCallback(() => {
    setOracleCardsStream([]);
  }, []);

  const refreshBlindspots = useCallback(async (force = false) => {
    if (isBlindspotsLoading) return;
    setIsBlindspotsLoading(true);
    try {
      const response = await fetchBlindspots({ force_refresh: force });
      if (response && response.status === 'success') {
        setBlindspotsData(response);
      }
    } catch (err) {
      console.error('Failed to load blindspots:', err);
    } finally {
      setIsBlindspotsLoading(false);
    }
  }, [isBlindspotsLoading]);

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
    generateOracleFeedback,
    cancelOracleFeedback,
    saveOracleFeedback,
    deleteOracleFeedback,
    resetOracleFeedbackUI,
    feedbackModalConfig,
    setFeedbackModalConfig,
    clearOracleChat,
    forgetVerificationStream,
    setForgetVerificationStream,
    confirmBulkForget,
    oracleInputValue,
    setOracleInputValue,
    cancelOracleQuery,
    blindspotsData,
    isBlindspotsLoading,
    refreshBlindspots,
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
