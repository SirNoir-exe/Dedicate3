(function () {
  App.init({ title: 'Log in' });

  const params = new URLSearchParams(location.search);
  const next = App.safeNext(params.get('next'));

  // Already logged in? Skip the form.
  const existing = App.getSession();
  if (existing && existing.token) {
    location.replace(existing.user && existing.user.role === 'staff' && !params.get('next') ? 'admin.html' : next === 'index.html' ? 'dedicate.html' : next);
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('error');
  const submit = document.getElementById('submit');

  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.classList.remove('show');
    void errorBox.offsetWidth; // restart the shake
    errorBox.classList.add('show');
    form.querySelectorAll('.input').forEach((i) => i.removeAttribute('aria-invalid'));
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email) return showError('Enter your school email.', form.email);
    if (!password) return showError('Enter your password.', form.password);

    App.setBusy(submit, true, 'Logging in…');
    try {
      const data = await App.api('/auth/login', {
        method: 'POST',
        auth: false,
        body: { schoolEmail: email, password },
      });
      App.setSession({ token: data.token, user: data.user });
      const fallback = data.user.role === 'staff' ? 'admin.html' : 'dedicate.html';
      location.href = params.get('next') ? next : fallback;
    } catch (err) {
      showError(err.message);
      App.setBusy(submit, false);
    }
  });
})();
