import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import * as apiService from '../apiService';

// Utility function to format assistant messages
const formatAssistantMessage = (content) => {
  if (!content) return '';
  
  // Create a copy of the content to work with
  let formattedContent = content;
  
  // Format numbered lists with proper structure (e.g., "1. Text", "2. Text", etc.)
  formattedContent = formattedContent.replace(/(\d+\.\s)([^\n]+)(\n|$)/g, (match, number, text) => {
    return `<div class="list-item"><span class="list-number">${number}</span><span class="list-text">${text}</span></div>`;
  });
  
  // Format bold text with asterisks
  formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Handle italics with single asterisks
  formattedContent = formattedContent.replace(/(?<!\*)\*(?!\*)([^\*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Format sections with header-like formatting
  formattedContent = formattedContent.replace(/^(#+)\s+(.+)$/gm, (match, hashes, text) => {
    const level = Math.min(hashes.length, 6); // h1-h6
    return `<h${level} class="message-heading">${text}</h${level}>`;
  });
  
  // Handle citations in square brackets [1], [2], etc.
  formattedContent = formattedContent.replace(/\[(\d+)\]/g, '<span class="citation">[$1]</span>');
  
  // Handle nested lists (indented lists)
  formattedContent = formattedContent.replace(/^(\s{2,})(\d+\.\s)([^\n]+)$/gm, (match, indent, number, text) => {
    const indentLevel = Math.min(Math.floor(indent.length / 2), 3);
    return `<div class="list-item nested-list level-${indentLevel}"><span class="list-number">${number}</span><span class="list-text">${text}</span></div>`;
  });
  
  // Split into paragraphs and process each paragraph
  const paragraphs = formattedContent.split('\n\n');
  
  // Process each paragraph
  const processedParagraphs = paragraphs.map(para => {
    if (!para.trim()) return '';
    
    // Skip wrapping with <p> if paragraph already contains divs, lists, or headings
    if (
      para.includes('<div class="list-item">') || 
      para.includes('<h') ||
      para.includes('<ul') ||
      para.includes('<ol')
    ) {
      return para;
    }
    
    return `<p>${para}</p>`;
  });
  
  // Join processed paragraphs back together
  return processedParagraphs.join('');
};

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
              {msg.role === 'assistant' ? (
                <div 
                  className="message-bubble assistant-bubble"
                  dangerouslySetInnerHTML={{ __html: formatAssistantMessage(msg.content) }}
                />
              ) : (
                <div className="message-bubble user-bubble">
                  {msg.content}
                </div>
              )}
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
