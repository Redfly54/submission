// scripts/utils/indexedDB.js
// Simple wrapper that uses the global IndexedDB manager from index.html

const indexedDB = {
  async init() {
    // Initialize from global manager
    if (window.IndexedDBManager && !window.IndexedDBManager.db) {
      return await window.IndexedDBManager.init();
    }
    return Promise.resolve();
  },

  // 1. MENYIMPAN data
  async saveStories(stories) {
    if (window.StoryOfflineManager) {
      return await window.StoryOfflineManager.cacheStories(stories);
    }
    console.warn('StoryOfflineManager not available');
    return false;
  },

  // 2. MENAMPILKAN data
  async getAllStories() {
    if (window.StoryOfflineManager) {
      return await window.StoryOfflineManager.getOfflineStories();
    }
    console.warn('StoryOfflineManager not available');
    return [];
  },

  // 3. MENGHAPUS data
  async clearAll() {
    if (window.StoryOfflineManager) {
      return await window.StoryOfflineManager.clearOfflineStories();
    }
    console.warn('StoryOfflineManager not available');
    return false;
  },

  // Helper method
  async isDataAvailable() {
    if (window.StoryOfflineManager) {
      return await window.StoryOfflineManager.hasOfflineData();
    }
    return false;
  }
};

export default indexedDB;