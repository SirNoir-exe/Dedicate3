(function () {
  const user = App.requireLogin();
  if (!user) return;
  App.init({ title: 'Staff panel' });

  const { h } = App;
  const list = document.getElementById('list');

  // Not staff? Say so plainly instead of showing a broken panel.
  if (user.role !== 'staff') {
    document.querySelector('main').replaceChildren(
      h(
        'div',
        { class: 'empty' },
        h('h1', { class: 'page-title', text: 'Staff only' }),
        h('p', { class: 'muted', text: 'This panel is for staff accounts. Your account can send dedications.' }),
        h('a', { class: 'btn', href: 'dedicate.html', text: 'New dedication' })
      )
    );
    return;
  }

  const state = { status: 'pending', range: 'today', date: '', q: '' };
  const statButtons = Array.from(document.querySelectorAll('.stat'));
  const chips = Array.from(document.querySelectorAll('#date-chips .chip'));
  const qInput = document.getElementById('q');
  const dateInput = document.getElementById('date');
  let requestId = 0;

  /* ---------- Dates ---------- */
  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d + n).toLocaleDateString('en-CA');
  }

  function dateParams() {
    const today = App.todayISO();
    if (state.date) return { date: state.date };
    switch (state.range) {
      case 'today': return { date: today };
      case 'tomorrow': return { date: addDays(today, 1) };
      case 'upcoming': return { from: today, to: addDays(today, 7) };
      case 'overdue': return { to: addDays(today, -1) };
      default: return {};
    }
  }

  /* ---------- Loading ---------- */
  async function loadStats() {
    try {
      const { stats } = await App.api('/admin/stats');
      statButtons.forEach((b) => (b.querySelector('strong').textContent = stats[b.dataset.status] || 0));
    } catch {
      /* the list call will show the error */
    }
  }

  async function loadList(opts) {
    const quiet = opts && opts.quiet;
    const id = ++requestId;
    if (!quiet) {
      list.replaceChildren(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
    }
    const params = new URLSearchParams({ status: state.status, ...dateParams() });
    if (state.q) params.set('q', state.q);

    try {
      const { dedications } = await App.api('/admin/dedications?' + params.toString());
      if (id !== requestId) return; // a newer request replaced this one
      render(dedications);
    } catch (err) {
      if (id !== requestId || quiet) return;
      list.replaceChildren(
        h(
          'div',
          { class: 'empty' },
          h('h2', { text: 'Could not load dedications' }),
          h('p', { class: 'muted', text: err.message }),
          h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: () => loadList() })
        )
      );
    }
  }

  function refreshAll(opts) {
    loadStats();
    return loadList(opts);
  }

  /* ---------- Rendering ---------- */
  function emptyState() {
    const filtered = state.range !== 'all' || state.date || state.q;
    return h(
      'div',
      { class: 'empty' },
      h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
      h('h2', { text: 'Nothing here' }),
      h('p', { class: 'muted', text: filtered ? 'No ' + state.status + ' dedications match these filters.' : 'No ' + state.status + ' dedications yet.' }),
      filtered
        ? h('button', { class: 'btn', type: 'button', text: 'Show all dates', onclick: () => setRange('all') })
        : null
    );
  }

  function render(items) {
    if (!items.length) {
      list.replaceChildren(emptyState());
      return;
    }
    list.replaceChildren(...items.map(card));
  }

  function card(d, index) {
    const today = d.playDate === App.todayISO() && d.status === 'pending';
    const noteInput = h('input', {
      class: 'input',
      type: 'text',
      maxlength: '300',
      placeholder: 'Add a note (optional)',
      'aria-label': 'Note for ' + d.toName + "'s dedication",
      value: d.statusNote || '',
    });

    const actionBtn = (label, status, cls) =>
      h('button', {
        type: 'button',
        class: 'btn btn-small ' + cls,
        text: label,
        onclick: (e) => setStatus(d, status, noteInput.value, e.currentTarget),
      });

    const actions = h('div', { class: 'actions' });
    if (d.status === 'pending') {
      actions.append(
        actionBtn('Played', 'played', 'btn-green'),
        actionBtn('Belated', 'belated', 'btn-orange'),
        actionBtn('Cancel', 'cancelled', 'btn-danger'),
        noteInput
      );
    } else {
      actions.append(actionBtn('Back to pending', 'pending', 'btn-ghost'), noteInput);
      noteInput.disabled = true;
      noteInput.title = 'Move it back to pending to change the note';
    }

    const s = d.submittedBy || {};
    return h(
      'article',
      { class: 'dedication s-' + d.status + (today ? ' today' : ''), style: 'animation-delay:' + Math.min(index, 8) * 50 + 'ms' },
      h(
        'div',
        {},
        h('h3', { text: 'For ' + d.toName }),
        h('p', { class: 'song', text: d.song + (d.artist ? ' by ' + d.artist : '') }),
        h(
          'div',
          { class: 'meta' },
          h('span', { text: 'From ' + d.fromName }),
          h('span', { text: 'Plays ' + App.formatDay(d.playDate) }),
          d.meal ? h('span', { text: 'Meal: ' + d.meal }) : null
        ),
        h(
          'div',
          { class: 'meta' },
          h('span', { text: 'Sent by ' + (s.fullName || 'unknown') + (s.className ? ' (' + s.className + ')' : '') }),
          h('span', { text: 'Submitted ' + App.formatStamp(d.createdAt) }),
          d.handledByName ? h('span', { text: 'Handled by ' + d.handledByName + ' on ' + App.formatStamp(d.handledAt) }) : null
        ),
        d.comment ? h('p', { class: 'comment', text: d.comment }) : null
      ),
      h('div', { class: 'side' }, App.badge(d.status)),
      actions
    );
  }

  /* ---------- Actions ---------- */
  const PAST = { played: 'Marked as played.', belated: 'Marked as belated.', cancelled: 'Cancelled.', pending: 'Moved back to pending.' };

  async function setStatus(d, status, note, button) {
    App.setBusy(button, true, 'Saving…');
    try {
      await App.api('/admin/dedications/' + d.id + '/status', {
        method: 'PATCH',
        body: { status, note: note.trim() },
      });
      App.toast(PAST[status] + ' (' + d.toName + ')');
      await refreshAll({ quiet: true });
    } catch (err) {
      App.toast(err.message, 'error');
      App.setBusy(button, false);
    }
  }

  /* ---------- Filters ---------- */
  function syncControls() {
    statButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === state.status)));
    chips.forEach((c) => c.setAttribute('aria-pressed', String(!state.date && c.dataset.range === state.range)));
    dateInput.value = state.date;
  }
  function setRange(range) {
    state.range = range;
    state.date = '';
    syncControls();
    loadList();
  }

  statButtons.forEach((b) =>
    b.addEventListener('click', () => {
      state.status = b.dataset.status;
      syncControls();
      loadList();
    })
  );
  chips.forEach((c) => c.addEventListener('click', () => setRange(c.dataset.range)));
  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    syncControls();
    loadList();
  });
  let timer;
  qInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = qInput.value.trim();
      loadList();
    }, 300);
  });
  document.getElementById('reset').addEventListener('click', () => {
    Object.assign(state, { status: 'pending', range: 'today', date: '', q: '' });
    qInput.value = '';
    syncControls();
    loadList();
  });

  // Quiet refresh so new dedications appear without reloading. Pauses while the tab is hidden
  // or while someone is typing a note, so it never wipes what they're writing.
  setInterval(() => {
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('.actions');
    if (document.hidden || typing) return;
    refreshAll({ quiet: true });
  }, 30000);

  syncControls();
  refreshAll();
})();
