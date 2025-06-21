// Clean StoriesListPresenter.js - Fixed Import Paths
import StoriesListModel from '../model/StoriesListModel.js';
import { loadConfig } from '../utils/index.js';
import StoriesListView from '../view/StoriesListView.js';

export default class StoriesListPresenter {
  constructor() {
    this.model = new StoriesListModel();
    this.view = new StoriesListView();
    this.isInitializing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentStories = [];
    this.managersReady = false;
    
    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Setup network listeners
    this.setupNetworkListeners();
    
    // Setup user action handlers
    this.setupUserActionHandlers();
    window.storiesPresenter = this;

    // Listen for managers ready event
    window.addEventListener('managersReady', () => {
      this.managersReady = true;
      console.log('✅ Managers ready event received');
    });
  }

  async init() {
    if (this.isInitializing) {
      console.log('⏳ Already initializing...');
      return;
    }

    this.isInitializing = true;
    console.log('🚀 Initializing StoriesListPresenter...');

    try {
      // Check if the user is logged in
      if (!this.model.token) {
        alert('Anda harus login terlebih dahulu');
        return location.hash = '/login';
      }

      // Wait for managers with better error handling
      await this.waitForManagersWithFallback();

      // Load configuration
      const config = await this.loadConfigWithFallback();
      
      // Always try to load fresh data first if online
      if (navigator.onLine) {
        await this.loadStoriesOnline(config.maptilerKey);
      } else {
        await this.loadUserStoriesOffline(config.maptilerKey);
      }

    } catch (err) {
      console.error('❌ Critical initialization error:', err);
      await this.handleInitializationError(err);
    } finally {
      this.isInitializing = false;
    }
  }

  // Better waiting mechanism with fallback
  async waitForManagersWithFallback() {
    console.log('⏳ Waiting for IndexedDB managers...');
    
    // If managers are already ready, continue
    if (this.managersReady && window.StoryOfflineManager && window.StoryOfflineManager.initialized) {
      console.log('✅ Managers already ready');
      return true;
    }
    
    // Wait for managers ready event or timeout
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds
    
    while (attempts < maxAttempts && !this.managersReady) {
      if (window.StoryOfflineManager && 
          typeof window.StoryOfflineManager.getOfflineStories === 'function') {
        this.managersReady = true;
        console.log('✅ Managers are ready');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.managersReady) {
      console.warn('⚠️ Managers not ready after timeout, using fallback mode');
      this.setupFallbackManager();
      return false;
    }
    
    return true;
  }

  // Setup fallback manager if real one fails
  setupFallbackManager() {
    if (!window.StoryOfflineManager) {
      window.StoryOfflineManager = {};
    }

    // Add fallback methods
    const fallbackMethods = {
      getOfflineStories: async () => {
        console.log('📱 Using fallback getOfflineStories');
        return [];
      },
      cacheStories: async () => {
        console.log('📱 Using fallback cacheStories');
        return false;
      },
      hasOfflineData: async () => {
        console.log('📱 Using fallback hasOfflineData');
        return false;
      },
      getOfflineInfo: async () => {
        console.log('📱 Using fallback getOfflineInfo');
        return { count: 0, size: 0, sizeFormatted: '0 Bytes' };
      },
      clearOfflineStories: async () => {
        console.log('📱 Using fallback clearOfflineStories');
        return true;
      },
      getAllUserStories: async () => {
        console.log('📱 Using fallback getAllUserStories');
        return { saved: [], liked: [], offline: [], total: 0 };
      },
      getStoryStatus: async (storyId) => {
        console.log('📱 Using fallback getStoryStatus for', storyId);
        return { id: storyId, isSaved: false, isLiked: false, isOffline: false };
      },
      saveStoryForLater: async () => {
        this.showErrorMessage('Fitur simpan tidak tersedia saat ini');
        return false;
      },
      likeStory: async () => {
        this.showErrorMessage('Fitur like tidak tersedia saat ini');
        return false;
      },
      downloadForOffline: async () => {
        this.showErrorMessage('Fitur download offline tidak tersedia saat ini');
        return false;
      },
      downloadMultipleStories: async () => {
        this.showErrorMessage('Fitur download offline tidak tersedia saat ini');
        return 0;
      },
      initialized: false
    };

    // Add missing methods
    Object.keys(fallbackMethods).forEach(methodName => {
      if (!window.StoryOfflineManager[methodName]) {
        window.StoryOfflineManager[methodName] = fallbackMethods[methodName];
      }
    });

    console.log('🛠️ Fallback StoryOfflineManager setup complete');
  }

  async loadConfigWithFallback() {
    try {
      const config = await loadConfig();
      return config;
    } catch (error) {
      console.warn('⚠️ Config loading failed, using fallback:', error);
      return {
        maptilerKey: '',
        apiBaseUrl: 'https://story-api.dicoding.dev/v1',
        fallback: true
      };
    }
  }

  // Enhanced loading with proper error handling
  async loadStoriesOnline(maptilerKey) {
    try {
      console.log('📡 Loading fresh stories from API...');
      this.showLoadingState(true);
      
      let result;
      try {
        result = await this.model.getAllStories();
      } catch (apiError) {
        console.log('❌ API Error:', apiError.message);
        
        if (apiError.message.includes('503') || apiError.message.includes('Service Unavailable')) {
          this.showErrorMessage('Server sedang maintenance. Menampilkan data offline...');
        } else {
          this.showErrorMessage('Koneksi bermasalah. Menampilkan data offline...');
        }
        
        await this.loadUserStoriesOffline(maptilerKey);
        return;
      }

      const apiStories = result.listStory;
      
      if (!apiStories || apiStories.length === 0) {
        this.showEmptyState('online');
        return;
      }

      this.currentStories = apiStories;
      
      // Enhanced rendering with fallback
      await this.renderStoriesWithUserActions(apiStories, maptilerKey);
      
      this.showOnlineStatus();
      this.showSuccessMessage(`${apiStories.length} stories loaded`);
      this.resetRetryCount();
      
    } catch (error) {
      console.error('❌ General error:', error);
      await this.loadUserStoriesOffline(maptilerKey);
      
      this.showToast(
        `Gagal memuat data. <button onclick="window.storiesPresenter?.refreshStories()" style="background: white; color: #2196f3; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">Coba Lagi</button>`,
        'warning',
        8000
      );
    } finally {
      this.showLoadingState(false);
    }
  }

  // Load user stories with better error handling
  async loadUserStoriesOffline(maptilerKey = '') {
    try {
      console.log('📱 Loading user stories from offline storage...');
      this.showLoadingState(true, 'Loading your saved stories...');
      
      // Better check for StoryOfflineManager
      if (!window.StoryOfflineManager || 
          typeof window.StoryOfflineManager.getAllUserStories !== 'function') {
        console.warn('⚠️ StoryOfflineManager not available');
        this.showEmptyOfflineState();
        return;
      }

      // Get all user stories
      const userStories = await window.StoryOfflineManager.getAllUserStories();
      
      if (userStories.total === 0) {
        this.showEmptyOfflineState();
        return;
      }

      // Combine all user stories for display
      const allUserStories = [
        ...userStories.saved,
        ...userStories.liked,
        ...userStories.offline
      ];

      // Remove duplicates
      const uniqueStories = this.removeDuplicateStories(allUserStories);

      // Render with offline indicators
      await this.renderOfflineStories(uniqueStories, maptilerKey, userStories);
      
      this.showOfflineStatus();
      this.showOfflineMessage(uniqueStories.length);
      
    } catch (error) {
      console.error('❌ Offline loading failed:', error);
      this.showOfflineError(error);
    } finally {
      this.showLoadingState(false);
    }
  }

  // Enhanced rendering with safety checks
  async renderStoriesWithUserActions(storiesList, maptilerKey) {
    console.log('🎨 Rendering stories with user actions...');
    
    try {
      // Get user status for each story with safety checks
      const storiesWithStatus = await Promise.all(
        storiesList.map(async (story) => {
          let status = { isSaved: false, isLiked: false, isOffline: false };
          
          if (window.StoryOfflineManager && 
              typeof window.StoryOfflineManager.getStoryStatus === 'function' &&
              window.StoryOfflineManager.initialized !== false) {
            try {
              status = await window.StoryOfflineManager.getStoryStatus(story.id);
            } catch (error) {
              console.warn('Failed to get story status for', story.id, error);
            }
          }
          
          return { ...story, userStatus: status };
        })
      );

      // Render with enhanced view
      await this.view.renderWithUserActions(storiesWithStatus, maptilerKey);
      
      console.log('✅ Stories rendered with user actions');
    } catch (error) {
      console.error('❌ Error rendering stories with user actions:', error);
      
      // Fallback to simple render
      await this.view.render(storiesList, maptilerKey);
      console.log('✅ Stories rendered with fallback method');
    }
  }

  async renderOfflineStories(storiesList, maptilerKey, userStories) {
    try {
      const categorizedStories = storiesList.map(story => {
        const categories = [];
        
        if (userStories.saved.find(s => s.id === story.id)) categories.push('saved');
        if (userStories.liked.find(s => s.id === story.id)) categories.push('liked');
        if (userStories.offline.find(s => s.id === story.id)) categories.push('offline');
        
        return { ...story, categories };
      });

      if (this.view.renderOfflineStories) {
        await this.view.renderOfflineStories(categorizedStories, maptilerKey);
      } else {
        // Fallback to regular render
        await this.view.render(categorizedStories, maptilerKey);
      }
    } catch (error) {
      console.error('❌ Error rendering offline stories:', error);
      await this.view.render(storiesList, maptilerKey);
    }
  }

  // Enhanced user action handlers with safety checks
  setupUserActionHandlers() {
    console.log('🎮 Setting up user action handlers...');
    
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.save-story-btn')) {
        e.preventDefault();
        const storyId = e.target.dataset.storyId;
        await this.handleSaveStory(storyId);
      }
      
      if (e.target.matches('.like-story-btn')) {
        e.preventDefault();
        const storyId = e.target.dataset.storyId;
        await this.handleLikeStory(storyId);
      }
      
      if (e.target.matches('.download-story-btn')) {
        e.preventDefault();
        const storyId = e.target.dataset.storyId;
        await this.handleDownloadStory(storyId);
      }
      
      if (e.target.matches('.download-all-btn')) {
        e.preventDefault();
        await this.handleDownloadAllVisible();
      }
    });
    
    console.log('✅ User action handlers setup complete');
  }

  // User action methods with better error handling
  async handleSaveStory(storyId) {
    try {
      if (!this.isStoryOfflineManagerReady()) {
        this.showErrorMessage('Fitur simpan tidak tersedia saat ini');
        return;
      }

      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isSaved) {
        await window.StoryOfflineManager.dbManager.removeSavedStory(storyId);
        this.updateStoryButton(storyId, 'save', false);
        this.showSuccessMessage('Dihapus dari daftar simpan');
      } else {
        await window.StoryOfflineManager.saveStoryForLater(story);
        this.updateStoryButton(storyId, 'save', true);
        this.showSuccessMessage('📚 Disimpan untuk dibaca nanti');
      }
    } catch (error) {
      console.error('❌ Save story failed:', error);
      this.showErrorMessage('Gagal menyimpan cerita');
    }
  }

  async handleLikeStory(storyId) {
    try {
      if (!this.isStoryOfflineManagerReady()) {
        this.showErrorMessage('Fitur like tidak tersedia saat ini');
        return;
      }

      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isLiked) {
        await window.StoryOfflineManager.dbManager.unlikeStory(storyId);
        this.updateStoryButton(storyId, 'like', false);
        this.showSuccessMessage('Dihapus dari favorit');
      } else {
        await window.StoryOfflineManager.likeStory(story);
        this.updateStoryButton(storyId, 'like', true);
        this.showSuccessMessage('❤️ Ditambahkan ke favorit');
      }
    } catch (error) {
      console.error('❌ Like story failed:', error);
      this.showErrorMessage('Gagal menandai cerita');
    }
  }

  async handleDownloadStory(storyId) {
    try {
      if (!this.isStoryOfflineManagerReady()) {
        this.showErrorMessage('Fitur download tidak tersedia saat ini');
        return;
      }

      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isOffline) {
        await window.StoryOfflineManager.dbManager.removeOfflineStory(storyId);
        this.updateStoryButton(storyId, 'download', false);
        this.showSuccessMessage('Dihapus dari offline');
      } else {
        await window.StoryOfflineManager.downloadForOffline(story);
        this.updateStoryButton(storyId, 'download', true);
        this.showSuccessMessage('📱 Tersedia offline');
      }
    } catch (error) {
      console.error('❌ Download story failed:', error);
      this.showErrorMessage('Gagal mengunduh cerita');
    }
  }

  async handleDownloadAllVisible() {
    try {
      if (!this.isStoryOfflineManagerReady()) {
        this.showErrorMessage('Fitur download tidak tersedia saat ini');
        return;
      }

      if (!this.currentStories || this.currentStories.length === 0) {
        this.showErrorMessage('Tidak ada cerita untuk diunduh');
        return;
      }

      const confirmed = await this.showConfirmDialog(
        'Download Semua',
        `Download ${this.currentStories.length} cerita untuk akses offline?`
      );

      if (!confirmed) return;

      this.showLoadingState(true, 'Downloading stories...');

      const downloaded = await window.StoryOfflineManager.downloadMultipleStories(
        this.currentStories,
        (current, total) => {
          this.updateDownloadProgress(current, total);
        }
      );

      this.currentStories.forEach(story => {
        this.updateStoryButton(story.id, 'download', true);
      });

      this.showSuccessMessage(`${downloaded} cerita berhasil diunduh untuk offline`);
      
    } catch (error) {
      console.error('❌ Download all failed:', error);
      this.showErrorMessage('Gagal mengunduh beberapa cerita');
    } finally {
      this.showLoadingState(false);
    }
  }

  // Helper methods
  isStoryOfflineManagerReady() {
    return window.StoryOfflineManager && 
           typeof window.StoryOfflineManager.getStoryStatus === 'function' &&
           window.StoryOfflineManager.initialized !== false;
  }

  findStoryById(storyId) {
    return this.currentStories.find(story => story.id === storyId);
  }

  updateStoryButton(storyId, action, isActive) {
    const button = document.querySelector(`[data-story-id="${storyId}"].${action}-story-btn`);
    if (!button) {
      console.warn('Button not found:', `[data-story-id="${storyId}"].${action}-story-btn`);
      return;
    }

    const icons = {
      save: { active: '📚', inactive: '📖' },
      like: { active: '❤️', inactive: '🤍' },
      download: { active: '📱', inactive: '📲' }
    };

    const icon = icons[action];
    if (icon) {
      button.textContent = isActive ? icon.active : icon.inactive;
      button.classList.toggle('active', isActive);
      
      const titles = {
        save: { active: 'Hapus dari simpanan', inactive: 'Simpan untuk nanti' },
        like: { active: 'Hapus dari favorit', inactive: 'Tambah ke favorit' },
        download: { active: 'Hapus dari offline', inactive: 'Download untuk offline' }
      };
      
      const title = titles[action];
      if (title) {
        button.title = isActive ? title.active : title.inactive;
      }
    }
  }

  updateDownloadProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    const loader = document.getElementById('pwa-loading');
    if (loader) {
      const progressText = loader.querySelector('p');
      if (progressText) {
        progressText.textContent = `Downloading ${current}/${total} stories (${percentage}%)`;
      }
    }
  }

  removeDuplicateStories(storiesList) {
    const seen = new Set();
    return storiesList.filter(story => {
      if (seen.has(story.id)) {
        return false;
      }
      seen.add(story.id);
      return true;
    });
  }

  showEmptyOfflineState() {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: #666;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">📱</div>
          <h2>Belum Ada Cerita Offline</h2>
          <p>Simpan atau download cerita saat online untuk akses offline</p>
          
          ${navigator.onLine ? `
            <button onclick="window.location.reload()" style="
              background: #1976d2; color: white; border: none;
              padding: 1rem 2rem; border-radius: 8px; cursor: pointer;
              font-size: 1rem; margin-top: 1rem;
            ">
              🔄 Muat Cerita Online
            </button>
          ` : `
            <p style="margin-top: 1rem; font-style: italic;">
              Hubungkan ke internet untuk melihat cerita terbaru
            </p>
          `}
        </div>
      `;
    }
  }

  showEmptyState(type = 'online') {
    if (this.view.showEmptyState) {
      this.view.showEmptyState(type);
    } else {
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: #666;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📖</div>
            <h2>Belum Ada Cerita</h2>
            <p>Belum ada cerita yang tersedia</p>
          </div>
        `;
      }
    }
  }

  // Refresh stories
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
      
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      
      if (error.message.includes('internet')) {
        this.showErrorMessage('Tidak ada koneksi internet. Menampilkan data tersimpan.');
        await this.loadUserStoriesOffline();
      } else {
        this.showErrorMessage(`Gagal memperbarui data: ${error.message}`);
      }
    }
  }

  setupNetworkListeners() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  async handleOnline() {
    console.log('🟢 Network: Back online');
    this.showInfoMessage('Koneksi kembali. Memuat data terbaru...');
    
    setTimeout(async () => {
      await this.refreshStories();
    }, 1000);
  }

  handleOffline() {
    console.log('🔴 Network: Gone offline');
    this.showOfflineStatus();
    this.showInfoMessage('Mode offline aktif. Menampilkan data tersimpan.');
    
    setTimeout(async () => {
      await this.loadUserStoriesOffline();
    }, 1000);
  }

  // Utility methods
  showLoadingState(show, message = 'Loading...') {
    const loader = document.getElementById('pwa-loading');
    if (loader) {
      if (show) {
        const textElement = loader.querySelector('p');
        if (textElement) {
          textElement.textContent = message;
        }
        loader.classList.add('show');
      } else {
        loader.classList.remove('show');
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
    
    if (duration > 0) {
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }, duration);
    }
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
                background: #2196f3; color: white; border: none; 
                padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;
              ">OK</button>
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
    this.removeOfflineIndicators();
  }

  showOfflineStatus() {
    console.log('🔴 App is offline');
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
      offlineIndicator.classList.add('show');
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
    this.showInfoMessage(message);
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
    
    this.showToast(errorMessage, 'error', 0);
  }

  resetRetryCount() {
    this.retryCount = 0;
  }

  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (window.storiesPresenter === this) {
      window.storiesPresenter = null;
    }
    
    console.log('🧹 StoriesListPresenter cleaned up');
  }
}