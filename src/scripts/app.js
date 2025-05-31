// ========================================
// PWA INTEGRATION - Add to top of existing app.js
// ========================================

// PWA Navigation Helper (optional enhancement)
const PWANavigationHelper = {
  // Update navigation based on auth status (optional)
  updateNavigation() {
    const nav = document.getElementById('main-nav');
    const token = localStorage.getItem('accessToken');
    
    if (token && nav) {
      // User is logged in - show relevant nav
      nav.innerHTML = `
        <a href="#/stories">All Stories</a> |
        <a href="#/add">Add Story</a> |
        <a href="#/logout" onclick="PWANavigationHelper.logout()">Logout</a>
      `;
    } else if (nav) {
      // User not logged in - show login/register
      nav.innerHTML = `
        <a href="#/login">Login</a> |
        <a href="#/register">Register</a> |
        <a href="#/stories">All Stories</a>
      `;
    }
  },
  
  // Handle logout
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
    this.updateNavigation();
    window.location.hash = '/login';
  }
};

// ========================================
// YOUR EXISTING APP.JS CODE (unchanged)
// ========================================

import Model from './model.js';
import AddStoryPresenter from './presenter/AddStoryPresenter.js';
import LoginPresenter from './presenter/LoginPresenter.js';
import RegisterPresenter from './presenter/RegisterPresenter.js';
import StoriesListPresenter from './presenter/StoriesListPresenter.js';
import StoryDetailPresenter from './presenter/StoryDetailPresenter.js';

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
  // PWA ENHANCEMENT: Optional auth check
  // ========================================
  const authRequired = ['/stories', '/stories/:id', '/add'];
  if (authRequired.some(r => r.split('/:')[0] === path) && !Model.token) {
    console.log('Auth required, redirecting to login');
    // Optional: Show login required message
    if (window.PWAManager) {
      // Could show a PWA-style notification here
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
    routes[route](id);
    
    // Optional: Update PWA navigation
    setTimeout(() => {
      PWANavigationHelper.updateNavigation();
    }, 100);
    
  } else {
    console.warn('Route not found, redirect to /stories');
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
// PWA ENHANCEMENTS (optional additions)
// ========================================

// Enhanced Model for PWA (optional)
if (Model) {
  const originalLogin = Model.login;
  Model.login = async function(...args) {
    const result = await originalLogin.apply(this, args);
    // Update navigation after successful login
    if (result && !result.error) {
      setTimeout(() => {
        PWANavigationHelper.updateNavigation();
      }, 100);
    }
    return result;
  };
}

// PWA Integration Helper
window.PWAIntegration = {
  // Show loading during operations (optional)
  showLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.add('show');
  },
  
  hideLoading() {
    const loading = document.getElementById('pwa-loading');
    if (loading) loading.classList.remove('show');
  },
  
  // Show success message (optional)
  showSuccess(message) {
    // Could integrate with existing notification system
    console.log('✅ Success:', message);
  },
  
  // Show error message (optional)
  showError(message) {
    // Could integrate with existing error handling
    console.error('❌ Error:', message);
  }
};

// Make PWA helpers available globally (optional)
window.PWANavigationHelper = PWANavigationHelper;

console.log('✅ Dicoding Story app loaded with PWA enhancements');