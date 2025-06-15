// IndexedDBManager.js - Complete implementation
class IndexedDBManager {
  constructor() {
    this.dbName = 'DicodingStoryDB';
    this.version = 1;
    this.db = null;
    this.storeName = 'stories';
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
        
        // Create stories object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id'
          });
          
          // Create indexes for better querying
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('lat', 'lat', { unique: false });
          objectStore.createIndex('lon', 'lon', { unique: false });
          
          console.log('📦 Object store created');
        }
      };
    });
  }

  async saveStory(story) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      
      const request = objectStore.put({
        ...story,
        cachedAt: new Date().toISOString()
      });

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error('❌ Failed to save story:', request.error);
        reject(false);
      };
    });
  }

  async saveStories(stories) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      
      // Clear existing stories first
      await this.clearStories();
      
      // Add all stories
      const promises = stories.map(story => {
        return new Promise((resolve, reject) => {
          const request = objectStore.add({
            ...story,
            cachedAt: new Date().toISOString()
          });
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.all(promises);
      console.log(`💾 Saved ${stories.length} stories to IndexedDB`);
      return true;
    } catch (error) {
      console.error('❌ Failed to save stories:', error);
      return false;
    }
  }

  async getAllStories() {
    if (!this.db) {
      console.error('Database not initialized');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const stories = request.result || [];
        console.log(`📱 Retrieved ${stories.length} stories from IndexedDB`);
        resolve(stories);
      };

      request.onerror = () => {
        console.error('❌ Failed to get stories:', request.error);
        reject([]);
      };
    });
  }

  async getStoryById(id) {
    if (!this.db) {
      console.error('Database not initialized');
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('❌ Failed to get story:', request.error);
        reject(null);
      };
    });
  }

  async clearStories() {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('🗑️ All stories cleared from IndexedDB');
        resolve(true);
      };

      request.onerror = () => {
        console.error('❌ Failed to clear stories:', request.error);
        reject(false);
      };
    });
  }

  async hasData() {
    if (!this.db) {
      return false;
    }

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  async getStorageInfo() {
    if (!this.db) {
      return { count: 0, size: 0 };
    }

    try {
      const stories = await this.getAllStories();
      const size = JSON.stringify(stories).length;
      
      return {
        count: stories.length,
        size: size,
        sizeFormatted: this.formatBytes(size),
        lastCached: stories.length > 0 ? stories[0].cachedAt : null
      };
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return { count: 0, size: 0 };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Story Offline Manager - Specific to your app
class StoryOfflineManager {
  constructor() {
    this.dbManager = new IndexedDBManager();
  }

  async init() {
    return await this.dbManager.init();
  }

  async cacheStories(stories) {
    try {
      const success = await this.dbManager.saveStories(stories);
      if (success) {
        this.notifyDataCached(stories.length);
      }
      return success;
    } catch (error) {
      console.error('❌ Cache stories failed:', error);
      return false;
    }
  }

  async getOfflineStories() {
    try {
      return await this.dbManager.getAllStories();
    } catch (error) {
      console.error('❌ Get offline stories failed:', error);
      return [];
    }
  }

  async clearOfflineStories() {
    try {
      const success = await this.dbManager.clearStories();
      if (success) {
        this.notifyDataCleared();
      }
      return success;
    } catch (error) {
      console.error('❌ Clear offline stories failed:', error);
      return false;
    }
  }

  async hasOfflineData() {
    try {
      return await this.dbManager.hasData();
    } catch (error) {
      console.error('❌ Check offline data failed:', error);
      return false;
    }
  }

  async getOfflineInfo() {
    return await this.dbManager.getStorageInfo();
  }

  // Notification methods
  notifyDataCached(count) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Stories Cached', {
        body: `${count} stories saved for offline viewing`,
        icon: 'ios/72.png',
        tag: 'cache-update'
      });
    }
    console.log(`📱 ${count} stories cached for offline use`);
  }

  notifyDataCleared() {
    console.log('🗑️ Offline stories cleared');
  }

  // Sync methods for when back online
  async syncWithServer() {
    // This would be implemented based on your API
    console.log('🔄 Syncing with server...');
    // Implementation depends on your server API
  }
}

// Initialize global managers
window.IndexedDBManager = new IndexedDBManager();
window.StoryOfflineManager = new StoryOfflineManager();

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.IndexedDBManager.init();
    await window.StoryOfflineManager.init();
    console.log('✅ Offline storage managers initialized');
  } catch (error) {
    console.error('❌ Failed to initialize offline storage:', error);
  }
});

export { IndexedDBManager, StoryOfflineManager };
