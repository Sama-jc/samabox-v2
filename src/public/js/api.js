export async function apiRequest(endpoint, options = {}) {
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (res.status === 204) {
    return true;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || `HTTP error ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Dashboard Summary
  async getDashboardSummary(date) {
    const url = date ? `/api/dashboard/summary?date=${encodeURIComponent(date)}` : '/api/dashboard/summary';
    return apiRequest(url);
  },

  // Daily Security Briefing
  async getBriefing(date) {
    const url = date ? `/api/briefing?date=${encodeURIComponent(date)}` : '/api/briefing';
    return apiRequest(url);
  },

  async refreshBriefing(date) {
    return apiRequest('/api/briefing/refresh', {
      method: 'POST',
      body: JSON.stringify({ date })
    });
  },

  // Agenda
  async getMeetings(date) {
    const url = date ? `/api/meetings?date=${encodeURIComponent(date)}` : '/api/meetings';
    return apiRequest(url);
  },

  async createMeeting(meetingData) {
    return apiRequest('/api/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData)
    });
  },

  async updateMeeting(id, meetingData) {
    return apiRequest(`/api/meetings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(meetingData)
    });
  },

  async deleteMeeting(id) {
    return apiRequest(`/api/meetings/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  // Tasks
  async getTasks(date, filters = {}) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.isFocus !== undefined) params.set('isFocus', String(filters.isFocus));

    const qs = params.toString();
    const url = qs ? `/api/tasks?${qs}` : '/api/tasks';
    return apiRequest(url);
  },

  async createTask(taskData) {
    return apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, patchData) {
    return apiRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData)
    });
  },

  async deleteTask(id) {
    return apiRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};
