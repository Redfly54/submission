const BASE = 'https://story-api.dicoding.dev/v1';

export default class AddStoryModel {
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

  // Add a story (photo, description, lat, lon)
  async addStory({ photo, description, lat, lon }) {
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('description', description);
    if (lat && lon) {
      formData.append('lat', lat);
      formData.append('lon', lon);
    }

    // Send the story data to the backend API
    const res = await fetch(`${BASE}/stories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });

    // Check for response and return the result
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to add story');
    }

    return await res.json(); // return the response from the API
  }
}
