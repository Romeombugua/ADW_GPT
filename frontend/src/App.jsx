import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from './apiService';
import ProjectList from './components/ProjectList';
import SessionList from './components/SessionList';
import FileUpload from './components/FileUpload';
import ChatWindow from './components/ChatWindow';
import MobileHandler from './components/MobileHandler';
import Login from './components/Login';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectsPanelCollapsed, setProjectsPanelCollapsed] = useState(false);
  const [sessionsPanelCollapsed, setSessionsPanelCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved theme preference or prefer-color-scheme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  // Track uploaded files for the selected project
  const [projectFiles, setProjectFiles] = useState([]);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = apiService.isAuthenticated();
      setIsAuthenticated(isAuth);
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Apply theme class to document body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    // Save theme preference
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prevMode => !prevMode);
  };

  // Centralized error handler
  const handleError = (message) => {
    setError(message);
    setIsLoading(false);
  };

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    handleError('');
    try {
      const response = await apiService.fetchProjects();
      setProjects(response.data);
    } catch (err) {
      console.error("Error fetching projects:", err);
      handleError('Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch projects when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, loadProjects]);

  // Fetch sessions when a project is selected
  useEffect(() => {
    const loadSessions = async () => {
      if (selectedProject) {
        setIsLoading(true);
        handleError('');
        try {
          console.log(`Fetching sessions for project ID: ${selectedProject.id}`);
          const response = await apiService.fetchSessions(selectedProject.id);
          console.log('Sessions API response:', response);
          setSessions(response.data);
          console.log('Sessions stored in state:', response.data);
          setSelectedSession(null);
        } catch (err) {
          console.error("Error fetching sessions:", err);
          handleError('Failed to load sessions.');
          setSessions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSessions([]);
      }
    };
    loadSessions();
  }, [selectedProject]);

  const handleProjectCreated = (newProject) => {
    setProjects(prevProjects => [...prevProjects, newProject]);
    setSelectedProject(newProject);
    setIsLoading(false);
  };

  const handleSessionCreated = (newSession) => {
    setSessions(prevSessions => [...prevSessions, newSession]);
    setSelectedSession(newSession);
    setIsLoading(false);
  };

  const handleSelectProject = (project) => {
    if (selectedProject?.id !== project.id) {
      setSelectedProject(project);
    }
  };

  const handleSelectSession = (session) => {
    setSelectedSession(session);
  };

  const toggleProjectsPanel = () => {
    setProjectsPanelCollapsed(!projectsPanelCollapsed);
  };

  const toggleSessionsPanel = () => {
    setSessionsPanelCollapsed(!sessionsPanelCollapsed);
  };

  // Authentication handlers
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Reload projects after login
    loadProjects();
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setProjects([]);
      setSelectedProject(null);
      setSessions([]);
      setSelectedSession(null);
    }
  };

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="app-container">
        <div className="loading">Checking authentication...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Add MobileHandler component to handle responsive behavior */}
      <MobileHandler 
        setProjectsPanelCollapsed={setProjectsPanelCollapsed}
        setSessionsPanelCollapsed={setSessionsPanelCollapsed}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
      />
      
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <h1>ADW Assistant</h1>
          </div>
        </div>
        
        <div className="header-right">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
              <button className="close-btn" onClick={() => setError('')}>×</button>
            </div>
          )}
          
          {isLoading && (
            <div className="loading-indicator">
              <span className="spinner"></span>
              <span>Processing</span>
            </div>
          )}
          
          <div className="header-actions">
            <button className="header-btn" title="Toggle theme" onClick={toggleTheme}>
              <span className="header-btn-icon">{darkMode ? '☀️' : '🌙'}</span>
            </button>
            <button className="header-btn logout-btn" title="Logout" onClick={handleLogout}>
              <span className="header-btn-icon">🚪</span>
              <span className="logout-text">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebars */}
      <div className="main-content-wrapper">
        {/* Sidebars Container */}
        <div className="sidebars-container">
          {/* Projects Panel */}
          <div className={`sidebar-panel ${projectsPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-panel-header">
              <h2 className="sidebar-panel-title">Projects</h2>
              <button 
                className="sidebar-btn" 
                onClick={toggleProjectsPanel} 
                title={projectsPanelCollapsed ? "Expand Projects" : "Collapse Projects"}
              >
                {projectsPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            
            {!projectsPanelCollapsed && (
              <div className="sidebar-content">
                <ProjectList
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={handleSelectProject}
                  onProjectCreated={handleProjectCreated}
                  isLoading={isLoading}
                  onError={handleError}
                />
              </div>
            )}
          </div>
          
          {/* Sessions Panel */}
          <div className={`sidebar-panel ${sessionsPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-panel-header">
              <h2 className="sidebar-panel-title">
                {selectedProject ? `Sessions: ${selectedProject.name}` : 'Sessions'}
              </h2>
              <button 
                className="sidebar-btn" 
                onClick={toggleSessionsPanel} 
                title={sessionsPanelCollapsed ? "Expand Sessions" : "Collapse Sessions"}
              >
                {sessionsPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            
            {!sessionsPanelCollapsed && (
              <div className="sidebar-content">
                {selectedProject ? (
                  <>
                    <div className="file-upload">
                      <FileUpload
                        selectedProject={selectedProject}
                        isLoading={isLoading}
                        onError={handleError}
                        onFilesChange={setProjectFiles}
                      />
                    </div>
                    
                    <div className="sessions-container">
                      {sessions.length > 0 && (
                        <div className="debug-info" style={{fontSize: '0.8rem', padding: '5px', color: 'var(--primary-700)', backgroundColor: 'var(--primary-100)', marginBottom: '10px', borderRadius: '4px'}}>
                          {sessions.length} session(s) available
                        </div>
                      )}
                      <SessionList
                        sessions={sessions}
                        selectedSession={selectedSession}
                        onSelectSession={handleSelectSession}
                        onSessionCreated={handleSessionCreated}
                        selectedProject={selectedProject}
                        isLoading={isLoading}
                        onError={handleError}
                        projectFiles={projectFiles}
                      />
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <p>Select a project to view sessions</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="app-main">
          {selectedProject && selectedSession ? (
            <div className="chat-container">
              <ChatWindow
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onError={handleError}
              />
            </div>
          ) : (
            <div className="placeholder-container">
              <div className="welcome-chat">
                <div className="placeholder-icon">💬</div>
                <h2 className="placeholder-title">
                  {!selectedProject ? "Select a project to get started" : "Select a session to start chatting"}
                </h2>
                <p className="placeholder-subtitle">
                  {!selectedProject 
                    ? "Choose an existing project or create a new one from the left sidebar" 
                    : "Choose an existing session or create a new one to start your conversation"}
                </p>
                
                {selectedProject && !selectedSession && (
                  <div className="quick-actions">
                    <h3>Quick Actions</h3>
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        // Focus the session input in the sidebar
                        const sessionInput = document.querySelector('.sessions-container input');
                        if (sessionInput) {
                          sessionInput.focus();
                        }
                      }}
                    >
                      Create New Session
                    </button>
                    
                    <div className="quick-tips">
                      <h4>Tip:</h4>
                      <p>Upload documents to provide context for your AI assistant</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Add decorative elements */}
              <div className="decorative-elements">
                <div className="chat-bubble-decoration chat-bubble-1"></div>
                <div className="chat-bubble-decoration chat-bubble-2"></div>
                <div className="chat-bubble-decoration chat-bubble-3"></div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
