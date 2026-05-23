import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (username: string, password: string) =>
  api.post('/api/auth/login', new URLSearchParams({ username, password }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

export const getMe = () => api.get('/api/auth/me');

// Incidents
export const getIncidents = (params?: any) => api.get('/api/incidents/', { params });
export const getPendingIncidents = () => api.get('/api/incidents/pending');
export const getIncident = (id: string) => api.get(`/api/incidents/${id}`);
export const reviewIncident = (id: string, data: any) => api.post(`/api/incidents/${id}/review`, data);
export const getIncidentStats = () => api.get('/api/incidents/stats');

// Alerts
export const getActiveAlerts = () => api.get('/api/alerts/active');
export const getAlert = (id: string) => api.get(`/api/alerts/${id}`);
export const acknowledgeAlert = (id: string) => api.post(`/api/alerts/${id}/acknowledge`);
export const takeAlertAction = (id: string, data: any) => api.post(`/api/alerts/${id}/action`, data);

// Persons
export const getPersons = (params?: any) => api.get('/api/persons/', { params });
export const getPerson = (id: string) => api.get(`/api/persons/${id}`);
export const getOffenders = () => api.get('/api/persons/offenders');
export const getBlacklist = () => api.get('/api/persons/blacklist');
export const updatePerson = (id: string, data: any) => api.patch(`/api/persons/${id}`, data);
export const blacklistPerson = (id: string) => api.post(`/api/persons/${id}/blacklist`);
export const getPersonSightings = (id: string) => api.get(`/api/persons/${id}/sightings`);

// Cameras
export const getCameras = () => api.get('/api/cameras/');
export const createCamera = (data: any) => api.post('/api/cameras/', data);

// WebSocket for alerts
export const createAlertWebSocket = (): WebSocket => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsHost = API_BASE ? new URL(API_BASE).host : window.location.host;
  return new WebSocket(`${wsProtocol}://${wsHost}/api/alerts/ws`);
};

export default api;
