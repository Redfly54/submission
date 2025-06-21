// ========================================
// PWA INTEGRATION - Add to top of existing app.js
// ========================================

// PWA Navigation Helper (fixed untuk story_token)
const PWANavigationHelper = {
  // Update navigation based on auth status
  updateNavigation() {
    const nav = document.getElementById('main-nav');
    const token = localStorage.getItem('story_token');
    
    console.log('Updating navigation, token:', token ? 'exists' : 'not found');
    
    if (token && nav) {
      // User is logged in - show relevant nav
      nav.innerHTML = `
        <a href="#/stories">All Stories</a> |
        <a href="#/add">Add Story</a> |
        <a href="#" onclick="PWANavigationHelper.logout(); return false;">Logout</a>
      `;
      console.log('✅ Navigation updated for authenticated user');
    } else if (nav) {
      // User not logged in - show login/register
      nav.innerHTML = `
        <a href="#/login">Login</a> |
        <a href="#/register">Register</a> |
        <a href="#/stories">All Stories</a>
      `;
      console.log('✅ Navigation updated for guest user');
    }
  },
  
  // Handle logout
  logout() {
    // Clear story_token (sesuai dengan LoginModel)
    localStorage.removeItem('story_token');
    localStorage.removeItem('userData'); // jika ada data user tambahan
    
    // Update navigation
    this.updateNavigation();
    
    // Redirect to login
    window.location.hash = '/login';
    
    // Optional: Show logout message
    console.log('✅ Logged out successfully');
    
    // Show success message
    if (window.PWAIntegration) {
      window.PWAIntegration.showSuccess('Berhasil logout');
    }
    
    return false; // Prevent default link behavior
  }
};

// ========================================
// YOUR EXISTING APP.JS CODE (enhanced)
// ========================================
import Model from './model.js';
import AddStoryPresenter from './presenter/AddStoryPresenter.js';
import LoginPresenter from './presenter/LoginPresenter.js';
import RegisterPresenter from './presenter/RegisterPresenter.js';
import StoriesListPresenter from './presenter/StoriesListPresenter.js';
import StoryDetailPresenter from './presenter/StoryDetailPresenter.js';
// FIXED: Import dengan nama yang benar
import { IndexDBManager } from './utils/IndexDBManager.js';

// FIXED: Initialize IndexedDB properly
let dbManager;

// Initialize navigation on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOM loaded, initializing...');
  
  // FIXED: Initialize IndexedDB dengan error handling
  try {
    dbManager = new IndexDBManager();
    await dbManager.init();
    console.log('✅ IndexedDB initialized');
    
    // FIXED: Initialize global managers setelah DOM ready
    window.IndexedDBManager = dbManager;
    if (window.StoryOfflineManager) {
      await window.StoryOfflineManager.init();
      console.log('✅ StoryOfflineManager initialized');
    }
  } catch (error) {
    console.error('❌ IndexedDB init failed:', error);
  }
  
  PWANavigationHelper.updateNavigation();
});

const routes = {
  '/login': () => new LoginPresenter(Model).init(),
  '/register': () => new RegisterPresenter(Model).init(),
  '/stories': () => new StoriesListPresenter(Model).init(),
  '/stories/:id': (id) => new StoryDetailPresenter(Model, id).init(),
  '/add': () => new AddStoryPresenter(Model).init(),
};

function parseLocation() {
  // hilangkan leading '#' dan leading '/'
  const raw = location.hash.replace(/^#\/?/, '') || 'stories';
  const segments = raw.split('/');
  const route = segments[0];          // 'login' atau 'register' atau 'stories'
  const id = segments[1] || null;
  return { path: `/${route}`, id };
}

function router() {
  const { path, id } = parseLocation();
  console.log('Router:', { path, id });

  // ========================================
  // PWA ENHANCEMENT: Improved auth check
  // ========================================
  const authRequired = ['/add']; // Only /add requires auth, stories can be viewed publicly
  const token = localStorage.getItem('story_token');
  
  if (authRequired.includes(path) && !token) {
    console.log('Auth required for', path, ', redirecting to login');
    
    // Store intended destination
    localStorage.setItem('redirectAfterLogin', location.hash);
    
    // Optional: Show login required message
    if (window.PWAManager) {
      console.log('⚠️ Login required to access this page');
    }
    
    return location.hash = '/login';
  }

  const route = Object.keys(routes).find(r => {
    if (r.includes('/:id')) {
      return r.split('/:')[0] === path;
    }
    return r === path;
  });
  
  console.log('  matched route:', route);

  if (route) {
    // ========================================
    // PWA ENHANCEMENT: Update navigation after route
    // ========================================
    try {
      routes[route](id);
      
      // Update PWA navigation after a short delay
      setTimeout(() => {
        PWANavigationHelper.updateNavigation();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error loading route:', error);
      
      // Fallback to stories page
      if (path !== '/stories') {
        console.log('Falling back to stories page...');
        location.hash = '/stories';
      }
    }
    
  } else {
    console.warn('Route not found:', path, ', redirect to /stories');
    location.hash = '/stories';
  }
}

function navigate() {
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      router();
    });
  } else {
    router();
  }
}

// ========================================
// EVENT LISTENERS (unchanged)
// ========================================
window.addEventListener('hashchange', navigate);
window.addEventListener('load', navigate);

// ========================================
// PWA ENHANCEMENTS (improved)
// ========================================

// Enhanced Model for PWA (sesuai dengan LoginModel)
if (Model && typeof Model.login === 'function') {
  const originalLogin = Model.login;
  Model.login = async function(...args) {
    const result = await originalLogin.apply(this, args);
    
    // Update navigation after successful login
    if (result && result.token) {
      console.log('✅ Login successful, updating navigation...');
      setTimeout(() => {
        PWANavigationHelper.updateNavigation();
        
        // Redirect to intended page if stored
        const redirectTo = localStorage.getItem('redirectAfterLogin');
        if (redirectTo) {
          localStorage.removeItem('redirectAfterLogin');
          window.location.hash = redirectTo;
        }
      }, 100);
    }
    
    return result;
  };
}

// PWA Integration Helper
window.PWAIntegration = {
  // Show loading during operations
  showLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.add('show');
  },
  
  hideLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.remove('show');
  },
  
  // Show success message
  showSuccess(message) {
    console.log('✅ Success:', message);
    
    // Could create a toast notification here
    this.showToast(message, 'success');
  },
  
  // Show error message
  showError(message) {
    console.error('❌ Error:', message);
    
    // Could create a toast notification here
    this.showToast(message, 'error');
  },
  
  // Simple toast notification system
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `pwa-toast pwa-toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1003;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
};

// Make PWA helpers available globally
window.PWANavigationHelper = PWANavigationHelper;

// Create global updateNavigation function for backward compatibility
window.updateNavigation = function() {
  console.log('🔄 Global updateNavigation called');
  PWANavigationHelper.updateNavigation();
};

// FIXED: Wait for both DOM and managers to be ready
let managersReady = false;

async function waitForManagers() {
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds
  
  while (!managersReady && attempts < maxAttempts) {
    if (window.StoryOfflineManager && window.IndexedDBManager) {
      managersReady = true;
      console.log('✅ All managers ready');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!managersReady) {
    console.warn('⚠️ Managers not ready after timeout');
  }
}

// Initialize navigation on load and hash changes
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOM loaded, initializing navigation...');
  await waitForManagers();
  PWANavigationHelper.updateNavigation();
});

// Also update navigation when hash changes
window.addEventListener('hashchange', () => {
  setTimeout(() => {
    PWANavigationHelper.updateNavigation();
  }, 50);
});

console.log('✅ Dicoding Story app loaded with PWA enhancements');