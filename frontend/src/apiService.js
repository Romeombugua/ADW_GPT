import axios from 'axios';

const API_BASE_URL = 'https://soback.cbu.net/api'; // Adjust if your backend runs elsewhere

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchProjects = () => apiClient.get('/projects/');

export const createProject = (name, model) => apiClient.post('/projects/', { name, model });

export const fetchSessions = (projectId) => apiClient.get(`/projects/${projectId}/sessions/`);

export const createSession = (projectId, name) => apiClient.post(`/projects/${projectId}/sessions/`, { name });

export const uploadFile = (projectId, formData) => apiClient.post(`/projects/${projectId}/upload/`, formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

export const fetchFiles = (projectId) => apiClient.get(`/projects/${projectId}/files/`);

export const fetchMessages = (projectId, sessionId) => apiClient.get(`/projects/${projectId}/sessions/${sessionId}/messages/`);

export const sendMessage = (projectId, sessionId, message) => apiClient.post(`/projects/${projectId}/sessions/${sessionId}/chat/`, { message });
