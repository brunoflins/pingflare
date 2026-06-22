# Pingflare 🔥

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-FF3E00?logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![D1 Database](https://img.shields.io/badge/Cloudflare-D1-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

https://github.com/user-attachments/assets/c33e20fd-6a82-4e57-b95a-ec06bbf701f5

Uptime monitoring and heartbeats. Runs on the **Cloudflare free tier** (Workers + D1) or on **any Docker host** (Fly.io, Railway, VPS) with SQLite.

Sends alerts through Discord, Slack, Telegram, Email, ntfy, Pushover, generic webhooks, Apprise, and Google Chat.

---

## Deploy

Two deployment modes are supported:

| | Cloudflare Workers | Docker / VPS |
|---|---|---|
| **Database** | Cloudflare D1 | SQLite (local file) |
| **Cron** | Cloudflare Triggers | node-cron (built-in) |
| **Cost** | Free tier | Depends on host |
| **Setup** | CF dashboard or `wrangler deploy` | `docker compose up` |

---

## ☁️ Deploy on Cloudflare Workers

> **Recommended:** Fork this repository to your own GitHub account. This gives you full control over updates, pull upstream changes whenever you want, and Cloudflare deploys automatically from your fork on every push.

> **Quick start:** Use the button below to deploy instantly from the current version of this repository. Note that this won't receive future updates automatically.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/butialabs/pingflare)

### 1. Create the D1 database

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Database > D1 SQL Database**
2. Click **Create database**, name it `pingflare`, and confirm

### 2. Connect the database to the Worker

1. Open **Workers & Pages**, click on the `pingflare` Worker
2. Go to **Settings > Bindings > Add binding**
3. Choose **D1 Database**, set the variable name to `DB`, and select the `pingflare` database

### 3. Set the required secrets

Still on **Settings > Variables**, add the following under **Secret variables**:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_USER` | Yes | Username |
| `ADMIN_PASS` | Yes | Password |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens, min 32 characters |
| `ENCRYPTION_KEY` | Yes | Key used to encrypt notification credentials at rest. Min 32 characters. |

### 4. Redeploy

Click **Deployments > Retry deploy** (or push any commit). On the first request, the Worker automatically creates all database tables.

Your dashboard will be live at `https://pingflare.<your-subdomain>.workers.dev`.

---

## 🐳 Deploy with Docker

```bash
curl -O https://raw.githubusercontent.com/butialabs/pingflare/main/compose.yml

# Edit the file and fill in ADMIN_USER, ADMIN_PASS, JWT_SECRET, ENCRYPTION_KEY

docker compose up -d
```

Open `http://localhost:3000`.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_USER` | Yes | — | Dashboard username |
| `ADMIN_PASS` | Yes | — | Dashboard password |
| `JWT_SECRET` | Yes | — | JWT signing key, min 32 chars |
| `ENCRYPTION_KEY` | Yes | — | AES-GCM key for notification credentials, min 32 chars |

> Mount a volume at `/data` to persist the database

---

## ✈️ Deploy on Fly.io

```bash
fly launch --name pingflare
fly volumes create pingflare_data --size 1 --region iad

fly secrets set \
  ADMIN_USER=admin \
  ADMIN_PASS=yourpassword \
  JWT_SECRET=your-jwt-secret-min-32-chars \
  ENCRYPTION_KEY=your-enc-key-min-32-chars

fly deploy
```

---

## Docs

- [LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
- [LOCALES.md](docs/LOCALES.md)
- [API.md](docs/API.md)

---

## Cloudflare Free Tier Limits

When running on Cloudflare Workers, Pingflare is designed to stay within free tier limits:

- Workers: 100,000 requests per day
- D1: 100,000 write rows per day, 5 million read rows per day
- Cron Triggers: minimum 1-minute interval

With the default 90-day log retention and automatic cleanup on each cron run, write usage stays bounded proportional to the number of active monitors.

> When running in Docker mode, there are no such limits — SQLite has no row quotas and the cron runs on the same Node.js process..
