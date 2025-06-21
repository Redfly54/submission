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
      // Use explicit indexedDB reference
      const IDBFactory = window.indexDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
      if (!IDBFactory) {
        console.error('❌ IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = IDBFactory.open(this.dbName, this.version);

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
          console.log('📚 Created saved stories store');
        }

        // Create liked stories store  
        if (!db.objectStoreNames.contains(this.storeNames.likedStories)) {
          const likedStore = db.createObjectStore(this.storeNames.likedStories, {
            keyPath: 'id'
          });
          likedStore.createIndex('likedAt', 'likedAt', { unique: false });
          console.log('❤️ Created liked stories store');
        }

        // Create offline stories store (manual downloads)
        if (!db.objectStoreNames.contains(this.storeNames.offlineStories)) {
          const offlineStore = db.createObjectStore(this.storeNames.offlineStories, {
            keyPath: 'id'
          });
          offlineStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
          console.log('📱 Created offline stories store');
        }

        // Create user preferences store
        if (!db.objectStoreNames.contains(this.storeNames.userPreferences)) {
          db.createObjectStore(this.storeNames.userPreferences, {
            keyPath: 'key'
          });
          console.log('⚙️ Created preferences store');
        }

        console.log('📦 Enhanced object stores created');
      };
    });
  }

  // ====== SAVED STORIES (Bookmarks) ======
  async saveStoryForLater(story) {
    console.log('💾 Saving story for later:', story.name);
    return this._saveToStore(this.storeNames.savedStories, {
      ...story,
      savedAt: new Date().toISOString(),
      category: 'saved'
    });
  }

  async removeSavedStory(storyId) {
    console.log('🗑️ Removing saved story:', storyId);
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
    console.log('❤️ Liking story:', story.name);
    return this._saveToStore(this.storeNames.likedStories, {
      ...story,
      likedAt: new Date().toISOString(),
      category: 'liked'
    });
  }

  async unlikeStory(storyId) {
    console.log('💔 Unliking story:', storyId);
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
    console.log('📱 Downloading story for offline:', story.name);
    return this._saveToStore(this.storeNames.offlineStories, {
      ...story,
      downloadedAt: new Date().toISOString(),
      category: 'offline'
    });
  }

  async removeOfflineStory(storyId) {
    console.log('📱❌ Removing offline story:', storyId);
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
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(data);

        request.onsuccess = () => {
          console.log(`✅ Saved to ${storeName}:`, data.name || data.id);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to save to ${storeName}:`, request.error);
          reject(false);
        };

        transaction.onerror = () => {
          console.error(`❌ Transaction failed for ${storeName}:`, transaction.error);
          reject(false);
        };
      } catch (error) {
        console.error(`❌ Error saving to ${storeName}:`, error);
        reject(false);
      }
    });
  }

  async _removeFromStore(storeName, id) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.delete(id);

        request.onsuccess = () => {
          console.log(`✅ Removed from ${storeName}:`, id);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to remove from ${storeName}:`, request.error);
          reject(false);
        };
      } catch (error) {
        console.error(`❌ Error removing from ${storeName}:`, error);
        reject(false);
      }
    });
  }

  async _getAllFromStore(storeName) {
    if (!this.db) {
      console.error('Database not initialized');
      return [];
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => {
          const result = request.result || [];
          console.log(`📖 Retrieved ${result.length} items from ${storeName}`);
          resolve(result);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to get all from ${storeName}:`, request.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error(`❌ Error getting all from ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  async _getFromStore(storeName, id) {
    if (!this.db) {
      console.error('Database not initialized');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
          console.error(`❌ Failed to get from ${storeName}:`, request.error);
          resolve(null); // Return null instead of rejecting
        };
      } catch (error) {
        console.error(`❌ Error getting from ${storeName}:`, error);
        resolve(null);
      }
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
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.clear();

        request.onsuccess = () => {
          console.log(`🧹 Cleared ${storeName}`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to clear ${storeName}:`, request.error);
          reject(false);
        };
      } catch (error) {
        console.error(`❌ Error clearing ${storeName}:`, error);
        reject(false);
      }
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
    this.dbManager = null;
    this.initialized = false;
  }

  async init() {
    try {
      if (window.IndexDBManager) {
        this.dbManager = window.IndexDBManager;
        console.log('📱 Using existing IndexedDBManager');
      } else {
        this.dbManager = new IndexDBManager();
        await this.dbManager.init();
        console.log('📱 Created new IndexedDBManager');
      }
      
      this.initialized = true;
      console.log('✅ StoryOfflineManager initialized');
      return true;
    } catch (error) {
      console.error('❌ StoryOfflineManager init failed:', error);
      this.initialized = false;
      return false;
    }
  }

  async getOfflineStories() {
    if (!this.dbManager) {
      return [];
    }
    return await this.dbManager.getOfflineStories();
  }

  // TAMBAHKAN METHOD INI JUGA:
  async hasOfflineData() {
    const stories = await this.getOfflineStories();
    return stories.length > 0;
  }

  // TAMBAHKAN METHOD INI:
  async getOfflineInfo() {
    const stories = await this.getOfflineStories();
    return {
      count: stories.length,
      size: JSON.stringify(stories).length,
      sizeFormatted: this.formatBytes(JSON.stringify(stories).length),
      lastCached: stories.length > 0 ? stories[0].downloadedAt : null
    };
  }

  // TAMBAHKAN METHOD INI:
  async cacheStories(stories) {
    if (!this.dbManager) return false;
    
    try {
      for (const story of stories) {
        await this.dbManager.downloadStoryForOffline(story);
      }
      return true;
    } catch (error) {
      console.error('Cache stories failed:', error);
      return false;
    }
  }

  // TAMBAHKAN METHOD INI:
  async clearOfflineStories() {
    if (!this.dbManager) return false;
    return await this.dbManager.clearUserData('offline');
  }

  // TAMBAHKAN UTILITY METHOD:
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ====== USER ACTIONS ======
  async saveStoryForLater(story) {
    if (!this.initialized || !this.dbManager) {
      console.error('StoryOfflineManager not initialized');
      return false;
    }

    const success = await this.dbManager.saveStoryForLater(story);
    if (success) {
      this.notifyUser(`📚 "${story.name}" disimpan untuk dibaca nanti`);
    }
    return success;
  }

  async likeStory(story) {
    if (!this.initialized || !this.dbManager) {
      console.error('StoryOfflineManager not initialized');
      return false;
    }

    const success = await this.dbManager.likeStory(story);
    if (success) {
      this.notifyUser(`❤️ "${story.name}" ditambahkan ke favorit`);
    }
    return success;
  }

  async downloadForOffline(story) {
    if (!this.initialized || !this.dbManager) {
      console.error('StoryOfflineManager not initialized');
      return false;
    }

    const success = await this.dbManager.downloadStoryForOffline(story);
    if (success) {
      this.notifyUser(`📱 "${story.name}" tersedia offline`);
    }
    return success;
  }

  async downloadMultipleStories(stories, progressCallback) {
    if (!this.initialized || !this.dbManager) {
      console.error('StoryOfflineManager not initialized');
      return 0;
    }

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
    if (!this.dbManager) return false;
    return await this.dbManager.saveUserPreference('autoSaveLiked', enabled);
  }

  async getAutoSaveLiked() {
    if (!this.dbManager) return false;
    return await this.dbManager.getUserPreference('autoSaveLiked', false);
  }

  async setOfflineMode(enabled) {
    if (!this.dbManager) return false;
    return await this.dbManager.saveUserPreference('offlineMode', enabled);
  }

  async getOfflineMode() {
    if (!this.dbManager) return false;
    return await this.dbManager.getUserPreference('offlineMode', false);
  }

  // ====== GETTERS ======
  async getAllUserStories() {
    if (!this.dbManager) {
      return { saved: [], liked: [], offline: [], total: 0 };
    }
    return await this.dbManager.getAllUserStories();
  }

  async getStoryStatus(storyId) {
    if (!this.dbManager) {
      return { id: storyId, isSaved: false, isLiked: false, isOffline: false, hasAnyStatus: false };
    }
    return await this.dbManager.getStoryStatus(storyId);
  }

  async getStorageInfo() {
    if (!this.dbManager) {
      return { counts: {}, sizes: {}, lastUpdated: {} };
    }
    return await this.dbManager.getDetailedStorageInfo();
  }

  // ====== UTILITIES ======
  notifyUser(message) {
    console.log(`📢 ${message}`);
    
    // Try different notification methods
    if (window.PWAIntegration) {
      window.PWAIntegration.showSuccess(message);
    } else if ('Notification' in window && Notification.permission === 'granted') {
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
    if (!this.dbManager) return false;
    return await this.dbManager.clearUserData('all');
  }
}

// FIXED: Initialize global instances properly
console.log('📦 Creating IndexedDB managers...');

// Create and export instances
const indexDBManagerInstance = new IndexDBManager();
const storyOfflineManagerInstance = new StoryOfflineManager();

// Make them available globally 
window.IndexDBManager = indexDBManagerInstance;
window.StoryOfflineManager = storyOfflineManagerInstance;

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Initializing enhanced offline storage managers...');
    
    await indexDBManagerInstance.init();
    await storyOfflineManagerInstance.init();
    
    console.log('✅ Enhanced offline storage managers initialized');
  } catch (error) {
    console.error('❌ Failed to initialize enhanced offline storage:', error);
  }
  setTimeout(() => {
    if (window.StoryOfflineManager) {
      console.log('🔧 Adding method aliases...');
      
      // Ensure all required methods exist
      const requiredMethods = {
        'getOfflineStories': async function() {
          return await this.dbManager?.getOfflineStories() || [];
        },
        'cacheStories': async function(stories) {
          if (!stories || !Array.isArray(stories)) return false;
          try {
            for (const story of stories) {
              await this.dbManager?.downloadStoryForOffline(story);
            }
            return true;
          } catch (error) {
            console.error('Cache stories error:', error);
            return false;
          }
        },
        'hasOfflineData': async function() {
          const stories = await this.getOfflineStories();
          return stories.length > 0;
        },
        'getOfflineInfo': async function() {
          const stories = await this.getOfflineStories();
          return {
            count: stories.length,
            size: JSON.stringify(stories).length,
            lastCached: stories.length > 0 ? stories[0].downloadedAt : null
          };
        },
        'clearOfflineStories': async function() {
          return await this.dbManager?.clearUserData('offline') || false;
        }
      };

      // Add missing methods
      for (const [methodName, methodFunc] of Object.entries(requiredMethods)) {
        if (!window.StoryOfflineManager[methodName]) {
          window.StoryOfflineManager[methodName] = methodFunc.bind(window.StoryOfflineManager);
          console.log(`✅ Added method: ${methodName}`);
        }
      }

      console.log('🔧 Method check complete. Available methods:');
      console.log(Object.getOwnPropertyNames(window.StoryOfflineManager));
    }
  }, 500);
});

export { IndexDBManager, StoryOfflineManager };
