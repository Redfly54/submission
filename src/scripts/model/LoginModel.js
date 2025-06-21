const API_CONFIG = {
  development: 'https://story-api.dicoding.dev/v1',
  production: 'https://story-api.dicoding.dev/v1'
};

const BASE = 'https://story-api.dicoding.dev/v1';

export default class LoginModel {
  constructor() {
    this.token = localStorage.getItem('story_token') || null;
  }

  // Make a request to the API
  async request(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'omit' // Don't send credentials for CORS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Please check your internet connection');
    }
    throw error;
  }
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
