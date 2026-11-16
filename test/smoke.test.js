// End-to-end smoke test: spins up the API on a random port with an in-memory DB.
// Run with: npm test
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const app = require('../src/app');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;

  // Seed a staff account the same way scripts/create-staff.js does.
  db.prepare(
    `INSERT INTO users (full_name, school_email, password_hash, role) VALUES (?, ?, ?, 'staff')`
  ).run('Social Prefect', 'prefect@school.test', bcrypt.hashSync('prefectpass1', 4));
});

test.after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

test('full dedication flow', async () => {
  // Student signs up
  const signup = await call('POST', '/auth/signup', {
    body: { fullName: 'Ada Obi', schoolEmail: 'ada@school.test', className: 'SS2A', password: 'password123' },
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.user.role, 'student');
  const studentToken = signup.data.token;

  // Duplicate sign-up is rejected
  const dup = await call('POST', '/auth/signup', {
    body: { fullName: 'Ada Obi', schoolEmail: 'ADA@school.test', password: 'password123' },
  });
  assert.equal(dup.status, 409);

  // Unauthenticated users cannot create dedications
  const anon = await call('POST', '/dedications', { body: {} });
  assert.equal(anon.status, 401);

  // Validation
  const bad = await call('POST', '/dedications', { token: studentToken, body: { toName: 'Chi' } });
  assert.equal(bad.status, 400);

  // Create a dedication
  const created = await call('POST', '/dedications', {
    token: studentToken,
    body: {
      fromName: 'Ada',
      toName: 'Chi',
      song: 'Calm Down',
      artist: 'Rema',
      meal: 'Jollof rice',
      comment: 'Happy birthday!',
      playDate: '2026-11-06',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.dedication.status, 'pending');
  const id = created.data.dedication.id;

  // Student sees their own dedication
  const mine = await call('GET', '/dedications/mine', { token: studentToken });
  assert.equal(mine.data.dedications.length, 1);

  // Students are locked out of the staff panel
  const blocked = await call('GET', '/admin/dedications', { token: studentToken });
  assert.equal(blocked.status, 403);
  const blockedPatch = await call('PATCH', `/admin/dedications/${id}/status`, {
    token: studentToken,
    body: { status: 'played' },
  });
  assert.equal(blockedPatch.status, 403);

  // Staff logs in and sees the queue
  const login = await call('POST', '/auth/login', {
    body: { schoolEmail: 'prefect@school.test', password: 'prefectpass1' },
  });
  assert.equal(login.status, 200);
  const staffToken = login.data.token;

  const queue = await call('GET', '/admin/dedications?status=pending', { token: staffToken });
  assert.equal(queue.data.dedications.length, 1);
  assert.equal(queue.data.dedications[0].submittedBy.fullName, 'Ada Obi');

  // Staff marks it belated, then invalid status is rejected
  const belated = await call('PATCH', `/admin/dedications/${id}/status`, {
    token: staffToken,
    body: { status: 'belated', note: 'Played a day late' },
  });
  assert.equal(belated.status, 200);
  assert.equal(belated.data.dedication.status, 'belated');
  assert.equal(belated.data.dedication.handledByName, 'Social Prefect');

  const invalid = await call('PATCH', `/admin/dedications/${id}/status`, {
    token: staffToken,
    body: { status: 'nonsense' },
  });
  assert.equal(invalid.status, 400);

  const stats = await call('GET', '/admin/stats', { token: staffToken });
  assert.equal(stats.data.stats.belated, 1);

  // Handled dedications can no longer be withdrawn by the student
  const withdraw = await call('DELETE', `/dedications/${id}`, { token: studentToken });
  assert.equal(withdraw.status, 409);
});

test('serves the website and handles same-site and cross-site requests', async () => {
  const origin = base.replace('/api', '');
  const host = new URL(origin).host;

  // The site itself
  const home = await fetch(origin + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<html/i);
  const css = await fetch(origin + '/css/styles.css');
  assert.equal(css.status, 200);

  // Unknown API paths return JSON, not the website
  const missing = await call('GET', '/nope');
  assert.equal(missing.status, 404);
  assert.ok(missing.data.error);

  // A browser POST from the site's own address carries an Origin header and must work
  const sameSite = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://' + host },
    body: JSON.stringify({ schoolEmail: 'nobody@school.test', password: 'whatever123' }),
  });
  assert.equal(sameSite.status, 401); // reached the login handler (wrong credentials), not blocked by CORS

  // A request from some other website is refused
  const foreign = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ schoolEmail: 'nobody@school.test', password: 'whatever123' }),
  });
  assert.equal(foreign.status, 403);
});

test('public sign-up can never create staff', async () => {
  const res = await call('POST', '/auth/signup', {
    body: { fullName: 'Sneaky', schoolEmail: 'sneaky@school.test', password: 'password123', role: 'staff' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, 'student');
});
