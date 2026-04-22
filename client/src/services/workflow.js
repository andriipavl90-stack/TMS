import apiClient from './axios';

export const getWorkflowChartData = (params = {}) =>
  apiClient.get('/workflow/chart', { params });

export const getWorkflowUsers = () =>
  apiClient.get('/workflow/users');

export const addWorkflowTime = (payload) =>
  apiClient.post('/workflow/add-time', payload);
