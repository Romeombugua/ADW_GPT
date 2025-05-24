import React, { useState } from 'react';
import PropTypes from 'prop-types';
import * as apiService from '../apiService';

function SessionList({ sessions, selectedSession, onSelectSession, onSessionCreated, selectedProject, isLoading, onError, projectFiles }) {
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Check if there are files uploaded for this project
  const hasFiles = projectFiles && projectFiles.length > 0;

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionName.trim() || !selectedProject) return;
    
    // Check if files have been uploaded
    if (!projectFiles || projectFiles.length === 0) {
      onError('Please upload at least one file before creating a session.');
      return;
    }
    
    setIsCreating(true);
    onError('');
    
    try {
      const response = await apiService.createSession(selectedProject.id, newSessionName);
      onSessionCreated(response.data);
      setNewSessionName('');
    } catch (err) {
      console.error("Error creating session:", err);
      onError('Failed to create session.');
    } finally {
      setIsCreating(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    
    // If it's today, just show the time
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show the full date
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <form className="create-form" onSubmit={handleCreateSession}>
        <div className="input-group mobile-friendly">
          <input
            type="text"
            className="form-input"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="New session name"
            disabled={isLoading || isCreating || !selectedProject || !hasFiles}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || isCreating || !newSessionName.trim() || !selectedProject || !hasFiles}
          >
            {isCreating ? '...' : 'Create'}
          </button>
        </div>
        
        {selectedProject && !hasFiles && (
          <div className="file-warning-message">
            <span className="warning-icon">⚠️</span>
            <span>Please upload at least one file before creating a session</span>
          </div>
        )}
      </form>

      <ul className="list">
        {sessions.length > 0 ? sessions.map(session => {
          // Check if session has a created_at property, assuming it comes from the API
          const timestamp = session.created_at || session.timestamp;
          
          return (
            <li
              key={session.id}
              className={`list-item ${selectedSession?.id === session.id ? 'active' : ''}`}
              onClick={() => onSelectSession(session)}
            >
              <span className="item-icon">💬</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="item-content">{session.name || `Session ${session.id}`}</span>
                {timestamp && (
                  <div className="item-metadata">
                    Created: {formatTimestamp(timestamp)}
                  </div>
                )}
              </div>
              <span className="item-badge">
                {session.message_count ? `${session.message_count} msgs` : 'New'}
              </span>
            </li>
          );
        }) : (
          <li className="empty-state">
            <div className="empty-state-icon">💬</div>
            <p>{selectedProject ? "No sessions yet" : "Select a project first"}</p>
            {selectedProject && (
              <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Create a new session to start chatting
              </p>
            )}
          </li>
        )}
      </ul>
    </>
  );
}

SessionList.propTypes = {
  sessions: PropTypes.array.isRequired,
  selectedSession: PropTypes.object,
  onSelectSession: PropTypes.func.isRequired,
  onSessionCreated: PropTypes.func.isRequired,
  selectedProject: PropTypes.object,
  isLoading: PropTypes.bool.isRequired,
  onError: PropTypes.func.isRequired,
  projectFiles: PropTypes.array,
};

export default SessionList;
