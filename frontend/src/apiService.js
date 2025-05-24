import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api'; // Adjust if your backend runs elsewhere

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Handle 401 responses by removing invalid token
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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

// Authentication functions
export const login = (username, password) => apiClient.post('/login/', { username, password });

export const logout = () => apiClient.post('/logout/');

export const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};
