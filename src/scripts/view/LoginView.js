export default class LoginView {
  constructor() { 
    this.app = document.getElementById('app'); 
  }

  render(onSubmit) {
    this.app.innerHTML = `
      <h2>Login</h2>
      <form id="loginForm">
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required><br>
        
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required><br>
        
        <button type="submit">Login</button>
      </form>
    `;

    document.getElementById('loginForm')
      .addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target;
        onSubmit(f.email.value, f.password.value);
      });
  }
}
