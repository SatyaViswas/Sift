import React, { useState } from 'react';
import { forgetMemory } from '../../utils/api';
import { useMemory } from '../../context/MemoryContext';
import './MemorySafeguardModal.css';

export default function MemorySafeguardModal({ entry, topic, onClose, onForgotten }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const { deleteMemory } = useMemory();

  const displayTopic = entry ? (entry.summary_snippet || entry.content) : topic;

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      if (entry) {
         await deleteMemory(entry);
      } else {
         await forgetMemory({ topic });
      }
      onForgotten(displayTopic);
    } catch (err) {
      console.error('Failed to dissolve connection:', err);
      setError('Failed to prune memory. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="safeguard-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onClose(); }}>
      <div className="safeguard-modal" role="dialog" aria-modal="true" aria-labelledby="safeguard-modal-title">
        <div className="safeguard-modal__header">
          <div className="safeguard-modal__icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true" className="safeguard-modal__icon">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 id="safeguard-modal-title" className="safeguard-modal__title">Dissolve Semantic Connection</h2>
        </div>
        
        <div className="safeguard-modal__body">
          <p className="safeguard-modal__text">
            Déjà will permanently dissolve your past relationship logs from your recovery graph regarding:
          </p>
          <div className="safeguard-modal__topic-card">
            <span className="safeguard-modal__topic-text">"{displayTopic}"</span>
          </div>
          <p className="safeguard-modal__text safeguard-modal__text--sub">
            Your other journal entries will remain untouched. This action cannot be undone.
          </p>
        </div>

        {error && (
          <div className="safeguard-modal__error" role="alert">
            {error}
          </div>
        )}

        <div className="safeguard-modal__footer">
          <button 
            className="safeguard-modal__btn-cancel" 
            onClick={onClose} 
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className={`safeguard-modal__btn-confirm ${isDeleting ? 'safeguard-modal__btn-confirm--loading' : ''}`} 
            onClick={handleConfirm}
            disabled={isDeleting}
            aria-label="Confirm memory pruning"
          >
            {isDeleting ? 'Dissolving...' : 'Yes, Forget This'}
          </button>
        </div>
      </div>
    </div>
  );
}
