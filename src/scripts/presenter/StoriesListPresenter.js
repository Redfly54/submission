import StoriesListModel from '../model/StoriesListModel.js';
import { loadConfig } from '../utils/index.js';
import indexedDB from '../utils/indexedDB.js'; // Import IndexedDB
import StoriesListView from '../view/StoriesListView.js';

export default class StoriesListPresenter {
  constructor() {
    this.model = new StoriesListModel();
    this.view = new StoriesListView();
    this.initIndexedDB(); // Initialize IndexedDB
  }

  async initIndexedDB() {
    try {
      await indexedDB.init();
      console.log('✅ IndexedDB ready in StoriesListPresenter');
    } catch (error) {
      console.error('❌ IndexedDB initialization failed:', error);
    }
  }

  async init() {
    // Check if the user is logged in by checking the token
    if (!this.model.token) {
      alert('Anda harus login terlebih dahulu');
      return location.hash = '/login';
    }

    try {
      // Load configuration (e.g., Maptiler API key)
      const { maptilerKey } = await loadConfig();
      
      // Try to load stories online first
      await this.loadStoriesOnline(maptilerKey);
      
    } catch (err) {
      console.error('Error loading config or stories online:', err);
      
      // If online fails, try offline
      await this.loadStoriesOffline();
    }
  }

  async loadStoriesOnline(maptilerKey) {
    try {
      console.log('📡 Loading stories from API...');
      
      // Fetch all stories using the model
      const { listStory: stories } = await this.model.getAllStories();

      // 1. MENYIMPAN: Save to IndexedDB for offline access
      const saveSuccess = await indexedDB.saveStories(stories);
      if (saveSuccess) {
        console.log('💾 Stories cached for offline access');
      }

      // 2. MENAMPILKAN: Pass the stories and maptilerKey to the view for rendering
      this.view.render(stories, maptilerKey);
      
      // Show online status
      this.showOnlineStatus();
      
    } catch (error) {
      console.log('❌ Online loading failed, trying offline...', error);
      throw error; // Re-throw to trigger offline mode
    }
  }

  async loadStoriesOffline() {
    try {
      console.log('📱 Loading stories from offline storage...');
      
      // 2. MENAMPILKAN: Get stories from IndexedDB
      const offlineStories = await indexedDB.getAllStories();
      
      if (offlineStories && offlineStories.length > 0) {
        // Try to get maptiler key (might not be available offline)
        let maptilerKey = '';
        try {
          const config = await loadConfig();
          maptilerKey = config.maptilerKey;
        } catch (err) {
          console.warn('⚠️ Map config not available offline');
        }
        
        // Render offline stories
        this.view.render(offlineStories, maptilerKey);
        
        // Show offline status
        this.showOfflineStatus();
        
        // Notify user about offline mode
        this.showOfflineMessage();
        
      } else {
        throw new Error('Tidak ada data offline tersedia');
      }
      
    } catch (error) {
      console.error('❌ Offline loading failed:', error);
      alert(`Gagal memuat stories: ${error.message}`);
    }
  }

  // Additional methods for better UX
  async refreshStories() {
    try {
      const { maptilerKey } = await loadConfig();
      await this.loadStoriesOnline(maptilerKey);
      this.showSuccessMessage('Data berhasil diperbarui');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      alert('Gagal memperbarui data. Periksa koneksi internet.');
    }
  }

  // 3. MENGHAPUS: Clear offline data
  async clearOfflineData() {
    try {
      const success = await indexedDB.clearAll();
      if (success) {
        this.showSuccessMessage('Data offline berhasil dihapus');
        // Try to reload from online
        await this.init();
      } else {
        throw new Error('Gagal menghapus data');
      }
    } catch (error) {
      console.error('❌ Clear offline data failed:', error);
      alert(`Gagal menghapus data offline: ${error.message}`);
    }
  }

  // Status and message methods
  showOnlineStatus() {
    console.log('🟢 App is online');
    // You can add visual indicators here if your view supports it
  }

  showOfflineStatus() {
    console.log('🔴 App is offline');
    // You can add visual indicators here if your view supports it
  }

  showOfflineMessage() {
    // Show a subtle notification that app is in offline mode
    if (window.PWAManager) {
      // Use existing PWA notification system if available
      console.log('📱 Offline mode: Displaying cached data');
    } else {
      // Simple alert fallback
      setTimeout(() => {
        alert('Mode offline: Menampilkan data terakhir yang disimpan');
      }, 1000);
    }
  }

  showSuccessMessage(message) {
    console.log(`✅ ${message}`);
    // You can enhance this with better UI notifications
  }

  // Method to check offline data availability
  async getOfflineStatus() {
    const hasData = await indexedDB.isDataAvailable();
    const isOnline = navigator.onLine;
    
    return {
      isOnline,
      hasOfflineData: hasData,
      status: isOnline ? 'online' : (hasData ? 'offline-with-data' : 'offline-no-data')
    };
  }
}