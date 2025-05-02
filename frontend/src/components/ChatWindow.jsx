import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import * as apiService from '../apiService';

function ChatWindow({ selectedProject, selectedSession, isLoading, setIsLoading, onError }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  
  // Function to scroll to the bottom of the message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch historical messages when session changes
  useEffect(() => {
    const fetchHistoricalMessages = async () => {
      if (selectedProject && selectedSession) {
        setIsLoading(true);
        onError('');
        try {
          const response = await apiService.fetchMessages(selectedProject.id, selectedSession.id);
          setMessages(response.data);
        } catch (err) {
          console.error("Error fetching messages:", err);
          onError('Failed to load message history.');
          setMessages([]);
        } finally {
          setIsLoading(false);
          // Focus on message input after loading
          messageInputRef.current?.focus();
        }
      } else {
        setMessages([]);
      }
    };
    fetchHistoricalMessages();
  }, [selectedProject, selectedSession, setIsLoading, onError]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedProject || !selectedSession) return;

    const userMessage = { 
      role: 'user', 
      content: newMessage, 
      timestamp: new Date().toISOString() 
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    const messageToSend = newMessage;
    setNewMessage('');
    setIsSending(true);
    onError('');

    try {
      const response = await apiService.sendMessage(
        selectedProject.id,
        selectedSession.id,
        messageToSend
      );

      // Fetch the latest messages again after sending
      const updatedMessagesResponse = await apiService.fetchMessages(selectedProject.id, selectedSession.id);
      setMessages(updatedMessagesResponse.data);
    } catch (err) {
      console.error("Error sending message:", err);
      onError('Failed to send message or get reply.');
      // Remove the optimistic user message on error
      setMessages(prevMessages => prevMessages.filter(msg => msg !== userMessage));
    } finally {
      setIsSending(false);
      // Focus back on input after sending
      messageInputRef.current?.focus();
    }
  };

  // Handle textarea resize and submit on Enter (without shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default to avoid new line
      handleSendMessage(e);
    }
  };

  // Automatically resize textarea based on content
  const handleTextareaChange = (e) => {
    const textarea = e.target;
    setNewMessage(textarea.value);
    
    // Reset height to auto to correctly calculate the new height
    textarea.style.height = 'auto';
    // Set new height based on scrollHeight, with a max height
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-title">
          <span>{selectedSession?.name || `Session ${selectedSession?.id || ''}`}</span>
          <span className="session-badge">Project: {selectedProject?.name}</span>
        </div>
        <div className="chat-actions">
          {isSending && <span className="loading-indicator">Thinking...</span>}
        </div>
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <p>This is the beginning of your conversation.</p>
            <p>Ask anything!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={msg.id || `local-${index}`} 
              className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}
            >
              <div className="message-header">
                <div className={`message-avatar ${msg.role === 'user' ? 'user-avatar' : 'assistant-avatar'}`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <span className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
              </div>
              <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="message-input">
        <form onSubmit={handleSendMessage} className="message-form">
          <textarea
            ref={messageInputRef}
            className="message-textarea"
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading || isSending || !selectedSession}
            rows={1}
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={isLoading || isSending || !newMessage.trim() || !selectedSession}
            title="Send message"
          >
            ➤
          </button>
        </form>
      </div>
    </>
  );
}

ChatWindow.propTypes = {
  selectedProject: PropTypes.object,
  selectedSession: PropTypes.object,
  isLoading: PropTypes.bool.isRequired,
  setIsLoading: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};

export default ChatWindow;
