const API_BASE_URL = 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('ble_notice_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Auth
  async login(usernameOrEmail, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async register(userData) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch user');
    return data;
  },

  // Notices
  async getNotices(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/notices?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch notices');
    return data;
  },

  async getActiveNotices() {
    const res = await fetch(`${API_BASE_URL}/notices/active`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch active notices');
    return data;
  },

  async createNotice(noticeData) {
    const res = await fetch(`${API_BASE_URL}/notices`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(noticeData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create notice');
    return data;
  },

  async updateNotice(id, noticeData) {
    const res = await fetch(`${API_BASE_URL}/notices/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(noticeData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update notice');
    return data;
  },

  async deleteNotice(id) {
    const res = await fetch(`${API_BASE_URL}/notices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete notice');
    return data;
  },

  async syncNoticeToBLE(id, deviceName = 'ESP32 SSD1306 OLED Board') {
    const res = await fetch(`${API_BASE_URL}/notices/${id}/sync-ble`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ deviceName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync notice');
    return data;
  },

  // Dashboard Stats & Audit Logs
  async getStats() {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch dashboard stats');
    return data;
  },

  async getLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/dashboard/logs?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch audit logs');
    return data;
  },
};
