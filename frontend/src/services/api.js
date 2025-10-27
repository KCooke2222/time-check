/**
 * API client for backend communication
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== AUTH ====================

export const authAPI = {
  login: async () => {
    const response = await apiClient.get('/auth/login');
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  getStatus: async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// ==================== CALENDAR ====================

export const calendarAPI = {
  list: async () => {
    const response = await apiClient.get('/calendar/list');
    return response.data;
  },

  discover: async () => {
    const response = await apiClient.get('/calendar/discover');
    return response.data;
  },

  add: async (calendarId, name) => {
    const response = await apiClient.post('/calendar/add', {
      calendar_id: calendarId,
      name: name,
    });
    return response.data;
  },

  toggle: async (calendarId) => {
    const response = await apiClient.put(`/calendar/${calendarId}/toggle`);
    return response.data;
  },

  delete: async (calendarId) => {
    const response = await apiClient.delete(`/calendar/${calendarId}`);
    return response.data;
  },

  sync: async (lookbackDays = 7) => {
    const response = await apiClient.post('/calendar/sync', {
      lookback_days: lookbackDays,
    });
    return response.data;
  },

  syncStats: async () => {
    const response = await apiClient.get('/calendar/sync/stats');
    return response.data;
  },
};

// ==================== REPORTS ====================

export const reportsAPI = {
  weekly: async (date = null) => {
    const params = date ? { date } : {};
    const response = await apiClient.get('/reports/weekly', { params });
    return response.data;
  },

  range: async (start, end) => {
    const response = await apiClient.get('/reports/range', {
      params: { start, end },
    });
    return response.data;
  },

  currentWeek: async () => {
    const response = await apiClient.get('/reports/current-week');
    return response.data;
  },
};

// ==================== CATEGORIES ====================

export const categoriesAPI = {
  // Sections
  listSections: async () => {
    const response = await apiClient.get('/categories/sections');
    return response.data;
  },

  createSection: async (name, parentId = null, displayOrder = 0) => {
    const response = await apiClient.post('/categories/sections', {
      name,
      parent_id: parentId,
      display_order: displayOrder,
    });
    return response.data;
  },

  updateSection: async (sectionId, data) => {
    const response = await apiClient.put(`/categories/sections/${sectionId}`, data);
    return response.data;
  },

  deleteSection: async (sectionId) => {
    const response = await apiClient.delete(`/categories/sections/${sectionId}`);
    return response.data;
  },

  // Categories
  listCategories: async (sectionId = null) => {
    const params = sectionId ? { section_id: sectionId } : {};
    const response = await apiClient.get('/categories/categories', { params });
    return response.data;
  },

  createCategory: async (name, sectionId, keywords, displayOrder = 0) => {
    const response = await apiClient.post('/categories/categories', {
      name,
      section_id: sectionId,
      keywords,
      display_order: displayOrder,
    });
    return response.data;
  },

  updateCategory: async (categoryId, data) => {
    const response = await apiClient.put(`/categories/categories/${categoryId}`, data);
    return response.data;
  },

  deleteCategory: async (categoryId) => {
    const response = await apiClient.delete(`/categories/categories/${categoryId}`);
    return response.data;
  },
};

// ==================== SETTINGS ====================

export const settingsAPI = {
  get: async () => {
    const response = await apiClient.get('/settings/');
    return response.data;
  },

  update: async (settings) => {
    const response = await apiClient.put('/settings/', settings);
    return response.data;
  },

  resetMultipliers: async () => {
    const response = await apiClient.post('/settings/reset-multipliers');
    return response.data;
  },
};

export default apiClient;
