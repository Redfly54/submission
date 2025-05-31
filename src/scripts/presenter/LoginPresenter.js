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
        // Login process
        const loginResult = await this.model.login(email, pass);
        

        console.log('Login result:', loginResult);
        // Login berhasil
        alert('Login berhasil!');
        
        // LETAKKAN PUSH NOTIFICATION SETUP DI SINI
        try {
          await this.setupPushNotification();
        } catch (pushError) {
          console.log('Push notification setup failed:', pushError);
          // Jangan blokir alur aplikasi jika push notification gagal
        }
        
        // Redirect ke halaman stories
        location.hash = '/stories';
        
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    });
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
      this.showMessage('Notifikasi push berhasil diaktifkan!', 'success');
      
    } catch (error) {
      console.error('Error setting up push notification:', error);
      
      // Optional: Tampilkan pesan error ke user
      this.showMessage('Gagal mengaktifkan notifikasi push', 'warning');
      
      // Re-throw error agar bisa di-handle di level atas jika diperlukan
      throw error;
    }
  }

  // Method untuk menampilkan pesan ke user (optional)
  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 5px;
      color: white;
      background: ${type === 'success' ? '#28a745' : 
                   type === 'warning' ? '#ffc107' : 
                   type === 'error' ? '#dc3545' : '#007bff'};
      z-index: 1001;
      font-family: Arial, sans-serif;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }
}