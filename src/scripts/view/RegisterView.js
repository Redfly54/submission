export default class RegisterView {
  constructor() {
    this.app = document.getElementById('app');
  }

  render(onSubmit) {
    this.app.innerHTML = `
      <h2>Register</h2>
      <form id="registerForm">
        <label for="name">Nama:</label>
        <input type="text" id="name" name="name" required><br>
        
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required><br>
        
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required><br>
        
        <button>Daftar</button>
      </form>
      <p>Sudah punya akun? <a href="#/login">Login di sini</a></p>
    `;

    document
      .getElementById('registerForm')
      .addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target;
        onSubmit(f.name.value, f.email.value, f.password.value);
      });
  }
}
