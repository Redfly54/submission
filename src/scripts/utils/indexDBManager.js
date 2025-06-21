// Enhanced IndexedDBManager.js - User-driven storage
class IndexDBManager {
  constructor() {
    this.dbName = 'DicodingStoryDB';
    this.version = 2; // Increment version for schema changes
    this.db = null;
    
    // Multiple storage categories
    this.storeNames = {
      savedStories: 'saved_stories',      // User bookmarks
      likedStories: 'liked_stories',      // User favorites  
      offlineStories: 'offline_stories',  // Manual downloads
      userPreferences: 'user_preferences' // App settings
    };
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ IndexedDB initialization failed');
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create saved stories store (user bookmarks)
        if (!db.objectStoreNames.contains(this.storeNames.savedStories)) {
          const savedStore = db.createObjectStore(this.storeNames.savedStories, {
            keyPath: 'id'
          });
          savedStore.createIndex('savedAt', 'savedAt', { unique: false });
          savedStore.createIndex('name', 'name', { unique: false });
        }

        // Create liked stories store  
        if (!db.objectStoreNames.contains(this.storeNames.likedStories)) {
          const likedStore = db.createObjectStore(this.storeNames.likedStories, {
            keyPath: 'id'
          });
          likedStore.createIndex('likedAt', 'likedAt', { unique: false });
        }

        // Create offline stories store (manual downloads)
        if (!db.objectStoreNames.contains(this.storeNames.offlineStories)) {
          const offlineStore = db.createObjectStore(this.storeNames.offlineStories, {
            keyPath: 'id'
          });
          offlineStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }

        // Create user preferences store
        if (!db.objectStoreNames.contains(this.storeNames.userPreferences)) {
          db.createObjectStore(this.storeNames.userPreferences, {
            keyPath: 'key'
          });
        }

        console.log('📦 Enhanced object stores created');
      };
    });
  }

  // ====== SAVED STORIES (Bookmarks) ======
  async saveStoryForLater(story) {
    return this._saveToStore(this.storeNames.savedStories, {
      ...story,
      savedAt: new Date().toISOString(),
      category: 'saved'
    });
  }

  async removeSavedStory(storyId) {
    return this._removeFromStore(this.storeNames.savedStories, storyId);
  }

  async getSavedStories() {
    return this._getAllFromStore(this.storeNames.savedStories);
  }

  async isStorySaved(storyId) {
    return this._existsInStore(this.storeNames.savedStories, storyId);
  }

  // ====== LIKED STORIES (Favorites) ======
  async likeStory(story) {
    return this._saveToStore(this.storeNames.likedStories, {
      ...story,
      likedAt: new Date().toISOString(),
      category: 'liked'
    });
  }

  async unlikeStory(storyId) {
    return this._removeFromStore(this.storeNames.likedStories, storyId);
  }

  async getLikedStories() {
    return this._getAllFromStore(this.storeNames.likedStories);
  }

  async isStoryLiked(storyId) {
    return this._existsInStore(this.storeNames.likedStories, storyId);
  }

  // ====== OFFLINE STORIES (Manual Downloads) ======
  async downloadStoryForOffline(story) {
    return this._saveToStore(this.storeNames.offlineStories, {
      ...story,
      downloadedAt: new Date().toISOString(),
      category: 'offline'
    });
  }

  async removeOfflineStory(storyId) {
    return this._removeFromStore(this.storeNames.offlineStories, storyId);
  }

  async getOfflineStories() {
    return this._getAllFromStore(this.storeNames.offlineStories);
  }

  async isStoryOffline(storyId) {
    return this._existsInStore(this.storeNames.offlineStories, storyId);
  }

  // Download multiple stories for offline
  async downloadMultipleStories(stories) {
    try {
      const promises = stories.map(story => this.downloadStoryForOffline(story));
      await Promise.all(promises);
      console.log(`💾 Downloaded ${stories.length} stories for offline`);
      return true;
    } catch (error) {
      console.error('❌ Failed to download multiple stories:', error);
      return false;
    }
  }

  // ====== USER PREFERENCES ======
  async saveUserPreference(key, value) {
    return this._saveToStore(this.storeNames.userPreferences, {
      key: key,
      value: value,
      updatedAt: new Date().toISOString()
    });
  }

  async getUserPreference(key, defaultValue = null) {
    try {
      const pref = await this._getFromStore(this.storeNames.userPreferences, key);
      return pref ? pref.value : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  // ====== COMBINED OPERATIONS ======
  async getAllUserStories() {
    try {
      const [saved, liked, offline] = await Promise.all([
        this.getSavedStories(),
        this.getLikedStories(), 
        this.getOfflineStories()
      ]);

      return {
        saved: saved || [],
        liked: liked || [],
        offline: offline || [],
        total: (saved?.length || 0) + (liked?.length || 0) + (offline?.length || 0)
      };
    } catch (error) {
      console.error('❌ Failed to get all user stories:', error);
      return { saved: [], liked: [], offline: [], total: 0 };
    }
  }

  async getStoryStatus(storyId) {
    try {
      const [isSaved, isLiked, isOffline] = await Promise.all([
        this.isStorySaved(storyId),
        this.isStoryLiked(storyId),
        this.isStoryOffline(storyId)
      ]);

      return {
        id: storyId,
        isSaved,
        isLiked, 
        isOffline,
        hasAnyStatus: isSaved || isLiked || isOffline
      };
    } catch (error) {
      console.error('❌ Failed to get story status:', error);
      return {
        id: storyId,
        isSaved: false,
        isLiked: false,
        isOffline: false,
        hasAnyStatus: false
      };
    }
  }

  // ====== STORAGE MANAGEMENT ======
  async getDetailedStorageInfo() {
    try {
      const userStories = await this.getAllUserStories();
      
      const saved = userStories.saved;
      const liked = userStories.liked;
      const offline = userStories.offline;

      const calculateSize = (items) => {
        return JSON.stringify(items).length;
      };

      return {
        counts: {
          saved: saved.length,
          liked: liked.length,
          offline: offline.length,
          total: userStories.total
        },
        sizes: {
          saved: this.formatBytes(calculateSize(saved)),
          liked: this.formatBytes(calculateSize(liked)),
          offline: this.formatBytes(calculateSize(offline)),
          total: this.formatBytes(calculateSize([...saved, ...liked, ...offline]))
        },
        lastUpdated: {
          saved: saved.length > 0 ? saved[0].savedAt : null,
          liked: liked.length > 0 ? liked[0].likedAt : null,
          offline: offline.length > 0 ? offline[0].downloadedAt : null
        }
      };
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return { counts: {}, sizes: {}, lastUpdated: {} };
    }
  }

  async clearUserData(category = 'all') {
    try {
      if (category === 'all') {
        const promises = Object.values(this.storeNames).map(storeName => 
          this._clearStore(storeName)
        );
        await Promise.all(promises);
        console.log('🗑️ All user data cleared');
      } else if (this.storeNames[category]) {
        await this._clearStore(this.storeNames[category]);
        console.log(`🗑️ ${category} data cleared`);
      } else {
        throw new Error(`Unknown category: ${category}`);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to clear user data:', error);
      return false;
    }
  }

  // ====== HELPER METHODS ======
  async _saveToStore(storeName, data) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.put(data);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`❌ Failed to save to ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  async _removeFromStore(storeName, id) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`❌ Failed to remove from ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  async _getAllFromStore(storeName) {
    if (!this.db) {
      console.error('Database not initialized');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error(`❌ Failed to get all from ${storeName}:`, request.error);
        reject([]);
      };
    });
  }

  async _getFromStore(storeName, id) {
    if (!this.db) {
      console.error('Database not initialized');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error(`❌ Failed to get from ${storeName}:`, request.error);
        reject(null);
      };
    });
  }

  async _existsInStore(storeName, id) {
    try {
      const item = await this._getFromStore(storeName, id);
      return !!item;
    } catch (error) {
      return false;
    }
  }

  async _clearStore(storeName) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const objectStore = transaction.objectStore(storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`❌ Failed to clear ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  // Keep existing utility methods
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Enhanced Story Offline Manager with user-driven approach
class StoryOfflineManager {
  constructor() {
    this.dbManager = new IndexDBManager();
  }

  async init() {
    return await this.dbManager.init();
  }

  // ====== USER ACTIONS ======
  async saveStoryForLater(story) {
    const success = await this.dbManager.saveStoryForLater(story);
    if (success) {
      this.notifyUser(`📚 "${story.name}" disimpan untuk dibaca nanti`);
    }
    return success;
  }

  async likeStory(story) {
    const success = await this.dbManager.likeStory(story);
    if (success) {
      this.notifyUser(`❤️ "${story.name}" ditambahkan ke favorit`);
    }
    return success;
  }

  async downloadForOffline(story) {
    const success = await this.dbManager.downloadStoryForOffline(story);
    if (success) {
      this.notifyUser(`📱 "${story.name}" tersedia offline`);
    }
    return success;
  }

  async downloadMultipleStories(stories, progressCallback) {
    let downloaded = 0;
    const total = stories.length;

    for (const story of stories) {
      try {
        await this.dbManager.downloadStoryForOffline(story);
        downloaded++;
        
        if (progressCallback) {
          progressCallback(downloaded, total);
        }
      } catch (error) {
        console.error(`Failed to download story ${story.id}:`, error);
      }
    }

    this.notifyUser(`📱 ${downloaded}/${total} cerita berhasil diunduh untuk offline`);
    return downloaded;
  }

  // ====== USER PREFERENCES ======
  async setAutoSaveLiked(enabled) {
    return await this.dbManager.saveUserPreference('autoSaveLiked', enabled);
  }

  async getAutoSaveLiked() {
    return await this.dbManager.getUserPreference('autoSaveLiked', false);
  }

  async setOfflineMode(enabled) {
    return await this.dbManager.saveUserPreference('offlineMode', enabled);
  }

  async getOfflineMode() {
    return await this.dbManager.getUserPreference('offlineMode', false);
  }

  // ====== GETTERS ======
  async getAllUserStories() {
    return await this.dbManager.getAllUserStories();
  }

  async getStoryStatus(storyId) {
    return await this.dbManager.getStoryStatus(storyId);
  }

  async getStorageInfo() {
    return await this.dbManager.getDetailedStorageInfo();
  }

  // ====== UTILITIES ======
  notifyUser(message) {
    console.log(`📢 ${message}`);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Dicoding Story', {
        body: message,
        icon: 'ios/72.png',
        tag: 'user-action'
      });
    }
  }

  async exportUserData() {
    try {
      const userStories = await this.getAllUserStories();
      const preferences = {
        autoSaveLiked: await this.getAutoSaveLiked(),
        offlineMode: await this.getOfflineMode()
      };

      const exportData = {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        userStories,
        preferences
      };

      return exportData;
    } catch (error) {
      console.error('❌ Export failed:', error);
      return null;
    }
  }

  async clearAllUserData() {
    return await this.dbManager.clearUserData('all');
  }
}

// Global instances
window.IndexDBManager = new IndexDBManager();
window.StoryOfflineManager = new StoryOfflineManager();

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.IndexedDBManager.init();
    await window.StoryOfflineManager.init();
    console.log('✅ Enhanced offline storage managers initialized');
  } catch (error) {
    console.error('❌ Failed to initialize enhanced offline storage:', error);
  }
});

export { IndexDBManager, StoryOfflineManager };
