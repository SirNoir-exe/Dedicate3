(function () {
  App.init({ title: 'Sign up' });

  const existing = App.getSession();
  if (existing && existing.token) {
    location.replace('dedicate.html');
    return;
  }

  const form = document.getElementById('signup-form');
  const errorBox = document.getElementById('error');
  const submit = document.getElementById('submit');

  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.classList.remove('show');
    void errorBox.offsetWidth;
    errorBox.classList.add('show');
    form.querySelectorAll('.input').forEach((i) => i.removeAttribute('aria-invalid'));
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const className = form.className.value.trim();
    const password = form.password.value;

    if (fullName.length < 2) return showError('Enter your full name.', form.fullName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Enter a valid school email.', form.email);
    if (password.length < 8) return showError('Your password needs at least 8 characters.', form.password);
    if (password !== form.confirm.value) return showError('The two passwords do not match.', form.confirm);

    App.setBusy(submit, true, 'Creating account…');
    try {
      const data = await App.api('/auth/signup', {
        method: 'POST',
        auth: false,
        body: { fullName, schoolEmail: email, className, password },
      });
      App.setSession({ token: data.token, user: data.user });
      location.href = 'dedicate.html';
    } catch (err) {
      showError(err.message);
      App.setBusy(submit, false);
    }
  });
})();
