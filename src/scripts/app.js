// Fixed app.js with proper imports and initialization

// PWA Navigation Helper
const PWANavigationHelper = {
  updateNavigation() {
    const nav = document.getElementById('main-nav');
    const token = localStorage.getItem('story_token');
    
    console.log('Updating navigation, token:', token ? 'exists' : 'not found');
    
    if (token && nav) {
      nav.innerHTML = `
        <a href="#/stories">All Stories</a> |
        <a href="#/add">Add Story</a> |
        <a href="#" onclick="PWANavigationHelper.logout(); return false;">Logout</a>
      `;
      console.log('✅ Navigation updated for authenticated user');
    } else if (nav) {
      nav.innerHTML = `
        <a href="#/login">Login</a> |
        <a href="#/register">Register</a> |
        <a href="#/stories">All Stories</a>
      `;
      console.log('✅ Navigation updated for guest user');
    }
  },
  
  logout() {
    localStorage.removeItem('story_token');
    localStorage.removeItem('userData');
    
    this.updateNavigation();
    window.location.hash = '/login';
    
    console.log('✅ Logged out successfully');
    
    if (window.PWAIntegration) {
      window.PWAIntegration.showSuccess('Berhasil logout');
    }
    
    return false;
  }
};

// Import modules
import Model from './model.js';
import AddStoryPresenter from './presenter/AddStoryPresenter.js';
import LoginPresenter from './presenter/LoginPresenter.js';
import RegisterPresenter from './presenter/RegisterPresenter.js';
import StoriesListPresenter from './presenter/StoriesListPresenter.js';
import StoryDetailPresenter from './presenter/StoryDetailPresenter.js';

// FIXED: Only import if needed, but don't instantiate here
// The IndexedDBManager will be handled by the separate script

// Routes configuration
const routes = {
  '/login': () => new LoginPresenter().init(),
  '/register': () => new RegisterPresenter().init(),
  '/stories': () => new StoriesListPresenter().init(),
  '/stories/:id': (id) => new StoryDetailPresenter(Model, id).init(),
  '/add': () => new AddStoryPresenter().init(),
};

function parseLocation() {
  const raw = location.hash.replace(/^#\/?/, '') || 'stories';
  const segments = raw.split('/');
  const route = segments[0];
  const id = segments[1] || null;
  return { path: `/${route}`, id };
}

function router() {
  const { path, id } = parseLocation();
  console.log('Router:', { path, id });

  // Enhanced auth check
  const authRequired = ['/add'];
  const token = localStorage.getItem('story_token');
  
  if (authRequired.includes(path) && !token) {
    console.log('Auth required for', path, ', redirecting to login');
    localStorage.setItem('redirectAfterLogin', location.hash);
    
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
    try {
      routes[route](id);
      
      setTimeout(() => {
        PWANavigationHelper.updateNavigation();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error loading route:', error);
      
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

// Event listeners
window.addEventListener('hashchange', navigate);
window.addEventListener('load', navigate);

// Enhanced Model for PWA
if (Model && typeof Model.login === 'function') {
  const originalLogin = Model.login;
  Model.login = async function(...args) {
    const result = await originalLogin.apply(this, args);
    
    if (result && result.token) {
      console.log('✅ Login successful, updating navigation...');
      setTimeout(() => {
        PWANavigationHelper.updateNavigation();
        
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
  showLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.add('show');
  },
  
  hideLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.remove('show');
  },
  
  showSuccess(message) {
    console.log('✅ Success:', message);
    this.showToast(message, 'success');
  },
  
  showError(message) {
    console.error('❌ Error:', message);
    this.showToast(message, 'error');
  },
  
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
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
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
window.updateNavigation = function() {
  console.log('🔄 Global updateNavigation called');
  PWANavigationHelper.updateNavigation();
};

// FIXED: Better initialization handling
let appInitialized = false;

async function initializeApp() {
  if (appInitialized) return;
  
  try {
    console.log('🚀 Initializing app...');
    
    // Wait a bit for IndexedDB managers to load
    let attempts = 0;
    while (attempts < 30 && !window.IndexedDBManager) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (window.IndexedDBManager) {
      console.log('✅ IndexedDB managers detected');
    } else {
      console.warn('⚠️ IndexedDB managers not available');
    }
    
    PWANavigationHelper.updateNavigation();
    appInitialized = true;
    
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Also update navigation when hash changes
window.addEventListener('hashchange', () => {
  setTimeout(() => {
    PWANavigationHelper.updateNavigation();
  }, 50);
});

console.log('✅ Dicoding Story app loaded with PWA enhancements');