// Updated StoriesListPresenter.js - User-driven storage approach
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
    this.currentStories = []; // Store current stories for user actions
    
    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Setup network listeners
    this.setupNetworkListeners();
    
    // Setup user action handlers
    this.setupUserActionHandlers();
    window.storiesPresenter = this;
  }

  async init() {
    if (this.isInitializing) {
      console.log('⏳ Already initializing...');
      return;
    }

    this.isInitializing = true;

    try {
      // Check if the user is logged in
      if (!this.model.token) {
        alert('Anda harus login terlebih dahulu');
        return location.hash = '/login';
      }

      // Initialize storage (for user actions only)
      await this.initStorage();

      // Load configuration
      const config = await this.loadConfigWithFallback();
      
      // CHANGED: Always try to load fresh data first
      if (navigator.onLine) {
        await this.loadStoriesOnline(config.maptilerKey);
      } else {
        // If offline, show only user's saved/downloaded stories
        await this.loadUserStoriesOffline(config.maptilerKey);
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
      console.log('🔧 Initializing user storage...');
      
      // Initialize enhanced storage manager
      if (window.StoryOfflineManager) {
        await window.StoryOfflineManager.init();
        console.log('✅ User storage ready');
        return true;
      } else {
        throw new Error('StoryOfflineManager not available');
      }
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      this.showErrorMessage('Fitur offline tidak tersedia. Aplikasi tetap bisa digunakan.');
      return false;
    }
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

  // CHANGED: No auto-cache, just load and display
  // async loadStoriesOnline(maptilerKey) {
  //   try {
  //     console.log('📡 Loading fresh stories from API...');
  //     this.showLoadingState(true);
      
  //     // Fetch stories from API
  //     const { listStory: stories } = await this.model.getAllStories();

  //     if (!stories || stories.length === 0) {
  //       throw new Error('No stories returned from API');
  //     }

  //     // Store for user actions
  //     this.currentStories = stories;

  //     // REMOVED: Auto-cache to IndexedDB
  //     // const saveSuccess = await storyStorage.saveStories(stories);

  //     // Render stories with user action buttons
  //     await this.renderStoriesWithUserActions(stories, maptilerKey);
      
  //     this.showOnlineStatus();
  //     this.showSuccessMessage(`${stories.length} stories loaded`);
  //     this.resetRetryCount();
      
  //   } catch (error) {
  //     console.log('❌ Online loading failed, showing user content...', error);
  //     this.retryCount++;
      
  //     // Show user's saved content instead
  //     await this.loadUserStoriesOffline();
      
  //     if (this.retryCount < this.maxRetries) {
  //       this.showRetryOption();
  //     }
  //   } finally {
  //     this.showLoadingState(false);
  //   }
  // }
  async loadStoriesOnline(maptilerKey) {
  try {
    console.log('📡 Loading fresh stories from API...');
    this.showLoadingState(true);
    
    // PERBAIKAN: Tambah try-catch untuk API call
    let stories;
    try {
      const result = await this.model.getAllStories();
      stories = result.listStory;
    } catch (apiError) {
      // Jika API error (503, network, dll), langsung ke offline mode
      console.log('❌ API Error:', apiError.message);
      
      if (apiError.message.includes('503') || apiError.message.includes('Service Unavailable')) {
        this.showErrorMessage('Server sedang maintenance. Menampilkan data offline...');
      } else {
        this.showErrorMessage('Koneksi bermasalah. Menampilkan data offline...');
      }
      
      // Langsung load offline data
      await this.loadUserStoriesOffline(maptilerKey);
      return;
    }

    if (!stories || stories.length === 0) {
      throw new Error('No stories returned from API');
    }

    this.currentStories = stories;
    await this.renderStoriesWithUserActions(stories, maptilerKey);
    
    this.showOnlineStatus();
    this.showSuccessMessage(`${stories.length} stories loaded`);
    this.resetRetryCount();
    
  } catch (error) {
    console.log('❌ General error:', error);
    await this.loadUserStoriesOffline(maptilerKey);
    
    // Show retry option
    this.showToast(
      `Gagal memuat data. <button onclick="window.storiesPresenter?.refreshStories()" style="background: white; color: #2196f3; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">Coba Lagi</button>`,
      'warning',
      8000
    );
  } finally {
    this.showLoadingState(false);
  }
}

  // NEW: Load only user's saved/downloaded stories when offline
  async loadUserStoriesOffline(maptilerKey = '') {
    try {
      console.log('📱 Loading user stories from offline storage...');
      this.showLoadingState(true, 'Loading your saved stories...');
      
      if (!window.StoryOfflineManager) {
        throw new Error('Offline manager not available');
      }

      // Get all user stories (saved, liked, offline)
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

      // Remove duplicates (story might be both saved and liked)
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

  // NEW: Render stories with user action buttons
  async renderStoriesWithUserActions(stories, maptilerKey) {
    // Get user status for each story
    const storiesWithStatus = await Promise.all(
      stories.map(async (story) => {
        let status = { isSaved: false, isLiked: false, isOffline: false };
        
        if (window.StoryOfflineManager) {
          status = await window.StoryOfflineManager.getStoryStatus(story.id);
        }
        
        return { ...story, userStatus: status };
      })
    );

    // Render with enhanced view
    await this.view.renderWithUserActions(storiesWithStatus, maptilerKey);
  }

  // NEW: Render offline stories with categories
  async renderOfflineStories(stories, maptilerKey, userStories) {
    // Add category info to stories
    const categorizedStories = stories.map(story => {
      const categories = [];
      
      if (userStories.saved.find(s => s.id === story.id)) categories.push('saved');
      if (userStories.liked.find(s => s.id === story.id)) categories.push('liked');
      if (userStories.offline.find(s => s.id === story.id)) categories.push('offline');
      
      return { ...story, categories };
    });

    await this.view.renderOfflineStories(categorizedStories, maptilerKey);
  }

  // NEW: Setup user action handlers
  setupUserActionHandlers() {
    // Save story for later
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.save-story-btn')) {
        const storyId = e.target.dataset.storyId;
        await this.handleSaveStory(storyId);
      }
    });

    // Like story
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.like-story-btn')) {
        const storyId = e.target.dataset.storyId;
        await this.handleLikeStory(storyId);
      }
    });

    // Download for offline
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.download-story-btn')) {
        const storyId = e.target.dataset.storyId;
        await this.handleDownloadStory(storyId);
      }
    });

    // Download all visible stories
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.download-all-btn')) {
        await this.handleDownloadAllVisible();
      }
    });
  }

  // NEW: User action handlers
  async handleSaveStory(storyId) {
    try {
      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isSaved) {
        // Remove from saved
        await window.StoryOfflineManager.dbManager.removeSavedStory(storyId);
        this.updateStoryButton(storyId, 'save', false);
        this.showSuccessMessage('Dihapus dari daftar simpan');
      } else {
        // Save story
        await window.StoryOfflineManager.saveStoryForLater(story);
        this.updateStoryButton(storyId, 'save', true);
      }
    } catch (error) {
      console.error('❌ Save story failed:', error);
      this.showErrorMessage('Gagal menyimpan cerita');
    }
  }

  async handleLikeStory(storyId) {
    try {
      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isLiked) {
        // Unlike
        await window.StoryOfflineManager.dbManager.unlikeStory(storyId);
        this.updateStoryButton(storyId, 'like', false);
        this.showSuccessMessage('Dihapus dari favorit');
      } else {
        // Like story
        await window.StoryOfflineManager.likeStory(story);
        this.updateStoryButton(storyId, 'like', true);
        
        // Auto-save if user preference enabled
        const autoSave = await window.StoryOfflineManager.getAutoSaveLiked();
        if (autoSave) {
          await window.StoryOfflineManager.downloadForOffline(story);
          this.updateStoryButton(storyId, 'download', true);
        }
      }
    } catch (error) {
      console.error('❌ Like story failed:', error);
      this.showErrorMessage('Gagal menandai cerita');
    }
  }

  async handleDownloadStory(storyId) {
    try {
      const story = this.findStoryById(storyId);
      if (!story) throw new Error('Story not found');

      const status = await window.StoryOfflineManager.getStoryStatus(storyId);
      
      if (status.isOffline) {
        // Remove from offline
        await window.StoryOfflineManager.dbManager.removeOfflineStory(storyId);
        this.updateStoryButton(storyId, 'download', false);
        this.showSuccessMessage('Dihapus dari offline');
      } else {
        // Download for offline
        await window.StoryOfflineManager.downloadForOffline(story);
        this.updateStoryButton(storyId, 'download', true);
      }
    } catch (error) {
      console.error('❌ Download story failed:', error);
      this.showErrorMessage('Gagal mengunduh cerita');
    }
  }

  async handleDownloadAllVisible() {
    try {
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

      // Update all download buttons
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

  // NEW: Helper methods
  findStoryById(storyId) {
    return this.currentStories.find(story => story.id === storyId);
  }

  updateStoryButton(storyId, action, isActive) {
    const button = document.querySelector(`[data-story-id="${storyId}"].${action}-story-btn`);
    if (!button) return;

    const icons = {
      save: { active: '📚', inactive: '📖' },
      like: { active: '❤️', inactive: '🤍' },
      download: { active: '📱', inactive: '📲' }
    };

    const icon = icons[action];
    if (icon) {
      button.textContent = isActive ? icon.active : icon.inactive;
      button.classList.toggle('active', isActive);
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

  removeDuplicateStories(stories) {
    const seen = new Set();
    return stories.filter(story => {
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

  // UPDATED: Enhanced refresh without auto-cache
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

  // NEW: Clear user data with categories
  async clearUserData(category = 'all') {
    const categoryNames = {
      'saved': 'cerita tersimpan',
      'liked': 'cerita favorit', 
      'offline': 'unduhan offline',
      'all': 'semua data pengguna'
    };

    const confirmed = await this.showConfirmDialog(
      'Hapus Data', 
      `Apakah Anda yakin ingin menghapus ${categoryNames[category]}?`
    );
    
    if (!confirmed) return;

    try {
      this.showLoadingState(true, 'Clearing data...');
      
      if (!window.StoryOfflineManager) {
        throw new Error('Offline manager not available');
      }

      const success = await window.StoryOfflineManager.dbManager.clearUserData(category);
      
      if (success) {
        this.showSuccessMessage(`${categoryNames[category]} berhasil dihapus`);
        
        // Refresh view
        if (navigator.onLine) {
          await this.init();
        } else {
          await this.loadUserStoriesOffline();
        }
      } else {
        throw new Error('Gagal menghapus data');
      }
    } catch (error) {
      console.error('❌ Clear data failed:', error);
      this.showErrorMessage(`Gagal menghapus data: ${error.message}`);
    }
  }

  // NEW: Show user storage management UI
  async showStorageManagement() {
    try {
      if (!window.StoryOfflineManager) {
        this.showErrorMessage('Fitur storage tidak tersedia');
        return;
      }

      const storageInfo = await window.StoryOfflineManager.getStorageInfo();
      
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = `
          <div style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
            <h2>📊 Manajemen Storage</h2>
            
            <div style="display: grid; gap: 1rem; margin: 2rem 0;">
              <!-- Storage Stats -->
              <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                <h3>📈 Statistik Penyimpanan</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; color: #1976d2;">📚</div>
                    <div style="font-weight: bold;">${storageInfo.counts.saved || 0}</div>
                    <div style="font-size: 0.9rem; color: #666;">Tersimpan</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; color: #e91e63;">❤️</div>
                    <div style="font-weight: bold;">${storageInfo.counts.liked || 0}</div>
                    <div style="font-size: 0.9rem; color: #666;">Favorit</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; color: #4caf50;">📱</div>
                    <div style="font-weight: bold;">${storageInfo.counts.offline || 0}</div>
                    <div style="font-size: 0.9rem; color: #666;">Offline</div>
                  </div>
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd;">
                  <strong>Total: ${storageInfo.counts.total || 0} cerita</strong>
                  <br>
                  <span style="color: #666;">Ukuran: ${storageInfo.sizes.total || '0 Bytes'}</span>
                </div>
              </div>

              <!-- Management Actions -->
              <div style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid #eee;">
                <h3>🛠️ Kelola Data</h3>
                <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
                  <button onclick="window.storiesPresenter?.clearUserData('saved')" style="
                    background: #ff9800; color: white; border: none;
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                  ">🗑️ Hapus Cerita Tersimpan</button>
                  
                  <button onclick="window.storiesPresenter?.clearUserData('liked')" style="
                    background: #e91e63; color: white; border: none;
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                  ">💔 Hapus Favorit</button>
                  
                  <button onclick="window.storiesPresenter?.clearUserData('offline')" style="
                    background: #f44336; color: white; border: none;
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                  ">📱 Hapus Unduhan Offline</button>
                  
                  <button onclick="window.storiesPresenter?.clearUserData('all')" style="
                    background: #9e9e9e; color: white; border: none;
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                  ">🗑️ Hapus Semua Data</button>
                </div>
              </div>

              <!-- Export/Import -->
              <div style="background: #e8f5e8; padding: 1.5rem; border-radius: 12px;">
                <h3>💾 Backup & Restore</h3>
                <div style="display: grid; gap: 0.75rem; margin-top: 1rem;">
                  <button onclick="window.storiesPresenter?.exportUserData()" style="
                    background: #4caf50; color: white; border: none;
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                  ">📤 Export Data</button>
                  
                  <label style="
                    background: #2196f3; color: white; 
                    padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer;
                    display: inline-block; text-align: center;
                  ">
                    📥 Import Data
                    <input type="file" accept=".json" style="display: none;" 
                           onchange="window.storiesPresenter?.handleImportFile(this.files[0])">
                  </label>
                </div>
              </div>

              <!-- Back Button -->
              <button onclick="window.storiesPresenter?.init()" style="
                background: #666; color: white; border: none;
                padding: 1rem 2rem; border-radius: 8px; cursor: pointer;
                font-size: 1rem; margin-top: 1rem;
              ">← Kembali ke Cerita</button>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('❌ Show storage management failed:', error);
      this.showErrorMessage('Gagal menampilkan manajemen storage');
    }
  }

  // NEW: Export user data
  async exportUserData() {
    try {
      if (!window.StoryOfflineManager) {
        this.showErrorMessage('Fitur export tidak tersedia');
        return;
      }

      const exportData = await window.StoryOfflineManager.exportUserData();
      
      if (!exportData) {
        this.showErrorMessage('Gagal mengekspor data');
        return;
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dicoding-stories-user-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccessMessage('Data berhasil diekspor');
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      this.showErrorMessage('Gagal mengekspor data');
    }
  }

  // NEW: Handle import file
  async handleImportFile(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.userStories || !importData.version) {
        throw new Error('Format file tidak valid');
      }

      const confirmed = await this.showConfirmDialog(
        'Import Data',
        `Import data dari ${importData.exportDate}? Data yang ada akan diganti.`
      );

      if (!confirmed) return;

      this.showLoadingState(true, 'Importing data...');

      // Clear existing data
      await window.StoryOfflineManager.clearAllUserData();
      
      // Import user stories
      const { saved, liked, offline } = importData.userStories;
      
      if (saved && saved.length > 0) {
        for (const story of saved) {
          await window.StoryOfflineManager.dbManager.saveStoryForLater(story);
        }
      }
      
      if (liked && liked.length > 0) {
        for (const story of liked) {
          await window.StoryOfflineManager.dbManager.likeStory(story);
        }
      }
      
      if (offline && offline.length > 0) {
        for (const story of offline) {
          await window.StoryOfflineManager.dbManager.downloadStoryForOffline(story);
        }
      }

      // Import preferences
      if (importData.preferences) {
        const prefs = importData.preferences;
        if (typeof prefs.autoSaveLiked !== 'undefined') {
          await window.StoryOfflineManager.setAutoSaveLiked(prefs.autoSaveLiked);
        }
        if (typeof prefs.offlineMode !== 'undefined') {
          await window.StoryOfflineManager.setOfflineMode(prefs.offlineMode);
        }
      }

      const totalImported = (saved?.length || 0) + (liked?.length || 0) + (offline?.length || 0);
      this.showSuccessMessage(`Berhasil mengimpor ${totalImported} cerita`);
      
      // Refresh view
      await this.showStorageManagement();
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      this.showErrorMessage(`Gagal mengimpor data: ${error.message}`);
    } finally {
      this.showLoadingState(false);
    }
  }

  // Keep existing network and utility methods...
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
    
    // Load user's offline content
    setTimeout(async () => {
      await this.loadUserStoriesOffline();
    }, 1000);
  }

  // Keep existing utility methods (showLoadingState, showToast, etc.)
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
    
    this.showToast(errorMessage, 'error', 0);
  }

  resetRetryCount() {
    this.retryCount = 0;
  }

  // Cleanup method
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (window.storiesPresenter === this) {
      window.storiesPresenter = null;
    }
    
    console.log('🧹 StoriesListPresenter cleaned up');
  }
}