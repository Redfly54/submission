const BASE = 'https://story-api.dicoding.dev/v1';

export default class RegisterModel {
  constructor() {
    this.token = localStorage.getItem('story_token') || null;
  }

  // Make a request to the API
  async request(endpoint, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API Error');
    return data;
  }

  // Register function for handling user registration
  async register(name, email, password) {
    const res = await this.request('/register', {
      method: 'POST',
      body: { name, email, password },
    });

    // Return the full response since API only returns {error: false, message: "User Created"}
    return res;
  }
}