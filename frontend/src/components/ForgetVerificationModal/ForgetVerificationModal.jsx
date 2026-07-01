import React, { useState } from 'react';
import { useMemory } from '../../context/MemoryContext';
import './ForgetVerificationModal.css';

export default function ForgetVerificationModal() {
  const { forgetVerificationStream, setForgetVerificationStream, confirmBulkForget } = useMemory();
  const [selectedIds, setSelectedIds] = useState(new Set());

  if (!forgetVerificationStream.isOpen) {
    return null;
  }

  const { topic, candidateEntries } = forgetVerificationStream;

  const handleToggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    confirmBulkForget(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleCancel = () => {
    setForgetVerificationStream({ isOpen: false, topic: '', candidateEntries: [] });
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    if (selectedIds.size === candidateEntries.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = candidateEntries.map(entry => entry.id);
      setSelectedIds(new Set(allIds));
    }
  };

  const isEmpty = candidateEntries.length === 0;

  return (
    <div className="forget-modal-overlay">
      <div className="forget-modal-content">
        <h2 className="forget-modal-title">Verification Required</h2>
        
        {isEmpty ? (
          <>
            <p className="forget-modal-desc">
              No related memories or logs discovered on file for <strong>{topic}</strong>.
            </p>
            <div className="forget-modal-actions">
              <button className="forget-btn-cancel" onClick={handleCancel}>
                OK
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="forget-modal-desc">
              We found entries related to <strong>{topic}</strong>. Select exactly what you would like to forget:
            </p>
            
            <div className="forget-modal-list">
              {candidateEntries.map((entry) => (
                <label key={entry.id} className={`forget-modal-item ${selectedIds.has(entry.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => handleToggle(entry.id)}
                  />
                  <span className="forget-modal-text">{entry.content}</span>
                </label>
              ))}
            </div>

            <div className="forget-modal-actions">
              <button className="forget-btn-secondary" onClick={handleSelectAll}>
                {selectedIds.size === candidateEntries.length && candidateEntries.length > 0 ? 'Edit Selections' : 'Select All'}
              </button>
              <button className="forget-btn-cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button 
                className="forget-btn-confirm" 
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
              >
                Confirm {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
