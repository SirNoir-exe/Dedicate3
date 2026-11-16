(function () {
  App.init({});

  // Logged-in visitors get shortcuts instead of sign-up buttons.
  const user = App.getUser();
  if (user) {
    const actions = document.getElementById('hero-actions');
    actions.replaceChildren(
      App.h('a', { class: 'btn btn-large', href: 'dedicate.html', text: 'Dedicate a song' }),
      App.h('a', { class: 'btn btn-ghost btn-large', href: 'mine.html', text: 'My dedications' })
    );
    const band = document.getElementById('cta-band-btn');
    band.href = 'dedicate.html';
  }

  // Ticker: the phrases are repeated twice so the loop is seamless.
  const phrases = ['Happy birthday', 'Now playing', 'Request a song', 'Make someone smile', 'Turn it up'];
  const track = document.getElementById('ticker');
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      phrases.forEach((p) => track.append(App.h('span', { text: p + ' ★' })));
    }
  }

  // The record leans slightly toward the pointer.
  const art = document.getElementById('hero-art');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (art && !reduce) {
    window.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      art.style.setProperty('--px', x.toFixed(3));
      art.style.setProperty('--py', y.toFixed(3));
    });
  }
})();
