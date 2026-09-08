# Collection Shoe Center — Local development server

This repository contains a small Express server to store products and admin settings, plus the static front-end.

Quick start

1. Install dependencies (Node.js needed):

```bash
npm install
```

2. Start the server:

```bash
npm start
# or configure the required environment variables before running in production
```

3. Open the site in your browser:

 - http://localhost:3000/
 - Admin: http://localhost:3000/admin.html

Required environment variables:
 - `ADMIN_EMAIL`
 - `ADMIN_PASS`
 - `SESSION_SECRET`
 - `OWNER_EMAIL`

The server refuses to start when these values are missing. Never commit real credentials.

PowerShell example:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASS = "use-a-long-random-password"
$env:SESSION_SECRET = "use-a-long-random-secret"
$env:OWNER_EMAIL = "owner@example.com"
$env:DATA_DIR = (Get-Location).Path
npm start
```

Order request email

Both checkout forms send orders to the server's `/api/order-request` endpoint. Configure these environment variables on the server so it can email the shop:

 - `SMTP_HOST`
 - `SMTP_PORT` (optional, defaults to `587`)
 - `SMTP_SECURE` (set to `true` for TLS-enabled SMTP ports such as `465`)
 - `SMTP_USER` and `SMTP_PASS` (when required by the provider)
 - `SMTP_FROM`
 - `OWNER_EMAIL`

The server saves the order before sending the email, so orders remain available in the admin panel if email delivery is temporarily unavailable.

Notes

- The server stores products in `products.json` and settings/hero in `data.json`.
- Set `DATA_DIR` when deploying so the JSON files live on persistent storage; the server prints the resolved directory at startup.
- Set `MONGODB_URI` and `MONGODB_DB` to use MongoDB instead; the first startup imports missing data from the JSON files and later changes are stored in MongoDB.
- Admin login uses server-side session cookies; protected API endpoints are under `/api/*`.
- For production, change `SESSION_SECRET` and `ADMIN_PASS` and run behind HTTPS.
