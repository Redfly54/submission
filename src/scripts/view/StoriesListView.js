// Updated StoriesListView.js - Complete and Fixed Implementation
export default class StoriesListView {
  constructor() {
    this.appContainer = document.getElementById('app');
  }

  // Enhanced render method with user action buttons
  async renderWithUserActions(stories, maptilerKey = '') {
    if (!this.appContainer) {
      console.error('App container not found');
      return;
    }

    // Create main layout
    this.appContainer.innerHTML = `
      <div class="stories-container">
        <!-- Header with actions -->
        <div class="stories-header">
          <div class="stories-info">
            <h2>📖 ${stories.length} Cerita Tersedia</h2>
            <p class="connection-status online">🟢 Online</p>
          </div>
          
          <div class="stories-actions">
            <button class="download-all-btn action-btn primary" title="Download semua untuk offline">
              📲 Download Semua
            </button>
            <button onclick="window.storiesPresenter?.showStorageManagement()" class="action-btn secondary" title="Kelola storage">
              ⚙️ Storage
            </button>
            <button onclick="window.storiesPresenter?.refreshStories()" class="action-btn secondary" title="Refresh data">
              🔄 Refresh
            </button>
          </div>
        </div>

        <!-- Stories Grid -->
        <div class="stories-grid">
          ${stories.map(story => this.createStoryCardWithActions(story)).join('')}
        </div>

        <!-- Map Container (if maptiler key available) -->
        ${maptilerKey ? `
          <div class="map-section">
            <h3>🗺️ Lokasi Cerita</h3>
            <div id="map" style="height: 400px; border-radius: 12px; overflow: hidden;"></div>
          </div>
        ` : ''}
      </div>
    `;

    // Initialize map if key available
    if (maptilerKey && window.maplibregl) {
      this.initializeMap(stories, maptilerKey);
    }

    // Add enhanced styles
    this.addEnhancedStyles();
  }

  // Create story card with action buttons
  createStoryCardWithActions(story) {
    const userStatus = story.userStatus || {};
    const hasLocation = story.lat && story.lon;
    
    return `
      <div class="story-card" data-story-id="${story.id}">
        <!-- Story Image -->
        <div class="story-image-container">
          <img src="${story.photoUrl}" alt="${story.name}" class="story-image" loading="lazy">
          
          <!-- Status Indicators -->
          <div class="story-status-indicators">
            ${userStatus.isSaved ? '<span class="status-badge saved">📚</span>' : ''}
            ${userStatus.isLiked ? '<span class="status-badge liked">❤️</span>' : ''}
            ${userStatus.isOffline ? '<span class="status-badge offline">📱</span>' : ''}
          </div>
        </div>

        <!-- Story Content -->
        <div class="story-content">
          <h3 class="story-title">${story.name}</h3>
          <p class="story-description">${this.truncateText(story.description, 100)}</p>
          
          <!-- Story Meta -->
          <div class="story-meta">
            <span class="story-date">📅 ${this.formatDate(story.createdAt)}</span>
            ${hasLocation ? '<span class="story-location">📍 Dengan lokasi</span>' : ''}
          </div>

          <!-- Action Buttons -->
          <div class="story-actions">
            <button 
              class="save-story-btn action-btn-sm ${userStatus.isSaved ? 'active' : ''}"
              data-story-id="${story.id}"
              title="${userStatus.isSaved ? 'Hapus dari simpanan' : 'Simpan untuk nanti'}"
            >
              ${userStatus.isSaved ? '📚' : '📖'}
            </button>
            
            <button 
              class="like-story-btn action-btn-sm ${userStatus.isLiked ? 'active' : ''}"
              data-story-id="${story.id}"
              title="${userStatus.isLiked ? 'Hapus dari favorit' : 'Tambah ke favorit'}"
            >
              ${userStatus.isLiked ? '❤️' : '🤍'}
            </button>
            
            <button 
              class="download-story-btn action-btn-sm ${userStatus.isOffline ? 'active' : ''}"
              data-story-id="${story.id}"
              title="${userStatus.isOffline ? 'Hapus dari offline' : 'Download untuk offline'}"
            >
              ${userStatus.isOffline ? '📱' : '📲'}
            </button>
            
            <button 
              class="view-story-btn action-btn-sm primary"
              onclick="window.location.hash='/story/${story.id}'"
              title="Lihat detail cerita"
            >
              👁️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Render offline stories with categories
  async renderOfflineStories(stories, maptilerKey = '') {
    if (!this.appContainer) {
      console.error('App container not found');
      return;
    }

    this.appContainer.innerHTML = `
      <div class="stories-container offline-mode">
        <!-- Offline Header -->
        <div class="stories-header offline">
          <div class="stories-info">
            <h2>📱 ${stories.length} Cerita Offline</h2>
            <p class="connection-status offline">🔴 Mode Offline</p>
          </div>
          
          <div class="stories-actions">
            <button onclick="window.storiesPresenter?.refreshStories()" class="action-btn primary" title="Coba muat online">
              📡 Coba Online
            </button>
            <button onclick="window.storiesPresenter?.showStorageManagement()" class="action-btn secondary" title="Kelola storage">
              ⚙️ Storage
            </button>
          </div>
        </div>

        <!-- Category Filters (if multiple categories exist) -->
        ${this.renderCategoryFilters(stories)}

        <!-- Stories Grid -->
        <div class="stories-grid offline">
          ${stories.map(story => this.createOfflineStoryCard(story)).join('')}
        </div>

        <!-- Map Container (if available) -->
        ${maptilerKey && stories.some(s => s.lat && s.lon) ? `
          <div class="map-section offline">
            <h3>🗺️ Lokasi Cerita Offline</h3>
            <div id="map" style="height: 400px; border-radius: 12px; overflow: hidden;"></div>
          </div>
        ` : ''}
      </div>
    `;

    // Initialize map if available
    if (maptilerKey && window.maplibregl && stories.some(s => s.lat && s.lon)) {
      this.initializeMap(stories, maptilerKey);
    }

    this.addEnhancedStyles();
    this.setupCategoryFilters();
  }

  // Create offline story card with category indicators
  createOfflineStoryCard(story) {
    const categories = story.categories || [];
    const hasLocation = story.lat && story.lon;
    
    return `
      <div class="story-card offline" data-story-id="${story.id}" data-categories="${categories.join(',')}">
        <!-- Story Image with Offline Indicator -->
        <div class="story-image-container">
          <img src="${story.photoUrl}" alt="${story.name}" class="story-image" loading="lazy">
          
          <!-- Category Badges -->
          <div class="story-category-badges">
            ${categories.map(cat => this.getCategoryBadge(cat)).join('')}
          </div>
          
          <!-- Offline Indicator -->
          <div class="offline-indicator-badge">📱</div>
        </div>

        <!-- Story Content -->
        <div class="story-content">
          <h3 class="story-title">${story.name}</h3>
          <p class="story-description">${this.truncateText(story.description, 100)}</p>
          
          <!-- Story Meta -->
          <div class="story-meta">
            <span class="story-date">📅 ${this.formatDate(story.createdAt)}</span>
            ${hasLocation ? '<span class="story-location">📍 Dengan lokasi</span>' : ''}
            <span class="story-cached">💾 ${this.formatDate(story.savedAt || story.likedAt || story.downloadedAt)}</span>
          </div>

          <!-- Offline Actions -->
          <div class="story-actions offline">
            <button 
              class="view-story-btn action-btn-sm primary"
              onclick="window.location.hash='/story/${story.id}'"
              title="Lihat detail cerita"
            >
              👁️ Lihat
            </button>
            
            <button 
              class="remove-offline-btn action-btn-sm danger"
              data-story-id="${story.id}"
              title="Hapus dari offline"
              onclick="window.storiesPresenter?.handleRemoveOfflineStory('${story.id}')"
            >
              🗑️ Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Render category filters
  renderCategoryFilters(stories) {
    const categories = new Set();
    stories.forEach(story => {
      if (story.categories) {
        story.categories.forEach(cat => categories.add(cat));
      }
    });

    if (categories.size <= 1) return '';

    return `
      <div class="category-filters">
        <button class="filter-btn active" data-filter="all">
          📚 Semua (${stories.length})
        </button>
        ${Array.from(categories).map(category => {
          const count = stories.filter(s => s.categories?.includes(category)).length;
          return `
            <button class="filter-btn" data-filter="${category}">
              ${this.getCategoryIcon(category)} ${this.getCategoryName(category)} (${count})
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  // Setup category filter functionality
  setupCategoryFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const storyCards = document.querySelectorAll('.story-card');

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        
        // Update active button
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Filter stories
        storyCards.forEach(card => {
          const categories = card.dataset.categories?.split(',') || [];
          
          if (filter === 'all' || categories.includes(filter)) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // Helper methods for categories
  getCategoryBadge(category) {
    const badges = {
      saved: '<span class="category-badge saved">📚 Tersimpan</span>',
      liked: '<span class="category-badge liked">❤️ Favorit</span>',
      offline: '<span class="category-badge offline">📱 Offline</span>'
    };
    return badges[category] || '';
  }

  getCategoryIcon(category) {
    const icons = {
      saved: '📚',
      liked: '❤️',
      offline: '📱'
    };
    return icons[category] || '📖';
  }

  getCategoryName(category) {
    const names = {
      saved: 'Tersimpan',
      liked: 'Favorit',
      offline: 'Offline'
    };
    return names[category] || category;
  }

  // Initialize map with stories
  initializeMap(stories, maptilerKey) {
    try {
      const storiesWithLocation = stories.filter(story => story.lat && story.lon);
      
      if (storiesWithLocation.length === 0) {
        console.log('No stories with location data');
        return;
      }

      // Initialize MapLibre
      const map = new maplibregl.Map({
        container: 'map',
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`,
        center: [storiesWithLocation[0].lon, storiesWithLocation[0].lat],
        zoom: 10
      });

      // Add markers for each story
      storiesWithLocation.forEach(story => {
        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'map-marker';
        markerEl.innerHTML = `
          <div class="marker-content" title="${story.name}">
            📍
          </div>
        `;

        // Create popup
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(`
            <div class="map-popup">
              <img src="${story.photoUrl}" alt="${story.name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;">
              <h4 style="margin: 0.5rem 0;">${story.name}</h4>
              <p style="margin: 0; font-size: 0.9rem; color: #666;">${this.truncateText(story.description, 80)}</p>
              <button onclick="window.location.hash='/story/${story.id}'" style="
                background: #1976d2; color: white; border: none;
                padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;
                margin-top: 0.5rem; width: 100%;
              ">
                Lihat Detail
              </button>
            </div>
          `);

        // Add marker to map
        new maplibregl.Marker(markerEl)
          .setLngLat([story.lon, story.lat])
          .setPopup(popup)
          .addTo(map);
      });

      // Fit map to show all markers
      if (storiesWithLocation.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        storiesWithLocation.forEach(story => {
          bounds.extend([story.lon, story.lat]);
        });
        map.fitBounds(bounds, { padding: 50 });
      }

    } catch (error) {
      console.error('❌ Map initialization failed:', error);
      
      // Show fallback message
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.innerHTML = `
          <div style="
            display: flex; align-items: center; justify-content: center;
            height: 100%; background: #f5f5f5; color: #666;
            border-radius: 12px; flex-direction: column;
          ">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🗺️</div>
            <p>Peta tidak tersedia</p>
          </div>
        `;
      }
    }
  }

  // Add enhanced styles
  addEnhancedStyles() {
    if (document.getElementById('enhanced-stories-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'enhanced-stories-styles';
    styles.textContent = `
      /* Stories Container */
      .stories-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }

      /* Header Styles */
      .stories-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .stories-header.offline {
        background: linear-gradient(135deg, #fff3e0, #ffcc80);
      }

      .stories-info h2 {
        margin: 0 0 0.5rem 0;
        color: #333;
      }

      .connection-status {
        font-weight: 500;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.9rem;
      }

      .connection-status.online {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .connection-status.offline {
        background: #fff3e0;
        color: #f57c00;
      }

      .stories-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      /* Action Buttons */
      .action-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.3s ease;
        font-size: 0.9rem;
      }

      .action-btn.primary {
        background: linear-gradient(135deg, #1976d2, #1565c0);
        color: white;
      }

      .action-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
      }

      .action-btn.secondary {
        background: #f5f5f5;
        color: #666;
        border: 1px solid #ddd;
      }

      .action-btn.secondary:hover {
        background: #e0e0e0;
      }

      .action-btn.danger {
        background: linear-gradient(135deg, #f44336, #d32f2f);
        color: white;
      }

      .action-btn.danger:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
      }

      /* Navigation Storage Button */
      .nav-storage-btn {
        background: #4caf50;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        margin-left: 0.5rem;
        transition: all 0.3s ease;
      }

      .nav-storage-btn:hover {
        background: #388e3c;
        transform: translateY(-1px);
      }

      /* Category Filters */
      .category-filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        flex-wrap: wrap;
      }

      .filter-btn {
        padding: 0.5rem 1rem;
        border: 2px solid #e0e0e0;
        border-radius: 20px;
        background: white;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.9rem;
      }

      .filter-btn.active,
      .filter-btn:hover {
        border-color: #1976d2;
        background: #e3f2fd;
        color: #1976d2;
      }

      /* Stories Grid */
      .stories-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      /* Story Cards */
      .story-card {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }

      .story-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      }

      .story-card.offline {
        border: 2px solid #ff9800;
      }

      /* Story Image */
      .story-image-container {
        position: relative;
        height: 200px;
        overflow: hidden;
      }

      .story-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      .story-card:hover .story-image {
        transform: scale(1.05);
      }

      /* Status Indicators */
      .story-status-indicators {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        display: flex;
        gap: 0.25rem;
        flex-direction: column;
      }

      .status-badge {
        background: rgba(255,255,255,0.9);
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.8rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .status-badge.saved {
        background: rgba(33, 150, 243, 0.1);
        color: #1976d2;
      }

      .status-badge.liked {
        background: rgba(233, 30, 99, 0.1);
        color: #c2185b;
      }

      .status-badge.offline {
        background: rgba(76, 175, 80, 0.1);
        color: #388e3c;
      }

      /* Category Badges */
      .story-category-badges {
        position: absolute;
        top: 0.75rem;
        left: 0.75rem;
        display: flex;
        gap: 0.25rem;
        flex-direction: column;
      }

      .category-badge {
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.7rem;
      }

      .offline-indicator-badge {
        position: absolute;
        bottom: 0.75rem;
        right: 0.75rem;
        background: rgba(255, 152, 0, 0.9);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.8rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      /* Story Content */
      .story-content {
        padding: 1.5rem;
      }

      .story-title {
        margin: 0 0 0.75rem 0;
        color: #333;
        font-size: 1.1rem;
        line-height: 1.4;
      }

      .story-description {
        margin: 0 0 1rem 0;
        color: #666;
        line-height: 1.5;
        font-size: 0.9rem;
      }

      .story-meta {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        font-size: 0.8rem;
        color: #888;
        flex-wrap: wrap;
      }

      /* Story Actions */
      .story-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
      }

      .action-btn-sm {
        padding: 0.5rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 1rem;
        min-width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        color: #666;
      }

      .action-btn-sm:hover {
        transform: translateY(-2px);
      }

      .action-btn-sm.active {
        background: #e3f2fd;
        border: 2px solid #1976d2;
      }

      .action-btn-sm.primary {
        background: linear-gradient(135deg, #1976d2, #1565c0);
        color: white;
      }

      .action-btn-sm.danger {
        background: linear-gradient(135deg, #f44336, #d32f2f);
        color: white;
      }

      /* Map Section */
      .map-section {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-top: 2rem;
      }

      .map-section h3 {
        margin: 0 0 1rem 0;
        color: #333;
      }

      .map-section.offline {
        border: 2px solid #ff9800;
      }

      /* Map Markers */
      .map-marker {
        cursor: pointer;
        font-size: 1.5rem;
      }

      .marker-content {
        transition: transform 0.3s ease;
      }

      .map-marker:hover .marker-content {
        transform: scale(1.2);
      }

      .map-popup {
        max-width: 200px;
      }

      .map-popup img {
        border-radius: 8px;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .stories-header {
          flex-direction: column;
          gap: 1rem;
          text-align: center;
        }

        .stories-actions {
          justify-content: center;
        }

        .stories-grid {
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .category-filters {
          justify-content: center;
        }

        .story-actions {
          flex-wrap: wrap;
        }

        .action-btn {
          font-size: 0.8rem;
          padding: 0.5rem 1rem;
        }
      }

      /* Loading States */
      .story-card.loading {
        opacity: 0.6;
        pointer-events: none;
      }

      .story-card.loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Animations */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .story-card {
        animation: fadeInUp 0.5s ease forwards;
      }

      .story-card:nth-child(1) { animation-delay: 0.1s; }
      .story-card:nth-child(2) { animation-delay: 0.2s; }
      .story-card:nth-child(3) { animation-delay: 0.3s; }
      .story-card:nth-child(4) { animation-delay: 0.4s; }
      .story-card:nth-child(5) { animation-delay: 0.5s; }
    `;

    document.head.appendChild(styles);
  }

  // Utility methods
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Kemarin';
      if (diffDays < 7) return `${diffDays} hari lalu`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
      
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  // Legacy render method for backward compatibility
  async render(stories, maptilerKey = '') {
    // Convert stories to have empty userStatus
    const storiesWithEmptyStatus = stories.map(story => ({
      ...story,
      userStatus: { isSaved: false, isLiked: false, isOffline: false }
    }));

    return this.renderWithUserActions(storiesWithEmptyStatus, maptilerKey);
  }

  // Method to update story card status
  updateStoryStatus(storyId, status) {
    const card = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!card) return;

    // Update action buttons
    const saveBtn = card.querySelector('.save-story-btn');
    const likeBtn = card.querySelector('.like-story-btn');
    const downloadBtn = card.querySelector('.download-story-btn');

    if (saveBtn) {
      saveBtn.textContent = status.isSaved ? '📚' : '📖';
      saveBtn.classList.toggle('active', status.isSaved);
      saveBtn.title = status.isSaved ? 'Hapus dari simpanan' : 'Simpan untuk nanti';
    }

    if (likeBtn) {
      likeBtn.textContent = status.isLiked ? '❤️' : '🤍';
      likeBtn.classList.toggle('active', status.isLiked);
      likeBtn.title = status.isLiked ? 'Hapus dari favorit' : 'Tambah ke favorit';
    }

    if (downloadBtn) {
      downloadBtn.textContent = status.isOffline ? '📱' : '📲';
      downloadBtn.classList.toggle('active', status.isOffline);
      downloadBtn.title = status.isOffline ? 'Hapus dari offline' : 'Download untuk offline';
    }

    // Update status indicators
    const statusIndicators = card.querySelector('.story-status-indicators');
    if (statusIndicators) {
      statusIndicators.innerHTML = '';
      
      if (status.isSaved) {
        statusIndicators.innerHTML += '<span class="status-badge saved">📚</span>';
      }
      if (status.isLiked) {
        statusIndicators.innerHTML += '<span class="status-badge liked">❤️</span>';
      }
      if (status.isOffline) {
        statusIndicators.innerHTML += '<span class="status-badge offline">📱</span>';
      }
    }
  }

  // Show loading state for specific story
  setStoryLoading(storyId, isLoading) {
    const card = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!card) return;

    if (isLoading) {
      card.classList.add('loading');
    } else {
      card.classList.remove('loading');
    }
  }

  // Show empty state when no stories
  showEmptyState(type = 'online') {
    if (!this.appContainer) return;

    const emptyStates = {
      online: {
        icon: '📖',
        title: 'Belum Ada Cerita',
        message: 'Belum ada cerita yang tersedia. Tambahkan cerita pertama Anda!',
        action: `
          <button onclick="window.location.hash='/add'" style="
            background: #1976d2; color: white; border: none;
            padding: 1rem 2rem; border-radius: 8px; cursor: pointer;
            font-size: 1rem; margin-top: 1rem;
          ">
            ➕ Tambah Cerita
          </button>
        `
      },
      offline: {
        icon: '📱',
        title: 'Belum Ada Cerita Offline',
        message: 'Simpan atau download cerita saat online untuk akses offline',
        action: navigator.onLine ? `
          <button onclick="window.location.reload()" style="
            background: #1976d2; color: white; border: none;
            padding: 1rem 2rem; border-radius: 8px; cursor: pointer;
            font-size: 1rem; margin-top: 1rem;
          ">
            🔄 Muat Cerita Online
          </button>
        ` : `
          <p style="margin-top: 1rem; font-style: italic; color: #888;">
            Hubungkan ke internet untuk melihat cerita terbaru
          </p>
        `
      },
      error: {
        icon: '❌',
        title: 'Terjadi Kesalahan',
        message: 'Gagal memuat cerita. Silakan coba lagi.',
        action: `
          <button onclick="window.storiesPresenter?.refreshStories()" style="
            background: #f44336; color: white; border: none;
            padding: 1rem 2rem; border-radius: 8px; cursor: pointer;
            font-size: 1rem; margin-top: 1rem;
          ">
            🔄 Coba Lagi
          </button>
        `
      }
    };

    const state = emptyStates[type] || emptyStates.online;

    this.appContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: #666;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${state.icon}</div>
        <h2 style="color: #333; margin-bottom: 1rem;">${state.title}</h2>
        <p style="max-width: 400px; margin: 0 auto 2rem auto; line-height: 1.6;">
          ${state.message}
        </p>
        ${state.action}
      </div>
    `;
  }

  // Show loading state
  showLoadingState(message = 'Memuat cerita...') {
    if (!this.appContainer) return;

    this.appContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div class="loading-spinner" style="
          width: 50px;
          height: 50px;
          border: 4px solid #e3f2fd;
          border-top: 4px solid #1976d2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        "></div>
        <p style="color: #666; font-size: 1.1rem;">${message}</p>
      </div>
      
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  // Show network status indicator
  updateNetworkStatus(isOnline) {
    const statusElements = document.querySelectorAll('.connection-status');
    
    statusElements.forEach(element => {
      if (isOnline) {
        element.className = 'connection-status online';
        element.textContent = '🟢 Online';
      } else {
        element.className = 'connection-status offline';
        element.textContent = '🔴 Offline';
      }
    });
  }

  // Update stories count in header
  updateStoriesCount(count, type = 'online') {
    const headers = document.querySelectorAll('.stories-info h2');
    
    headers.forEach(header => {
      if (type === 'online') {
        header.textContent = `📖 ${count} Cerita Tersedia`;
      } else {
        header.textContent = `📱 ${count} Cerita Offline`;
      }
    });
  }

  // Add story to existing grid (for real-time updates)
  addStoryToGrid(story) {
    const grid = document.querySelector('.stories-grid');
    if (!grid) return;

    const storyCard = this.createStoryCardWithActions(story);
    
    // Create temporary container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = storyCard;
    
    // Add to grid with animation
    const cardElement = tempDiv.firstElementChild;
    cardElement.style.opacity = '0';
    cardElement.style.transform = 'translateY(20px)';
    
    grid.insertBefore(cardElement, grid.firstChild);
    
    // Trigger animation
    setTimeout(() => {
      cardElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      cardElement.style.opacity = '1';
      cardElement.style.transform = 'translateY(0)';
    }, 100);

    // Update count
    const currentCount = grid.children.length;
    this.updateStoriesCount(currentCount);
  }

  // Remove story from grid
  removeStoryFromGrid(storyId) {
    const card = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!card) return;

    // Animate out
    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px)';

    setTimeout(() => {
      card.remove();
      
      // Update count
      const grid = document.querySelector('.stories-grid');
      if (grid) {
        this.updateStoriesCount(grid.children.length);
      }
    }, 300);
  }

  // Show notification/toast
  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const colors = {
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3'
    };

    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1003;
        max-width: 300px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      ">
        <span>${icons[type]}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 0;
          margin-left: 0.5rem;
        ">×</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      const notifEl = notification.firstElementChild;
      notifEl.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        const notifEl = notification.firstElementChild;
        if (notifEl) {
          notifEl.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (notification.parentElement) {
              notification.remove();
            }
          }, 300);
        }
      }, duration);
    }
  }

  // Create pagination controls
  createPagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';

    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Previous button
    if (currentPage > 1) {
      pages.push(`
        <button class="pagination-btn" onclick="${onPageChange}(${currentPage - 1})" title="Previous">
          ← Sebelumnya
        </button>
      `);
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(`
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                onclick="${onPageChange}(${i})" title="Page ${i}">
          ${i}
        </button>
      `);
    }

    // Next button
    if (currentPage < totalPages) {
      pages.push(`
        <button class="pagination-btn" onclick="${onPageChange}(${currentPage + 1})" title="Next">
          Selanjutnya →
        </button>
      `);
    }

    return `
      <div class="pagination-container">
        <div class="pagination">
          ${pages.join('')}
        </div>
        <div class="pagination-info">
          Halaman ${currentPage} dari ${totalPages}
        </div>
        
        <style>
          .pagination-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 2rem 0;
            gap: 1rem;
          }
          
          .pagination {
            display: flex;
            gap: 0.5rem;
          }
          
          .pagination-btn {
            padding: 0.5rem 1rem;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .pagination-btn:hover {
            background: #f5f5f5;
          }
          
          .pagination-btn.active {
            background: #1976d2;
            color: white;
            border-color: #1976d2;
          }
          
          .pagination-info {
            color: #666;
            font-size: 0.9rem;
          }
          
          @media (max-width: 768px) {
            .pagination-container {
              flex-direction: column;
              gap: 0.5rem;
            }
            
            .pagination-btn {
              font-size: 0.8rem;
              padding: 0.4rem 0.8rem;
            }
          }
        </style>
      </div>
    `;
  }

  // Search functionality
  createSearchBar(onSearch, placeholder = 'Cari cerita...') {
    return `
      <div class="search-container">
        <div class="search-bar">
          <input 
            type="text" 
            id="story-search" 
            placeholder="${placeholder}"
            class="search-input"
          >
          <button class="search-btn" onclick="${onSearch}()" title="Cari">
            🔍
          </button>
        </div>
        
        <style>
          .search-container {
            margin-bottom: 1.5rem;
          }
          
          .search-bar {
            display: flex;
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 25px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          
          .search-input {
            flex: 1;
            padding: 0.75rem 1rem;
            border: none;
            outline: none;
            font-size: 1rem;
          }
          
          .search-btn {
            padding: 0.75rem 1rem;
            border: none;
            background: #1976d2;
            color: white;
            cursor: pointer;
            transition: background 0.3s ease;
          }
          
          .search-btn:hover {
            background: #1565c0;
          }
          
          @media (max-width: 768px) {
            .search-bar {
              max-width: 100%;
            }
          }
        </style>
      </div>
    `;
  }

  // Filter search results
  filterStories(searchTerm) {
    const cards = document.querySelectorAll('.story-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const title = card.querySelector('.story-title').textContent.toLowerCase();
      const description = card.querySelector('.story-description').textContent.toLowerCase();
      const search = searchTerm.toLowerCase();

      if (title.includes(search) || description.includes(search) || search === '') {
        card.style.display = 'block';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Update count
    const header = document.querySelector('.stories-info h2');
    if (header) {
      if (searchTerm) {
        header.textContent = `🔍 ${visibleCount} hasil pencarian`;
      } else {
        header.textContent = `📖 ${cards.length} Cerita Tersedia`;
      }
    }

    return visibleCount;
  }

  // Cleanup method
  destroy() {
    // Remove event listeners
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });

    // Remove styles
    const styles = document.getElementById('enhanced-stories-styles');
    if (styles) {
      styles.remove();
    }

    // Clear container
    if (this.appContainer) {
      this.appContainer.innerHTML = '';
    }

    console.log('🧹 StoriesListView cleaned up');
  }
}