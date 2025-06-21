// scripts/utils/PushNotificationManager.js

export default class PushNotificationManager {
  constructor() {
    // VAPID key dari dokumentasi Dicoding Story API
    this.vapidKey = 'BCCe2eonNI-6H2ctvFaNg-UVdbv387Vno_bzUzALpB442r21CnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
    this.apiEndpoint = 'https://story-api.dicoding.dev/v1';
  }

  /**
   * Cek apakah browser mendukung push notification
   * @returns {boolean}
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /**
   * Registrasi service worker
   * @returns {Promise<ServiceWorkerRegistration>}
   */
  // async registerServiceWorker() {
  //   if (!this.isSupported()) {
  //     throw new Error('Push messaging tidak didukung oleh browser ini');
  //   }

  //   try {
  //     const registration = await navigator.serviceWorker.register('/sw.js');
  //     console.log('Service Worker berhasil diregistrasi:', registration);
      
  //     // Tunggu sampai service worker aktif
  //     await this.waitForServiceWorkerReady(registration);
      
  //     return registration;
  //   } catch (error) {
  //     console.error('Gagal registrasi Service Worker:', error);
  //     throw new Error('Gagal registrasi Service Worker: ' + error.message);
  //   }
  // }

  /**
   * Menunggu service worker siap
   * @param {ServiceWorkerRegistration} registration 
   */
  async waitForServiceWorkerReady(registration) {
    return new Promise((resolve) => {
      if (registration.active) {
        resolve();
      } else {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              resolve();
            }
          });
        });
      }
    });
  }

  /**
   * Minta izin notifikasi dari user
   * @returns {Promise<string>}
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      throw new Error('Browser tidak mendukung notifikasi');
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      throw new Error('Izin notifikasi ditolak oleh pengguna');
    }

    return permission;
  }

  /**
   * Subscribe ke push notification
   * @returns {Promise<PushSubscription>}
   */
  async subscribeToPush() {
    try {
      // 1. Registrasi service worker
      const registration = await navigator.serviceWorker.ready;
      
      // 2. Minta izin notifikasi
      await this.requestPermission();

      // 3. Cek apakah sudah subscribe
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Sudah subscribe, mengirim ulang ke server');
        await this.sendSubscriptionToServer(existingSubscription);
        return existingSubscription;
      }

      // 4. Buat subscription baru
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey)
      });

      console.log('Push subscription berhasil:', subscription);
      
      // 5. Kirim subscription ke server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Gagal subscribe push notification:', error);
      throw new Error('Gagal mengaktifkan push notification: ' + error.message);
    }
  }

  /**
   * Kirim subscription data ke server Dicoding
   * @param {PushSubscription} subscription 
   * @returns {Promise<Object>}
   */
  async sendSubscriptionToServer(subscription) {
    const token = localStorage.getItem('story_token'); // Sesuai dengan LoginModel
    
    if (!token) {
      throw new Error('Token autentikasi tidak ditemukan');
    }

    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: this.arrayBufferToBase64(subscription.getKey('auth'))
      }
    };

    console.log('Mengirim subscription ke server:', subscriptionData);

    try {
      const response = await fetch(`${this.apiEndpoint}/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Server error'}`);
      }

      const result = await response.json();
      console.log('Subscription berhasil dikirim ke server:', result);
      return result;
    } catch (error) {
      console.error('Gagal mengirim subscription ke server:', error);
      throw new Error('Gagal mengirim subscription ke server: ' + error.message);
    }
  }

  /**
   * Ambil subscription yang ada
   * @returns {Promise<PushSubscription|null>}
   */
 async getSubscription() {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    return null;
  }
}

  /**
   * Unsubscribe dari push notification
   * @returns {Promise<boolean>}
   */
  async unsubscribe() {
    try {
      const subscription = await this.getSubscription();
      if (subscription) {
        const result = await subscription.unsubscribe();
        console.log('Berhasil unsubscribe dari push notification');
        return result;
      }
      return true;
    } catch (error) {
      console.error('Gagal unsubscribe:', error);
      throw new Error('Gagal unsubscribe dari push notification: ' + error.message);
    }
  }

  /**
   * Cek status permission notifikasi
   * @returns {string}
   */
  getNotificationPermission() {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission;
  }

  /**
   * Test notifikasi lokal (untuk testing)
   * @param {string} title 
   * @param {string} body 
   */
  async testLocalNotification(title = 'Test Notification', body = 'Ini adalah test notifikasi') {
    if (await this.requestPermission() === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/images/icon-192x192.png', // Sesuaikan dengan icon aplikasi Anda
        badge: '/images/badge-72x72.png'
      });
    }
  }

  // ======================
  // UTILITY FUNCTIONS
  // ======================

  /**
   * Konversi VAPID key dari base64 ke Uint8Array
   * @param {string} base64String 
   * @returns {Uint8Array}
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Konversi ArrayBuffer ke base64
   * @param {ArrayBuffer} buffer 
   * @returns {string}
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Debug info untuk troubleshooting
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      isSupported: this.isSupported(),
      notificationPermission: this.getNotificationPermission(),
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
      notificationSupported: 'Notification' in window,
      hasToken: !!localStorage.getItem('story_token'),
      vapidKey: this.vapidKey.substring(0, 20) + '...' // Hanya sebagian untuk keamanan
    };
  }
}

// Contoh penggunaan:
// const pushManager = new PushNotificationManager();
// await pushManager.subscribeToPush();