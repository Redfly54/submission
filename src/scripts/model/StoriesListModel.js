const BASE = 'https://story-api.dicoding.dev/v1';

export default class StoriesListModel {
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

  // Fetch all stories from the API
  async getAllStories() {
    const res = await this.request('/stories', { auth: true });
    return res;  // Return the stories list
  }
}
