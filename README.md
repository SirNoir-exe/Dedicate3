# Song Dedications API

The complete school birthday song dedication system: the API **and** the website, in one app.
Students sign up with their school email, submit dedications, and two staff accounts (you and the
social prefect) manage them in a protected panel, marking each one **played**, **belated** or
**cancelled**.

The website (plain HTML, CSS and JS) lives in `public/` and is served by this same server, so you
host and run a single thing.

Stack: Node 22.13+, Express, SQLite (Node's built-in `node:sqlite`, so no database server to
install), JWT auth, bcrypt password hashing.

## Setup

```bash
npm install
cp .env.example .env        # then edit .env and set JWT_SECRET
npm test                    # optional but recommended
npm start                   # open http://localhost:4000
```

Open http://localhost:4000 in your browser: that is the website. The API is at `/api/...` on the same address.
Set your school's name in `public/js/config.js`.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Creating staff accounts

Staff accounts cannot be created through public sign-up (the API always makes students). Use the
script instead:

```bash
npm run create-staff -- "Your Name" you@school.edu StrongPassword123
# later, for the social prefect:
npm run create-staff -- "Social Prefect" prefect@school.edu AnotherStrongPass
```

If the email already exists, that account is promoted to staff and its password is reset.

## Deploying without installing Node (Railway)

1. Put this folder in a **private** GitHub repository (on github.com choose "uploading an existing
   file" and drag in the folder's contents).
2. On railway.com sign in with GitHub, then New Project > Deploy from GitHub repo. Railway builds
   it and runs `npm start` by itself.
3. In the service, add a **Volume** and mount it at `/data`.
4. In the service's Variables, add:
   - `JWT_SECRET`: a long random string (48+ characters, from any password generator)
   - `DB_PATH`: `/data/dedications.db`
   - `TRUST_PROXY`: `1`
   - `STAFF_1_NAME`, `STAFF_1_EMAIL`, `STAFF_1_PASSWORD` (your staff account), and the `STAFF_2_...`
     set for the social prefect when ready
   - `ALLOWED_EMAIL_DOMAIN` (optional)
5. In Settings > Networking, generate a domain. That https address is your live site.
6. Once you can log in as staff, delete the `STAFF_*_PASSWORD` variables.

## Using it from your frontend

The bundled website already does all of this. If you build your own frontend elsewhere, send the
token from login/signup as `Authorization: Bearer <token>` on every request except sign-up and
login, and set `CORS_ORIGIN` in `.env` to that frontend's address.
Errors always look like `{ "error": "Human readable message" }`.

### Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `fullName, schoolEmail, className?, password` | Returns `{ token, user }`. Password 8+ chars. |
| POST | `/api/auth/login` | `schoolEmail, password` | Returns `{ token, user }`. |
| GET | `/api/auth/me` | | Returns `{ user }`. Use it to restore a session; `user.role` is `student` or `staff`. |

### Dedications (any logged-in user)

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/dedications` | `fromName, toName, song, artist?, meal?, comment?, playDate` | `playDate` is `YYYY-MM-DD` (the birthday). Returns `{ dedication }`, status `pending`. |
| GET | `/api/dedications/mine` | | The user's own dedications and their current status. |
| DELETE | `/api/dedications/:id` | | Withdraw your own dedication, only while still `pending`. |

### Staff panel (staff accounts only, everyone else gets 403)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/dedications` | Optional filters: `status`, `date`, `from`, `to`, `q` (searches names, song, artist). Sorted by play date. Includes `submittedBy`. |
| GET | `/api/admin/stats` | Counts per status: `{ stats: { pending, played, belated, cancelled } }`. |
| PATCH | `/api/admin/dedications/:id/status` | Body `{ status: "played" \| "belated" \| "cancelled" \| "pending", note? }`. Records who handled it and when. Setting `pending` puts it back in the queue. |

### Dedication object

```json
{
  "id": 1,
  "fromName": "Ada",
  "toName": "Chi",
  "song": "Calm Down",
  "artist": "Rema",
  "meal": "Jollof rice",
  "comment": "Happy birthday!",
  "playDate": "2026-11-06",
  "status": "pending",
  "statusNote": null,
  "handledAt": null,
  "createdAt": "2026-11-05 13:00:00",
  "submittedBy": { "id": 2, "fullName": "Ada Obi", "schoolEmail": "ada@school.test", "className": "SS2A" },
  "handledByName": null
}
```

`submittedBy` and `handledByName` appear only in staff responses.

## Notes

- Set `ALLOWED_EMAIL_DOMAIN` (e.g. `myschool.edu.ng`) to restrict sign-ups to your school's emails.
- Login allows 10 failed attempts per email per 15 minutes (successful logins don't count), and sign-up allows 200 per 15 minutes per IP, so a whole class on the school network can sign up together.
- The database is one file at `DB_PATH` (default `./data/dedications.db`). Back it up by copying it.
- Deploy somewhere that keeps a persistent disk and runs Node 22.13+ (a small VPS, Railway with a
  volume, Render with a disk), since SQLite stores data in that file. Point `DB_PATH` at the
  mounted disk, for example `/data/dedications.db`.
- On a host that puts a proxy in front of your app (Render, Railway, Fly), set `TRUST_PROXY=1`.
  Without it the login rate limit would treat everyone at school as one visitor.
- Serve it over https in production. Set a strong `JWT_SECRET` in the host's environment settings;
  never commit your `.env` file.
- Run the tests with `npm test`.
