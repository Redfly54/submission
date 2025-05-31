import RegisterModel from '../model/RegisterModel.js';
import RegisterView from '../view/RegisterView.js';

export default class RegisterPresenter {
  constructor() {
    this.model = new RegisterModel();
    this.view = new RegisterView();
  }

  init() {
    this.view.render(async (name, email, password) => {
      try {
        const res = await this.model.register(name, email, password);
        
        // Check if registration was successful
        if (!res.error) {
          alert(`Registrasi berhasil! Selamat datang, ${name}. Silakan login.`);
          location.hash = '/login';
        } else {
          alert(`Gagal registrasi: ${res.message}`);
        }
      } catch (err) {
        alert(`Gagal registrasi: ${err.message}`);
      }
    });
  }
}