const BASE = 'https://story-api.dicoding.dev/v1';

export default class LoginModel {
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

  // Login function for handling user login
  async login(email, password) {
    const res = await this.request('/login', {
      method: 'POST',
      body: { email, password },
    });

    // Extract token from the login result
    const token = res.loginResult?.token;
    if (!token) throw new Error('Login failed: Token not found');

    // Store token in memory and localStorage
    this.token = token;
    localStorage.setItem('story_token', token);

    // Return user data and token
    return {
      userId: res.loginResult.userId,
      name: res.loginResult.name,
      token,
    };
  }

  // Logout function to clear session
  logout() {
    this.token = null;
    localStorage.removeItem('story_token');
  }
}
