(function () {
  const user = App.requireLogin();
  if (!user) return;
  App.init({ title: 'New dedication' });

  const form = document.getElementById('dedication-form');
  const steps = Array.from(form.querySelectorAll('.step'));
  const bits = Array.from(document.querySelectorAll('#progress li'));
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const submit = document.getElementById('submit');
  const errorBox = document.getElementById('error');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');
  let current = 0;

  // Defaults
  form.fromName.value = user.fullName || '';
  form.playDate.min = App.todayISO();
  form.playDate.value = '';

  /* ---------- Live slip ---------- */
  const slipFields = {};
  document.querySelectorAll('[data-slip]').forEach((dd) => (slipFields[dd.dataset.slip] = dd));

  function updateSlip(name) {
    const dd = slipFields[name];
    if (!dd) return;
    let value = (form[name].value || '').trim();
    if (name === 'playDate' && value) value = App.formatDay(value);
    dd.textContent = value || dd.dataset.empty;
    dd.classList.toggle('is-empty', !value);
    dd.classList.remove('bump');
    void dd.offsetWidth;
    if (value) dd.classList.add('bump');
  }
  Object.keys(slipFields).forEach((name) => {
    form[name].addEventListener('input', () => updateSlip(name));
    form[name].addEventListener('change', () => updateSlip(name));
    updateSlip(name);
  });
  // Don't bump on first paint
  Object.values(slipFields).forEach((dd) => dd.classList.remove('bump'));

  const count = document.getElementById('count');
  form.comment.addEventListener('input', () => (count.textContent = form.comment.value.length));

  /* ---------- Steps ---------- */
  function showStep(i) {
    current = i;
    steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
    bits.forEach((b, idx) => {
      b.classList.toggle('done', idx < i);
      b.classList.toggle('current', idx === i);
    });
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
    next.hidden = i === steps.length - 1;
    submit.hidden = i !== steps.length - 1;
    clearError();
  }

  function clearError() {
    errorBox.classList.remove('show');
    form.querySelectorAll('.input').forEach((el) => el.removeAttribute('aria-invalid'));
  }
  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.classList.remove('show');
    void errorBox.offsetWidth;
    errorBox.classList.add('show');
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  // Returns true when the given step is valid; otherwise shows the problem.
  function validate(i) {
    if (i === 0) {
      if (!form.toName.value.trim()) return showError('Enter the name of the birthday person.', form.toName), false;
      if (!form.fromName.value.trim()) return showError('Enter who the dedication is from.', form.fromName), false;
      if (!form.playDate.value) return showError('Pick the date it should play.', form.playDate), false;
      if (form.playDate.value < App.todayISO()) return showError('That date has passed. Pick today or a later date.', form.playDate), false;
    }
    if (i === 1) {
      if (!form.song.value.trim()) return showError('Enter the song title.', form.song), false;
    }
    return true;
  }

  next.addEventListener('click', () => {
    if (validate(current)) showStep(current + 1);
  });
  back.addEventListener('click', () => showStep(Math.max(0, current - 1)));

  // Enter moves forward on early steps instead of submitting early.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && current < steps.length - 1) {
      e.preventDefault();
      next.click();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    for (let i = 0; i < steps.length; i++) {
      if (!validate(i)) return showStep(i), validate(i);
    }
    App.setBusy(submit, true, 'Sending…');
    try {
      const data = await App.api('/dedications', {
        method: 'POST',
        body: {
          fromName: form.fromName.value.trim(),
          toName: form.toName.value.trim(),
          song: form.song.value.trim(),
          artist: form.artist.value.trim(),
          meal: form.meal.value.trim(),
          comment: form.comment.value.trim(),
          playDate: form.playDate.value,
        },
      });
      const d = data.dedication;
      document.getElementById('success-text').textContent =
        '"' + d.song + '" is on the list for ' + d.toName + ' on ' + App.formatDay(d.playDate) + '. Check My dedications to see when it has played.';
      formView.hidden = true;
      successView.hidden = false;
      window.scrollTo({ top: 0 });
    } catch (err) {
      showError(err.message);
    } finally {
      App.setBusy(submit, false);
    }
  });

  document.getElementById('another').addEventListener('click', () => {
    ['toName', 'song', 'artist', 'meal', 'comment', 'playDate'].forEach((n) => {
      form[n].value = '';
      updateSlip(n);
    });
    count.textContent = '0';
    successView.hidden = true;
    formView.hidden = false;
    showStep(0);
    form.toName.focus();
  });

  showStep(0);
})();
