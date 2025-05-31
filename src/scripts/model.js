const BASE = 'https://story-api.dicoding.dev/v1';

export default {
  token: localStorage.getItem('story_token') || null,

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
  },

  // Ganti arrow function jadi method biasa:
  register(name, email, password) {
    return this.request('/register', {
      method: 'POST',
      body: { name, email, password }
    });
  },

  // login(email, password) {
  //   return this.request('/login', {
  //     method: 'POST',
  //     body: { email, password }
  //   }).then(data => {
  //     this.token = data.token;
  //      localStorage.setItem('story_token', data.token);
  //     return data;
  //   });
  // },

  async login(email, password) {
    // ini akan mengembalikan seluruh response JSON, termasuk field "loginResult"
    const res = await this.request('/login', {
      method: 'POST',
      body: { email, password }
    });

    // ambil token yang ada di res.loginResult.token
    const token = res.loginResult?.token;
    if (!token) throw new Error('Login gagal: token tidak ditemukan');

    // simpan ke memori & localStorage
    this.token = token;
    localStorage.setItem('story_token', token);

    // kembalikan juga data user kalau perlu
    return {
      userId: res.loginResult.userId,
      name:   res.loginResult.name,
      token,
    };
  },

  logout() {
    this.token = null;
    localStorage.removeItem('story_token');
  },

  // Stories
  getAllStories() {
    return this.request('/stories', { auth: true });
  },
  getStory(id) {
    return this.request(`/stories/${id}`, { auth: true });
  },
  addStory({ photo, description, lat, lon }) {
    const form = new FormData();
    form.append('photo', photo);
    form.append('description', description);
    if (lat && lon) {
      form.append('lat', lat);
      form.append('lon', lon);
    }
    return fetch(`${BASE}/stories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    }).then(r => r.json());
  },
};
