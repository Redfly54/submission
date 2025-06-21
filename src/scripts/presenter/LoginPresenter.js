import LoginModel from '../model/LoginModel.js';
import PushNotificationManager from '../utils/PushNotificationManager.js'; // Import push manager
import LoginView from '../view/LoginView.js';

export default class LoginPresenter {
  constructor() {
    this.model = new LoginModel();
    this.view = new LoginView();
    this.pushManager = new PushNotificationManager(); // Initialize push manager
  }

  init() {
    this.view.render(async (email, pass) => {
      try {
        // Show loading jika ada PWA integration
        if (window.PWAIntegration) {
          window.PWAIntegration.showLoading();
        }

        // Login process
        const loginResult = await this.model.login(email, pass);
        
        console.log('Login result:', loginResult);
        
        // Hide loading
        if (window.PWAIntegration) {
          window.PWAIntegration.hideLoading();
        }

        // Login berhasil - gunakan PWA toast jika tersedia
        if (window.PWAIntegration) {
          window.PWAIntegration.showSuccess('Login berhasil! 🎉');
        } else {
          alert('Login berhasil!');
        }

        // ========================================
        // PWA NAVIGATION UPDATE - DIPERBAIKI
        // ========================================
        
        // Method 1: Gunakan PWANavigationHelper langsung
        if (window.PWANavigationHelper) {
          setTimeout(() => {
            window.PWANavigationHelper.updateNavigation();
            console.log('✅ Navigation updated via PWANavigationHelper');
          }, 100);
        }
        
        // Method 2: Fallback untuk global function
        if (window.updateNavigation) {
          setTimeout(() => {
            window.updateNavigation();
            console.log('✅ Navigation updated via global function');
          }, 200);
        }

        // Method 3: Manual update navigation jika PWA helper tidak ada
        if (!window.PWANavigationHelper && !window.updateNavigation) {
          setTimeout(() => {
            this.updateNavigationManual();
            console.log('✅ Navigation updated manually');
          }, 100);
        }
        
        // LETAKKAN PUSH NOTIFICATION SETUP DI SINI
        try {
          await this.setupPushNotification();
        } catch (pushError) {
          console.log('Push notification setup failed:', pushError);
          // Jangan blokir alur aplikasi jika push notification gagal
        }
        
        // Redirect ke halaman stories setelah delay
        setTimeout(() => {
          location.hash = '/stories';
        }, 300);
        
      } catch (err) {
  console.error('Login error:', err);
  
  // Enhanced error handling
  let errorMessage = 'Login gagal';
  
  if (err.message.includes('Network error')) {
    errorMessage = '🌐 Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  } else if (err.message.includes('HTTP 401')) {
    errorMessage = '🔒 Email atau password salah.';
  } else if (err.message.includes('HTTP 400')) {
    errorMessage = '⚠️ Data yang dimasukkan tidak valid.';
  } else if (err.message.includes('CORS')) {
    errorMessage = '🔧 Masalah konfigurasi server. Coba refresh halaman.';
  }
  
  // Hide loading dan show error
  if (window.PWAIntegration) {
    window.PWAIntegration.hideLoading();
    window.PWAIntegration.showError(errorMessage);
  } else {
    alert(errorMessage);
  }
}
    });
  }

  // Manual navigation update jika PWA helper tidak tersedia
  updateNavigationManual() {
    const nav = document.getElementById('main-nav');
    const token = localStorage.getItem('story_token');
    
    if (token && nav) {
      nav.innerHTML = `
        <a href="#/stories">All Stories</a> |
        <a href="#/add">Add Story</a> |
        <a href="#" onclick="this.handleLogout(); return false;">Logout</a>
      `;
    }
  }

  // Manual logout handler
  handleLogout() {
    localStorage.removeItem('story_token');
    localStorage.removeItem('userData');
    
    // Update navigation
    const nav = document.getElementById('main-nav');
    if (nav) {
      nav.innerHTML = `
        <a href="#/login">Login</a> |
        <a href="#/register">Register</a> |
        <a href="#/stories">All Stories</a>
      `;
    }
    
    window.location.hash = '/login';
    
    if (window.PWAIntegration) {
      window.PWAIntegration.showSuccess('Berhasil logout');
    } else {
      alert('Berhasil logout');
    }
  }

  // Method untuk setup push notification
  async setupPushNotification() {
    try {
      // Cek apakah browser mendukung push notification
      if (!this.pushManager.isSupported()) {
        console.log('Browser tidak mendukung push notification');
        return;
      }

      // Cek apakah sudah subscribe sebelumnya
      const existingSubscription = await this.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Sudah subscribe ke push notification');
        return;
      }

      // Subscribe ke push notification
      await this.pushManager.subscribeToPush();
      console.log('Push notification berhasil diaktifkan');
      
      // Optional: Tampilkan pesan sukses ke user
      this.showMessage('Notifikasi push berhasil diaktifkan! 🔔', 'success');
      
    } catch (error) {
      console.error('Error setting up push notification:', error);
      
      // Optional: Tampilkan pesan error ke user
      this.showMessage('Gagal mengaktifkan notifikasi push', 'warning');
      
      // Re-throw error agar bisa di-handle di level atas jika diperlukan
      throw error;
    }
  }

  // Method untuk menampilkan pesan ke user (enhanced)
  showMessage(message, type = 'info') {
    // Gunakan PWA toast jika tersedia
    if (window.PWAIntegration) {
      window.PWAIntegration.showToast(message, type);
      return;
    }

    // Fallback ke custom message
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      background: ${type === 'success' ? '#4caf50' : 
                   type === 'warning' ? '#ff9800' : 
                   type === 'error' ? '#f44336' : '#2196f3'};
      z-index: 1001;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      max-width: 300px;
      animation: slideInRight 0.3s ease;
    `;
    
    // Add animation
    if (!document.getElementById('message-animations')) {
      const style = document.createElement('style');
      style.id = 'message-animations';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      messageDiv.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }, 3000);
  }
}