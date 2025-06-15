import StoriesListModel from '../model/StoriesListModel.js';
import { loadConfig } from '../utils/index.js';
import storyStorage from '../utils/storyStorage.js'; // CHANGED: renamed from indexedDB
import StoriesListView from '../view/StoriesListView.js';

export default class StoriesListPresenter {
  constructor() {
    this.model = new StoriesListModel();
    this.view = new StoriesListView();
    this.isInitializing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.offlineMode = false;
    
    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Setup network listeners
    this.setupNetworkListeners();
  }

  async init() {
    if (this.isInitializing) {
      console.log('⏳ Already initializing...');
      return;
    }

    this.isInitializing = true;

    try {
      // Check if the user is logged in by checking the token
      if (!this.model.token) {
        alert('Anda harus login terlebih dahulu');
        return location.hash = '/login';
      }

      // Initialize storage with retry mechanism
      await this.initStorage();

      // Load configuration (e.g., Maptiler API key)
      const config = await this.loadConfigWithFallback();
      
      // Determine loading strategy based on network status
      if (navigator.onLine) {
        await this.loadStoriesOnline(config.maptilerKey);
      } else {
        await this.loadStoriesOffline();
      }

    } catch (err) {
      console.error('❌ Critical initialization error:', err);
      await this.handleInitializationError(err);
    } finally {
      this.isInitializing = false;
    }
  }

  async initStorage() {
    try {
      console.log('🔧 Initializing storage...');
      
      // Use enhanced initialization with retry
      const success = await storyStorage.initWithRetry(3);
      
      if (success) {
        console.log('✅ Storage ready in StoriesListPresenter');
        
        // Test connection in development
        if (window.location.hostname === 'localhost') {
          const testResult = await storyStorage.testConnection();
          console.log('🧪 Storage test result:', testResult);
        }
        
        return true;
      } else {
        throw new Error('Storage initialization failed after retries');
      }
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      
      // Show user-friendly error
      this.showErrorMessage('Offline storage tidak tersedia. Beberapa fitur mungkin terbatas.');
      return false;
    }
  }

  async loadConfigWithFallback() {
    try {
      const config = await loadConfig();
      return config;
    } catch (error) {
      console.warn('⚠️ Config loading failed, using fallback:', error);
      
      // Return fallback config
      return {
        maptilerKey: '', // Will work without map features
        apiBaseUrl: 'https://story-api.dicoding.dev/v1',
        fallback: true
      };
    }
  }

  async loadStoriesOnline(maptilerKey) {
    try {
      console.log('📡 Loading stories from API...');
      this.showLoadingState(true);
      
      // Fetch all stories using the model
      const { listStory: stories } = await this.model.getAllStories();

      if (!stories || stories.length === 0) {
        throw new Error('No stories returned from API');
      }

      // 1. MENYIMPAN: Save to storage for offline access
      const saveSuccess = await storyStorage.saveStories(stories);
      if (saveSuccess) {
        console.log('💾 Stories cached for offline access');
        this.notifyDataCached(stories.length);
      }

      // 2. MENAMPILKAN: Pass the stories and maptilerKey to the view for rendering
      await this.view.render(stories, maptilerKey);
      
      // Update UI state
      this.showOnlineStatus();
      this.showSuccessMessage(`${stories.length} stories loaded successfully`);
      this.resetRetryCount();
      
    } catch (error) {
      console.log('❌ Online loading failed, trying offline...', error);
      
      // Increment retry count
      this.retryCount++;
      
      // Try offline mode
      await this.loadStoriesOffline();
      
      // Offer retry if not too many attempts
      if (this.retryCount < this.maxRetries) {
        this.showRetryOption();
      }
    } finally {
      this.showLoadingState(false);
    }
  }

  async loadStoriesOffline() {
    try {
      console.log('📱 Loading stories from offline storage...');
      this.showLoadingState(true, 'Loading offline data...');
      
      // Get stories from storage
      const offlineStories = await storyStorage.getAllStories();
      
      if (offlineStories && offlineStories.length > 0) {
        // Try to get maptiler key (might not be available offline)
        let maptilerKey = '';
        try {
          const config = await this.loadConfigWithFallback();
          maptilerKey = config.maptilerKey;
        } catch (err) {
          console.warn('⚠️ Map config not available offline');
        }
        
        // Render offline stories
        await this.view.render(offlineStories, maptilerKey);
        
        // Update UI state
        this.offlineMode = true;
        this.showOfflineStatus();
        this.showOfflineMessage(offlineStories.length);
        
        // Get storage info
        const storageInfo = await storyStorage.getStorageInfo();
        console.log('📊 Offline storage info:', storageInfo);
        
      } else {
        throw new Error('Tidak ada data offline tersedia');
      }
      
    } catch (error) {
      console.error('❌ Offline loading failed:', error);
      
      // Show comprehensive error
      this.showOfflineError(error);
    } finally {
      this.showLoadingState(false);
    }
  }

  // Enhanced refresh with better UX
  async refreshStories() {
    if (this.isInitializing) {
      console.log('⏳ Already refreshing...');
      return;
    }

    try {
      this.showLoadingState(true, 'Refreshing stories...');
      
      if (!navigator.onLine) {
        throw new Error('No internet connection');
      }

      const config = await this.loadConfigWithFallback();
      await this.loadStoriesOnline(config.maptilerKey);
      
      this.showSuccessMessage('Data berhasil diperbarui');
      
      // Send refresh event to Service Worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REFRESH_COMPLETE'
        });
      }
      
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      
      if (error.message.includes('internet')) {
        this.showErrorMessage('Tidak ada koneksi internet. Menampilkan data offline.');
        await this.loadStoriesOffline();
      } else {
        this.showErrorMessage(`Gagal memperbarui data: ${error.message}`);
      }
    }
  }

  // Enhanced clear with confirmation
  async clearOfflineData() {
    // Show confirmation dialog
    const confirmed = await this.showConfirmDialog(
      'Hapus Data Offline', 
      'Apakah Anda yakin ingin menghapus semua data offline? Data akan dimuat ulang dari server.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      this.showLoadingState(true, 'Clearing offline data...');
      
      const success = await storyStorage.clearAll();
      if (success) {
        this.showSuccessMessage('Data offline berhasil dihapus');
        
        // Try to reload from online
        if (navigator.onLine) {
          await this.init();
        } else {
          this.showErrorMessage('Tidak ada koneksi internet. Silakan coba lagi saat online.');
        }
      } else {
        throw new Error('Gagal menghapus data');
      }
    } catch (error) {
      console.error('❌ Clear offline data failed:', error);
      this.showErrorMessage(`Gagal menghapus data offline: ${error.message}`);
    }
  }

  // ... (rest of the methods remain the same as in the original file)
  // I'll include a few key methods here for completeness

  setupNetworkListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  async handleOnline() {
    console.log('🟢 Network: Back online');
    
    if (this.offlineMode) {
      this.showInfoMessage('Koneksi kembali. Memuat data terbaru...');
      
      setTimeout(async () => {
        await this.refreshStories();
        this.offlineMode = false;
      }, 1000);
    }
  }

  handleOffline() {
    console.log('🔴 Network: Gone offline');
    this.showOfflineStatus();
    this.showInfoMessage('Mode offline aktif. Menampilkan data tersimpan.');
  }

  showLoadingState(show, message = 'Loading...') {
    if (window.PWAManager) {
      const loader = document.getElementById('pwa-loading');
      if (loader) {
        if (show) {
          loader.querySelector('p').textContent = message;
          loader.classList.add('show');
        } else {
          loader.classList.remove('show');
        }
      }
    }
  }

  showSuccessMessage(message) {
    console.log(`✅ ${message}`);
    this.showToast(message, 'success');
  }

  showErrorMessage(message) {
    console.error(`❌ ${message}`);
    this.showToast(message, 'error');
  }

  showInfoMessage(message) {
    console.log(`ℹ️ ${message}`);
    this.showToast(message, 'info');
  }

  showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${this.getToastIcon(type)}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getToastColor(type)};
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1003;
      max-width: 300px;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }, duration);
  }

  getToastIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  getToastColor(type) {
    const colors = {
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3'
    };
    return colors[type] || '#2196f3';
  }

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.5); z-index: 2000; 
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            background: white; padding: 2rem; border-radius: 12px; 
            max-width: 400px; margin: 1rem; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          ">
            <h3 style="margin: 0 0 1rem 0; color: #333;">${title}</h3>
            <p style="margin: 0 0 2rem 0; color: #666; line-height: 1.5;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
              <button id="cancel-btn" style="
                background: #666; color: white; border: none; 
                padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;
              ">Batal</button>
              <button id="confirm-btn" style="
                background: #f44336; color: white; border: none; 
                padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;
              ">Hapus</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      dialog.querySelector('#cancel-btn').onclick = () => {
        dialog.remove();
        resolve(false);
      };
      
      dialog.querySelector('#confirm-btn').onclick = () => {
        dialog.remove();
        resolve(true);
      };
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          dialog.remove();
          resolve(false);
        }
      };
    });
  }

  showOnlineStatus() {
    console.log('🟢 App is online');
    this.updateStatusIndicator('online');
    this.removeOfflineIndicators();
  }

  showOfflineStatus() {
    console.log('🔴 App is offline');
    this.updateStatusIndicator('offline');
  }

  updateStatusIndicator(status) {
    const indicator = document.querySelector('.connection-status');
    if (indicator) {
      indicator.className = `connection-status ${status}`;
      indicator.textContent = status === 'online' ? '🟢 Online' : '🔴 Offline';
    }
  }

  removeOfflineIndicators() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
      offlineIndicator.classList.remove('show');
    }
  }

  showOfflineMessage(count) {
    const message = `Mode offline: Menampilkan ${count} cerita tersimpan`;
    
    if (window.PWAManager && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Dicoding Story - Offline Mode', {
        body: message,
        icon: 'ios/72.png',
        tag: 'offline-mode'
      });
    }
    
    this.showInfoMessage(message);
  }

  notifyDataCached(count) {
    console.log(`📱 ${count} stories cached for offline use`);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Data Cached', {
        body: `${count} stories saved for offline viewing`,
        icon: 'ios/72.png',
        tag: 'cache-update'
      });
    }
  }

  showRetryOption() {
    this.showToast(
      `Gagal memuat data (percobaan ${this.retryCount}/${this.maxRetries}). <button onclick="window.storiesPresenter?.refreshStories()" style="background: white; color: #2196f3; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">Coba Lagi</button>`,
      'warning',
      10000
    );
  }

  showOfflineError(error) {
    const message = `
      Tidak dapat memuat data offline. 
      ${error.message}. 
      <br><br>
      <button onclick="window.storiesPresenter?.init()" style="background: white; color: #f44336; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Coba Lagi</button>
    `;
    
    this.showToast(message, 'error', 15000);
  }

  handleInitializationError(error) {
    console.error('💥 Initialization error:', error);
    
    const errorMessage = `
      Gagal menginisialisasi aplikasi: ${error.message}
      <br><br>
      <button onclick="window.location.reload()" style="background: white; color: #f44336; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Muat Ulang</button>
    `;
    
    this.showToast(errorMessage, 'error', 0); // Don't auto-hide
  }

  resetRetryCount() {
    this.retryCount = 0;
  }

  // Enhanced method to check offline data availability
  async getOfflineStatus() {
    try {
      const detailedStatus = await storyStorage.getDetailedStatus();
      
      return {
        ...detailedStatus,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        offlineMode: this.offlineMode,
        canRetry: this.retryCount < this.maxRetries
      };
    } catch (error) {
      console.error('❌ getOfflineStatus failed:', error);
      return {
        isOnline: navigator.onLine,
        hasOfflineData: false,
        status: 'error',
        error: error.message
      };
    }
  }

  // Cleanup method
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    // Clear any existing timeouts/intervals
    // Remove global reference
    if (window.storiesPresenter === this) {
      window.storiesPresenter = null;
    }
    
    console.log('🧹 StoriesListPresenter cleaned up');
  }

  // Advanced PWA features integration
  async enableAdvancedFeatures() {
    try {
      // Background sync registration
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync-stories');
        console.log('✅ Background sync registered');
      }

      // Periodic background sync (if supported)
      if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        
        if (status.state === 'granted') {
          await registration.periodicSync.register('periodic-sync-stories', {
            minInterval: 24 * 60 * 60 * 1000 // 24 hours
          });
          console.log('✅ Periodic background sync registered');
        }
      }

      // Web Share API integration
      if (navigator.share) {
        console.log('✅ Web Share API available');
      }

      // Badge API for unread count
      if ('setAppBadge' in navigator) {
        console.log('✅ Badge API available');
      }

    } catch (error) {
      console.error('❌ Failed to enable advanced features:', error);
    }
  }

  // Share story functionality
  async shareStory(story) {
    const shareData = {
      title: story.name,
      text: story.description,
      url: `${window.location.origin}${window.location.pathname}#/story/${story.id}`
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        console.log('✅ Story shared successfully');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareData.url);
        this.showSuccessMessage('Link cerita disalin ke clipboard');
      }
    } catch (error) {
      console.error('❌ Share failed:', error);
      this.showErrorMessage('Gagal membagikan cerita');
    }
  }

  // Update app badge with story count
  async updateAppBadge(count = 0) {
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await navigator.setAppBadge(count);
        } else {
          await navigator.clearAppBadge();
        }
      }
    } catch (error) {
      console.error('❌ Failed to update app badge:', error);
    }
  }

  // Performance monitoring
  measurePerformance(label, fn) {
    return async (...args) => {
      const startTime = performance.now();
      const startMark = `${label}-start`;
      const endMark = `${label}-end`;
      
      performance.mark(startMark);
      
      try {
        const result = await fn.apply(this, args);
        
        performance.mark(endMark);
        performance.measure(label, startMark, endMark);
        
        const endTime = performance.now();
        console.log(`⏱️ ${label}: ${(endTime - startTime).toFixed(2)}ms`);
        
        return result;
      } catch (error) {
        performance.mark(endMark);
        performance.measure(`${label}-error`, startMark, endMark);
        throw error;
      }
    };
  }

  // Memory usage monitoring
  getMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      };
    }
    return null;
  }

  // Export data for backup
  async exportData() {
    try {
      const stories = await storyStorage.getAllStories();
      const storageInfo = await storyStorage.getStorageInfo();
      
      const exportData = {
        stories: stories,
        metadata: {
          exportDate: new Date().toISOString(),
          count: stories.length,
          storageInfo: storageInfo,
          version: '1.2.0'
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dicoding-stories-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccessMessage(`Data backup berhasil diunduh (${stories.length} cerita)`);
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      this.showErrorMessage('Gagal mengekspor data');
    }
  }

  // Import data from backup
  async importData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.stories || !Array.isArray(importData.stories)) {
        throw new Error('Format file backup tidak valid');
      }

      // Confirm import
      const confirmed = await this.showConfirmDialog(
        'Import Data',
        `Apakah Anda yakin ingin mengimpor ${importData.stories.length} cerita? Data yang ada akan diganti.`
      );

      if (!confirmed) return;

      // Clear existing data
      await storyStorage.clearAll();
      
      // Import new data
      const success = await storyStorage.saveStories(importData.stories);
      
      if (success) {
        this.showSuccessMessage(`Berhasil mengimpor ${importData.stories.length} cerita`);
        
        // Refresh view
        await this.loadStoriesOffline();
      } else {
        throw new Error('Gagal menyimpan data import');
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      this.showErrorMessage(`Gagal mengimpor data: ${error.message}`);
    }
  }

  // Development/Debug helpers
  async debugInfo() {
    if (window.location.hostname !== 'localhost') {
      console.log('Debug info only available in development');
      return;
    }

    const offlineStatus = await this.getOfflineStatus();
    const memoryUsage = this.getMemoryUsage();
    const storageInfo = await storyStorage.getStorageInfo();
    
    const debugData = {
      timestamp: new Date().toISOString(),
      network: {
        isOnline: navigator.onLine,
        connection: navigator.connection || 'Not available'
      },
      storage: storageInfo,
      offline: offlineStatus,
      memory: memoryUsage,
      performance: {
        timing: performance.timing,
        navigation: performance.navigation
      },
      serviceWorker: {
        controller: !!navigator.serviceWorker.controller,
        ready: navigator.serviceWorker.ready.then(() => true).catch(() => false)
      }
    };

    console.group('🐛 Debug Information');
    console.table(debugData.network);
    console.table(debugData.storage);
    console.table(debugData.memory);
    console.log('Full debug data:', debugData);
    console.groupEnd();

    return debugData;
  }

  // Initialize performance monitoring
  initPerformanceMonitoring() {
    // Wrap critical methods with performance monitoring
    this.loadStoriesOnline = this.measurePerformance('loadStoriesOnline', this.loadStoriesOnline);
    this.loadStoriesOffline = this.measurePerformance('loadStoriesOffline', this.loadStoriesOffline);
    this.refreshStories = this.measurePerformance('refreshStories', this.refreshStories);
  }

  // Global error handler for this presenter
  setupErrorHandling() {
    // Catch unhandled errors in this context
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Check if error is related to this presenter
      const errorMessage = args.join(' ');
      if (errorMessage.includes('StoriesListPresenter') || 
          errorMessage.includes('storyStorage') || 
          errorMessage.includes('stories')) {
        
        // Log to our system
        this.logError('Unhandled error in StoriesListPresenter context', args);
      }
      
      // Call original console.error
      originalConsoleError.apply(console, args);
    };
  }

  logError(context, details) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      context: context,
      details: details,
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOnline: navigator.onLine
    };

    // Store error log (could be sent to analytics service)
    console.warn('📊 Error logged:', errorLog);
    
    // Could implement error reporting here
    // this.sendErrorReport(errorLog);
  }

  // Utility method to check if app is running as PWA
  isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }

  // Get app installation status
  getInstallationStatus() {
    return {
      isPWA: this.isPWA(),
      isInstallable: !!window.PWAManager?.deferredPrompt,
      hasServiceWorker: 'serviceWorker' in navigator,
      isOnline: navigator.onLine,
      hasOfflineData: this.offlineMode
    };
  }
}

// Auto-setup for development
if (window.location.hostname === 'localhost') {
  // Make presenter available globally for debugging
  window.addEventListener('load', () => {
    if (window.storiesPresenter) {
      console.log('🔧 Development mode: StoriesListPresenter available at window.storiesPresenter');
      console.log('🔧 Debug commands: debugInfo(), getOfflineStatus(), getInstallationStatus()');
    }
  });
}