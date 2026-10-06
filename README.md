# Refuge Animalier du Pays de Landerneau

Public website and volunteer back office of the Refuge Animalier du Pays de Landerneau, replacing the former Overblog blog.

- **Public site**: animals up for adoption (dogs, cats, NAC, farm animals) shown as "portrait plates", animal pages, adopted album, adoption process and fees, events calendar (with iCal export), news, how to help, contact form.
- **Back office** (`/admin`): animals with photos and status, calendar (public or internal events), news, contact inbox, shelter settings (contact details, opening hours, info banner, adoption fees, help page), volunteer accounts with roles.

The interface is in French. Code, comments and logs are in English.

## Stack

- Node.js 22+
- Express 5, Nunjucks templates rendered on the server
- SQLite through the libSQL client: a local file in development, a [Turso](https://turso.tech) database in production
- Photos converted to WebP by `sharp`, stored on disk locally or in Vercel Blob in production
- No front-end framework: plain CSS and a small progressive-enhancement script; every page works without JavaScript

## Getting started

```bash
npm install
cp .env.example .env          # then edit SESSION_SECRET
npm run seed                  # optional: fictional example animals, events and news
npm run create-admin -- "Prénom Nom" email@exemple.fr "un-mot-de-passe-long"
npm run dev                   # http://localhost:3000
```

If no account exists, opening `/admin` also offers a one-time setup page to create the first administrator.

`npm run seed -- --force` replaces animals, events, news and messages with the example content. Never run it on a production database.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port (default `3000`) |
| `NODE_ENV` | yes in production | `production` enables secure cookies and caching |
| `SESSION_SECRET` | yes in production | Long random string signing the session cookie |
| `BASE_URL` | yes in production | Public URL, used in the sitemap, emails and calendar exports |
| `TRUST_PROXY` | no | Number of reverse proxies in front of the app (default `1`). Set `0` if Node is exposed directly, otherwise rate limits can be bypassed with a forged `X-Forwarded-For` |
| `DATABASE_PATH` | no | Local SQLite file (default `./data/refuge.sqlite`), used when `TURSO_DATABASE_URL` is not set |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | in production | Turso database (`libsql://…`) and its token |
| `UPLOAD_DIR` | no | Local photo directory (default `./data/uploads`), used when `BLOB_READ_WRITE_TOKEN` is not set |
| `BLOB_READ_WRITE_TOKEN` | in production | Vercel Blob store token (added automatically when a Blob store is connected to the project) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Outgoing mail server |
| `NOTIFY_EMAIL` | no | Address notified for each contact message (needs SMTP) |

Contact messages are always stored in the back office; email notification is optional.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start in production |
| `npm test` | Run the test suite (`node:test` + supertest) |
| `npm run seed` | Load example content into an empty database |
| `npm run create-admin -- name email password` | Create an administrator account |

## Project layout

```text
src/
  app.js, server.js       Express app and entry point
  config/                 Environment, enumerated labels, default shelter settings
  db/                     SQLite schema, connection, example seed
  repositories/           SQL queries (parameterised)
  services/               Business rules (animals, events, posts, messages, users, images, settings)
  schemas/                Form validation (zod), French error messages
  controllers/            HTTP handlers, public and admin
  routes/                 Route declarations
  middlewares/            Auth, CSRF, rate limiting, uploads, errors
  views/                  Nunjucks templates (public, admin, partials)
public/                   CSS, JS, self-hosted fonts, favicon
data/                     SQLite database and uploaded photos (not versioned)
tests/                    Automated tests
```

## Back office in short

- **Animaux**: create a listing, add photos (the first one is the cover), set compatibility with cats, dogs and children, housing, health, foster family. "À la une" puts the animal in the home page carousel, "SOS" flags an urgent appeal and applies the SOS fee. Setting the status to "Adopté" moves the animal to the adopted album. A live preview shows the plate as it will appear.
- **Agenda**: click a day to add an event. "Interne" events are only visible to volunteers.
- **Actualités**: articles with an optional cover; a future date schedules publication.
- **Messages**: contact form requests, to mark as handled or archive.
- **Réglages**: contact details, opening hours, the yellow info banner, adoption fee grid (the five first dog and cat rows are matched automatically to each animal's age), help page content.
- **Comptes bénévoles** (administrators only): create editor or administrator accounts.

Text fields accept light formatting: a blank line starts a paragraph, lines starting with `- ` make a list, `**text**` is bold, web addresses become links.

## Security notes

- Passwords hashed with scrypt; login and contact form are rate limited; CSRF token on every form.
- Strict Content Security Policy (no inline scripts, no third-party requests: fonts are self-hosted).
- Uploaded files are decoded and re-encoded by `sharp`; anything that is not a readable image is rejected.
- The session cookie is the only cookie; "coups de cœur" stay in the visitor's browser (localStorage).

## Deployment (Vercel, free tier)

The app runs on Vercel as a single serverless function (`api/index.js`); `public/` is served by Vercel's CDN (`vercel.json`). Data lives outside the function: the database on Turso, photos in Vercel Blob. All three have free tiers. Vercel's free Hobby plan is meant for non-commercial use.

1. **Vercel**: sign in at vercel.com with GitHub, then *Add New → Project* and import this repository. Keep the defaults (no framework, no build command).
2. **Database**: in the project, *Storage → Create → Turso (Marketplace)*, create a database and connect it to the project. This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (a custom prefix chosen in the connect dialog is fine). (Alternatively create the database on turso.tech and add both variables by hand.)
3. **Photos**: *Storage → Create → Blob*, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Variables**: *Settings → Environment Variables*, add `SESSION_SECRET` (a long random string, e.g. `openssl rand -base64 48`). `BASE_URL` is optional on Vercel (the production domain is detected); set it if you use a custom domain.
5. **Redeploy** (*Deployments → Redeploy*) so the function picks up the variables. The schema is created automatically on the first request.
6. Open `https://<your-project>.vercel.app/admin`: the setup page creates the first administrator account.

Optional, to load the example content into Turso from your machine:

```bash
TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run seed
```

Troubleshooting: `GET /sante` returns a JSON report without secrets: database in use (Turso host or local file), photo storage, names of the configuration variables present, and row counts. On Vercel the app refuses to start without a Turso URL, since nothing could be saved on its read-only file system.

Notes: request bodies are limited to about 4.5 MB on Vercel, so the back office shrinks photos in the browser before uploading; the login and contact rate limits are per function instance. For a classic server instead (VPS), run `npm start` behind an HTTPS reverse proxy with the same variables (or the local file and disk defaults) and back up `data/`.

## Content to replace

The example animals, events and news are fictional and are marked "exemple" on the public site. A record stops being an example as soon as a volunteer saves it from the back office; otherwise delete it. Real shelter information (address, phone, opening hours, adoption fees, help options, certificat d'engagement) comes from the former website and can be edited under Réglages.
