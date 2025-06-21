// Fixed IndexedDBManager.js - Enhanced user-driven storage
class IndexedDBManager {
  constructor() {
    this.dbName = 'DicodingStoryDB';
    this.version = 2;
    this.db = null;
    
    this.storeNames = {
      savedStories: 'saved_stories',
      likedStories: 'liked_stories',
      offlineStories: 'offline_stories',
      userPreferences: 'user_preferences'
    };
  }

  async init() {
    return new Promise((resolve, reject) => {
      // FIXED: Use correct indexedDB reference
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
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
        
        // Create stores if they don't exist
        Object.values(this.storeNames).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            
            // Add appropriate indexes
            if (storeName === this.storeNames.savedStories) {
              store.createIndex('savedAt', 'savedAt', { unique: false });
            } else if (storeName === this.storeNames.likedStories) {
              store.createIndex('likedAt', 'likedAt', { unique: false });
            } else if (storeName === this.storeNames.offlineStories) {
              store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }
            
            console.log(`📦 Created store: ${storeName}`);
          }
        });
      };
    });
  }

  // Saved Stories Methods
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

  // Liked Stories Methods
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

  // Offline Stories Methods
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

  // Combined Operations
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

  async clearUserData(category = 'all') {
    try {
      if (category === 'all') {
        const promises = Object.values(this.storeNames).map(storeName => 
          this._clearStore(storeName)
        );
        await Promise.all(promises);
      } else if (this.storeNames[category]) {
        await this._clearStore(this.storeNames[category]);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to clear user data:', error);
      return false;
    }
  }

  // Helper Methods
  async _saveToStore(storeName, data) {
    if (!this.db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.put(data);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`❌ Failed to save to ${storeName}`);
          resolve(false);
        };
      } catch (error) {
        console.error(`❌ Error saving to ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  async _removeFromStore(storeName, id) {
    if (!this.db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (error) {
        console.error(`❌ Error removing from ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  async _getAllFromStore(storeName) {
    if (!this.db) return [];

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
          console.error(`❌ Failed to get all from ${storeName}`);
          resolve([]);
        };
      } catch (error) {
        console.error(`❌ Error getting all from ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  async _getFromStore(storeName, id) {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (error) {
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
    if (!this.db) return false;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (error) {
        resolve(false);
      }
    });
  }
}

// Enhanced Story Offline Manager
class StoryOfflineManager {
  constructor() {
    this.dbManager = null;
    this.initialized = false;
  }

  async init() {
    try {
      if (window.IndexedDBManager && window.IndexedDBManager.db) {
        this.dbManager = window.IndexedDBManager;
        console.log('📱 Using existing IndexedDBManager');
      } else {
        this.dbManager = new IndexedDBManager();
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

  // FIXED: Ensure all required methods exist
  async getOfflineStories() {
    if (!this.dbManager) {
      console.warn('⚠️ DB Manager not available, returning empty array');
      return [];
    }
    try {
      return await this.dbManager.getOfflineStories();
    } catch (error) {
      console.error('❌ getOfflineStories failed:', error);
      return [];
    }
  }

  async cacheStories(stories) {
    if (!this.dbManager || !Array.isArray(stories)) {
      return false;
    }
    
    try {
      for (const story of stories) {
        await this.dbManager.downloadStoryForOffline(story);
      }
      return true;
    } catch (error) {
      console.error('❌ cacheStories failed:', error);
      return false;
    }
  }

  async hasOfflineData() {
    try {
      const stories = await this.getOfflineStories();
      return stories.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getOfflineInfo() {
    try {
      const stories = await this.getOfflineStories();
      const size = JSON.stringify(stories).length;
      
      return {
        count: stories.length,
        size: size,
        sizeFormatted: this.formatBytes(size),
        lastCached: stories.length > 0 ? stories[0].downloadedAt : null
      };
    } catch (error) {
      return {
        count: 0,
        size: 0,
        sizeFormatted: '0 Bytes',
        lastCached: null
      };
    }
  }

  async clearOfflineStories() {
    if (!this.dbManager) return false;
    return await this.dbManager.clearUserData('offlineStories');
  }

  // User Actions
  async saveStoryForLater(story) {
    if (!this.dbManager) return false;
    return await this.dbManager.saveStoryForLater(story);
  }

  async likeStory(story) {
    if (!this.dbManager) return false;
    return await this.dbManager.likeStory(story);
  }

  async downloadForOffline(story) {
    if (!this.dbManager) return false;
    return await this.dbManager.downloadStoryForOffline(story);
  }

  async downloadMultipleStories(stories, progressCallback) {
    if (!this.dbManager) return 0;

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

    return downloaded;
  }

  async getAllUserStories() {
    if (!this.dbManager) {
      return { saved: [], liked: [], offline: [], total: 0 };
    }
    return await this.dbManager.getAllUserStories();
  }

  async getStoryStatus(storyId) {
    if (!this.dbManager) {
      return { id: storyId, isSaved: false, isLiked: false, isOffline: false };
    }
    return await this.dbManager.getStoryStatus(storyId);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// FIXED: Proper global initialization
console.log('📦 Creating IndexedDB managers...');

// Create instances
const indexedDBManagerInstance = new IndexedDBManager();
const storyOfflineManagerInstance = new StoryOfflineManager();

// Initialize immediately when script loads
async function initializeManagers() {
  try {
    console.log('🚀 Initializing managers...');
    
    // Initialize IndexedDB first
    await indexedDBManagerInstance.init();
    
    // Then initialize StoryOfflineManager
    await storyOfflineManagerInstance.init();
    
    // Make available globally
    window.IndexedDBManager = indexedDBManagerInstance;
    window.StoryOfflineManager = storyOfflineManagerInstance;
    
    console.log('✅ All managers initialized successfully');
    
    // Dispatch custom event to notify other scripts
    window.dispatchEvent(new CustomEvent('managersReady'));
    
  } catch (error) {
    console.error('❌ Failed to initialize managers:', error);
    
    // Create fallback empty manager
    window.StoryOfflineManager = {
      initialized: false,
      getOfflineStories: async () => [],
      cacheStories: async () => false,
      hasOfflineData: async () => false,
      getOfflineInfo: async () => ({ count: 0, size: 0, sizeFormatted: '0 Bytes' }),
      clearOfflineStories: async () => false,
      getAllUserStories: async () => ({ saved: [], liked: [], offline: [], total: 0 }),
      getStoryStatus: async (id) => ({ id, isSaved: false, isLiked: false, isOffline: false })
    };
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeManagers);
} else {
  // DOM already loaded
  initializeManagers();
}

export { IndexedDBManager, StoryOfflineManager };
