(function () {
  if (!App.requireLogin()) return;
  App.init({ title: 'My dedications' });

  const { h } = App;
  const list = document.getElementById('list');

  function skeletons() {
    list.replaceChildren(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
  }

  function card(d, index) {
    const today = d.playDate === App.todayISO() && d.status === 'pending';
    const el = h(
      'article',
      { class: 'dedication s-' + d.status + (today ? ' today' : ''), style: 'animation-delay:' + Math.min(index, 8) * 60 + 'ms' },
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
        d.comment ? h('p', { class: 'comment', text: d.comment }) : null,
        d.statusNote ? h('p', { class: 'note', text: 'Note from staff: ' + d.statusNote }) : null
      ),
      h(
        'div',
        { class: 'side' },
        App.badge(d.status),
        d.status === 'pending'
          ? h('button', {
              type: 'button',
              class: 'btn btn-danger btn-small',
              text: 'Withdraw',
              onclick: (e) => withdraw(d, e.currentTarget),
            })
          : null
      )
    );
    return el;
  }

  async function withdraw(d, button) {
    if (!confirm('Withdraw your dedication of "' + d.song + '" for ' + d.toName + '?')) return;
    App.setBusy(button, true, 'Withdrawing…');
    try {
      await App.api('/dedications/' + d.id, { method: 'DELETE' });
      App.toast('Dedication withdrawn.');
      load();
    } catch (err) {
      App.toast(err.message, 'error');
      App.setBusy(button, false);
    }
  }

  async function load() {
    skeletons();
    try {
      const { dedications } = await App.api('/dedications/mine');
      if (!dedications.length) {
        list.replaceChildren(
          h(
            'div',
            { class: 'empty' },
            h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
            h('h2', { text: 'No dedications yet' }),
            h('p', { class: 'muted', text: 'Pick a song for a friend and it will show up here.' }),
            h('a', { class: 'btn', href: 'dedicate.html', text: 'Make your first dedication' })
          )
        );
        return;
      }
      list.replaceChildren(...dedications.map(card));
    } catch (err) {
      list.replaceChildren(
        h(
          'div',
          { class: 'empty' },
          h('h2', { text: 'Could not load your dedications' }),
          h('p', { class: 'muted', text: err.message }),
          h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: load })
        )
      );
    }
  }

  load();
})();
