import React, { useState } from 'react';
import PropTypes from 'prop-types';
import * as apiService from '../apiService';

function ProjectList({ projects, selectedProject, onSelectProject, onProjectCreated, isLoading, onError }) {
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [isCreating, setIsCreating] = useState(false);

  // Available AI models
  const availableModels = [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview' },
  ];

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setIsCreating(true);
    onError(''); // Clear previous errors
    
    try {
      const response = await apiService.createProject(newProjectName, selectedModel);
      onProjectCreated(response.data);
      setNewProjectName('');
    } catch (err) {
      console.error("Error creating project:", err);
      onError('Failed to create project.');
    } finally {
      setIsCreating(false);
    }
  };

  // Check if we're on a mobile device
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <>
      <form className="create-form" onSubmit={handleCreateProject}>
        <div className="input-group mobile-friendly">
          <input
            type="text"
            className="form-input"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New project name"
            disabled={isLoading || isCreating}
          />
          <div className="select-button-group">
            <select
              className="form-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading || isCreating}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {isMobile ? model.id : model.name}
                </option>
              ))}
            </select>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || isCreating || !newProjectName.trim()}
            >
              {isCreating ? '...' : 'Create'}
            </button>
          </div>
        </div>
      </form>
      
      <ul className="list">
        {projects.length > 0 ? projects.map((project, index) => (
          <li
            key={project.id}
            className={`list-item ${selectedProject?.id === project.id ? 'active' : ''}`}
            onClick={() => onSelectProject(project)}
          >
            <span className="item-icon">📁</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="item-content">{project.name}</span>
              <div className="item-metadata">
                {project.model ? `${project.model}` : 'No model set'}
              </div>
            </div>
            <span className="item-badge">{`ID: ${project.id}`}</span>
          </li>
        )) : (
          <li className="empty-state">
            <div className="empty-state-icon">📁</div>
            <p>No projects yet</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Create your first project to get started</p>
          </li>
        )}
      </ul>
    </>
  );
}

ProjectList.propTypes = {
  projects: PropTypes.array.isRequired,
  selectedProject: PropTypes.object,
  onSelectProject: PropTypes.func.isRequired,
  onProjectCreated: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onError: PropTypes.func.isRequired,
};

export default ProjectList;
