// storyStorage.js - Fixed to avoid conflict with native indexedDB
const storyStorage = {
  async init() {
    // Initialize from global manager
    if (window.IndexedDBManager && !window.IndexedDBManager.db) {
      return await window.IndexedDBManager.init();
    }
    
    if (window.StoryOfflineManager) {
      return await window.StoryOfflineManager.init();
    }
    
    console.warn('⚠️ IndexedDB managers not loaded yet');
    return Promise.resolve();
  },

  // 1. MENYIMPAN data
  async saveStories(stories) {
    try {
      if (window.StoryOfflineManager) {
        return await window.StoryOfflineManager.cacheStories(stories);
      }
      
      // Fallback if manager not available
      console.warn('⚠️ StoryOfflineManager not available, using fallback');
      return await this._fallbackSaveStories(stories);
    } catch (error) {
      console.error('❌ saveStories failed:', error);
      return false;
    }
  },

  // 2. MENAMPILKAN data
  async getAllStories() {
    try {
      if (window.StoryOfflineManager) {
        return await window.StoryOfflineManager.getOfflineStories();
      }
      
      // Fallback if manager not available
      console.warn('⚠️ StoryOfflineManager not available, using fallback');
      return await this._fallbackGetStories();
    } catch (error) {
      console.error('❌ getAllStories failed:', error);
      return [];
    }
  },

  // 3. MENGHAPUS data
  async clearAll() {
    try {
      if (window.StoryOfflineManager) {
        return await window.StoryOfflineManager.clearOfflineStories();
      }
      
      // Fallback if manager not available
      console.warn('⚠️ StoryOfflineManager not available, using fallback');
      return await this._fallbackClearStories();
    } catch (error) {
      console.error('❌ clearAll failed:', error);
      return false;
    }
  },

  // Helper method
  async isDataAvailable() {
    try {
      if (window.StoryOfflineManager) {
        return await window.StoryOfflineManager.hasOfflineData();
      }
      
      // Fallback check
      const stories = await this.getAllStories();
      return stories.length > 0;
    } catch (error) {
      console.error('❌ isDataAvailable failed:', error);
      return false;
    }
  },

  // Get storage information
  async getStorageInfo() {
    try {
      if (window.StoryOfflineManager) {
        return await window.StoryOfflineManager.getOfflineInfo();
      }
      
      // Fallback info
      const stories = await this.getAllStories();
      return {
        count: stories.length,
        size: JSON.stringify(stories).length,
        sizeFormatted: this._formatBytes(JSON.stringify(stories).length),
        lastCached: stories.length > 0 ? new Date().toISOString() : null
      };
    } catch (error) {
      console.error('❌ getStorageInfo failed:', error);
      return { count: 0, size: 0, sizeFormatted: '0 Bytes' };
    }
  },

  // FALLBACK METHODS - CRITICAL FIX: Use explicit window.indexedDB
  async _fallbackSaveStories(stories) {
    return new Promise((resolve) => {
      // CRITICAL: Use window.indexedDB explicitly to avoid conflict
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
      if (!IDBFactory) {
        console.error('❌ IndexedDB not supported');
        resolve(false);
        return;
      }
      
      const request = IDBFactory.open('DicodingStoryDB', 1);
      
      request.onerror = () => {
        console.error('❌ Fallback DB open failed:', request.error);
        resolve(false);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('stories')) {
          const objectStore = db.createObjectStore('stories', { keyPath: 'id' });
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('📦 Fallback object store created');
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // Handle database errors
        db.onerror = (event) => {
          console.error('❌ Database error:', event.target.error);
          resolve(false);
        };
        
        const transaction = db.transaction(['stories'], 'readwrite');
        const objectStore = transaction.objectStore('stories');
        
        // Clear existing data first
        const clearRequest = objectStore.clear();
        
        clearRequest.onsuccess = () => {
          // Add all stories
          let completed = 0;
          const total = stories.length;
          
          if (total === 0) {
            db.close();
            resolve(true);
            return;
          }
          
          stories.forEach((story, index) => {
            try {
              const addRequest = objectStore.add({
                ...story,
                cachedAt: new Date().toISOString()
              });
              
              addRequest.onsuccess = () => {
                completed++;
                if (completed === total) {
                  console.log(`💾 Fallback saved ${total} stories`);
                  db.close();
                  resolve(true);
                }
              };
              
              addRequest.onerror = () => {
                console.error(`❌ Fallback save story ${index} failed:`, addRequest.error);
                completed++;
                if (completed === total) {
                  db.close();
                  resolve(false);
                }
              };
            } catch (error) {
              console.error(`❌ Error adding story ${index}:`, error);
              completed++;
              if (completed === total) {
                db.close();
                resolve(false);
              }
            }
          });
        };
        
        clearRequest.onerror = () => {
          console.error('❌ Fallback clear failed:', clearRequest.error);
          db.close();
          resolve(false);
        };
      };
    });
  },

  async _fallbackGetStories() {
    return new Promise((resolve) => {
      // CRITICAL: Use window.indexedDB explicitly
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
      if (!IDBFactory) {
        console.error('❌ IndexedDB not supported');
        resolve([]);
        return;
      }
      
      const request = IDBFactory.open('DicodingStoryDB', 1);
      
      request.onerror = () => {
        console.error('❌ Fallback DB open failed:', request.error);
        resolve([]);
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('stories')) {
          db.close();
          resolve([]);
          return;
        }
        
        const transaction = db.transaction(['stories'], 'readonly');
        const objectStore = transaction.objectStore('stories');
        const getAllRequest = objectStore.getAll();
        
        getAllRequest.onsuccess = () => {
          const stories = getAllRequest.result || [];
          console.log(`📱 Fallback retrieved ${stories.length} stories`);
          db.close();
          resolve(stories);
        };
        
        getAllRequest.onerror = () => {
          console.error('❌ Fallback get stories failed:', getAllRequest.error);
          db.close();
          resolve([]);
        };
      };
    });
  },

  async _fallbackClearStories() {
    return new Promise((resolve) => {
      // CRITICAL: Use window.indexedDB explicitly
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
      if (!IDBFactory) {
        console.error('❌ IndexedDB not supported');
        resolve(false);
        return;
      }
      
      const request = IDBFactory.open('DicodingStoryDB', 1);
      
      request.onerror = () => {
        console.error('❌ Fallback DB open failed:', request.error);
        resolve(false);
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('stories')) {
          db.close();
          resolve(true);
          return;
        }
        
        const transaction = db.transaction(['stories'], 'readwrite');
        const objectStore = transaction.objectStore('stories');
        const clearRequest = objectStore.clear();
        
        clearRequest.onsuccess = () => {
          console.log('🗑️ Fallback cleared all stories');
          db.close();
          resolve(true);
        };
        
        clearRequest.onerror = () => {
          console.error('❌ Fallback clear failed:', clearRequest.error);
          db.close();
          resolve(false);
        };
      };
    });
  },

  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Wait for managers to be available
  async waitForManagers(timeout = 5000) {
    const startTime = Date.now();
    
    while (!window.StoryOfflineManager && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!window.StoryOfflineManager) {
      console.warn('⚠️ StoryOfflineManager not available after timeout');
      return false;
    }
    
    return true;
  },

  // Enhanced initialization with retry
  async initWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 StoryStorage init attempt ${i + 1}/${maxRetries}`);
        
        // Wait for managers to be available
        await this.waitForManagers();
        
        // Try to initialize
        await this.init();
        
        console.log('✅ StoryStorage initialized successfully');
        return true;
      } catch (error) {
        console.error(`❌ StoryStorage init attempt ${i + 1} failed:`, error);
        
        if (i === maxRetries - 1) {
          console.error('❌ All StoryStorage init attempts failed');
          return false;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  },

  // Test storage functionality with better error handling
  async testConnection() {
    try {
      console.log('🧪 Testing storage connection...');
      
      // Check if IndexedDB is supported
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      if (!IDBFactory) {
        throw new Error('IndexedDB not supported in this browser');
      }
      
      // Test save
      const testStory = {
        id: 'test-story-' + Date.now(),
        name: 'Test Story',
        description: 'This is a test story for storage',
        createdAt: new Date().toISOString(),
        photoUrl: 'https://picsum.photos/200/300'
      };
      
      console.log('📝 Testing save operation...');
      const saveResult = await this.saveStories([testStory]);
      if (!saveResult) {
        throw new Error('Save test failed');
      }
      console.log('✅ Save test passed');
      
      // Test retrieve
      console.log('📖 Testing retrieve operation...');
      const stories = await this.getAllStories();
      if (stories.length === 0) {
        throw new Error('Retrieve test failed - no stories found');
      }
      console.log(`✅ Retrieve test passed - found ${stories.length} stories`);
      
      // Test clear
      console.log('🗑️ Testing clear operation...');
      const clearResult = await this.clearAll();
      if (!clearResult) {
        throw new Error('Clear test failed');
      }
      console.log('✅ Clear test passed');
      
      console.log('✅ All storage tests passed');
      return {
        status: 'success',
        message: 'All storage operations working correctly',
        timestamp: new Date().toISOString(),
        testStoryId: testStory.id
      };
      
    } catch (error) {
      console.error('❌ Storage test failed:', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack
      };
    }
  },

  // Get detailed status
  async getDetailedStatus() {
    try {
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      const isAvailable = !!IDBFactory;
      const hasManagers = !!(window.IndexedDBManager && window.StoryOfflineManager);
      const hasData = await this.isDataAvailable();
      const storageInfo = await this.getStorageInfo();
      
      return {
        isSupported: isAvailable,
        hasManagers: hasManagers,
        hasData: hasData,
        isOnline: navigator.onLine,
        storage: storageInfo,
        browserSupport: {
          indexedDB: !!window.indexedDB,
          mozIndexedDB: !!window.mozIndexedDB,
          webkitIndexedDB: !!window.webkitIndexedDB,
          msIndexedDB: !!window.msIndexedDB
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ getDetailedStatus failed:', error);
      return {
        isSupported: false,
        hasManagers: false,
        hasData: false,
        isOnline: navigator.onLine,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },

  // Check database existence
  async checkDatabase() {
    try {
      const IDBFactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      
      if (!IDBFactory) {
        return { exists: false, error: 'IndexedDB not supported' };
      }

      return new Promise((resolve) => {
        const request = IDBFactory.open('DicodingStoryDB', 1);
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const hasStories = db.objectStoreNames.contains('stories');
          db.close();
          
          resolve({
            exists: true,
            hasStoriesStore: hasStories,
            version: db.version
          });
        };
        
        request.onerror = () => {
          resolve({
            exists: false,
            error: request.error?.message || 'Unknown error'
          });
        };
      });
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  },

  // Force use fallback methods (for testing)
  async testFallback() {
    console.log('🧪 Testing fallback methods directly...');
    
    try {
      // Test fallback save
      const testStory = {
        id: 'fallback-test-' + Date.now(),
        name: 'Fallback Test Story',
        description: 'Testing fallback methods',
        createdAt: new Date().toISOString()
      };
      
      const saveResult = await this._fallbackSaveStories([testStory]);
      console.log('Fallback save result:', saveResult);
      
      // Test fallback get
      const stories = await this._fallbackGetStories();
      console.log('Fallback get result:', stories.length, 'stories');
      
      // Test fallback clear
      const clearResult = await this._fallbackClearStories();
      console.log('Fallback clear result:', clearResult);
      
      return {
        save: saveResult,
        get: stories.length > 0,
        clear: clearResult
      };
    } catch (error) {
      console.error('❌ Fallback test failed:', error);
      return { error: error.message };
    }
  }
};

export default storyStorage;