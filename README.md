# SwachhSetu ♻️ — Hackathon Project

Smart waste management UI with waste image classification (experimental), complaint reporting, tracking, dashboard and a locally persistent Node.js backend.

## Project folders

```text
SwachhSetu_GitHub_Ready/
├── frontend/
│   ├── index.html          # Original dark-green interface
│   ├── css/style.css       # Styles, separated from HTML
│   └── js/
│       ├── app.js          # UI, scanner, optional Supabase support
│       └── api-client.js   # Connects UI to Node backend
├── backend/
│   ├── server.js           # Native Node.js API and web server
│   ├── package.json
│   ├── .env.example        # Example server configuration
│   └── data/.gitkeep       # Persistent JSON data created on first use
├── .gitignore
└── README.md
```

## Run locally (Node.js 18+)

```bash
cd backend
npm start
```

Open **http://localhost:3000**. No `npm install` is needed: the backend uses only built-in Node.js modules.

Create a citizen account via **Login / Sign Up**. Report an issue, scan waste using manual selection, and view your dashboard. Data persists in `backend/data/database.json` between server restarts. This is a hackathon prototype, not a municipal production integration.

### Admin login (optional)

Set both environment variables before starting the server to create an admin account on first run:

**macOS / Linux**

```bash
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD='replace-this-with-a-strong-secret'
cd backend && npm start
```

**Windows PowerShell**

```powershell
$env:ADMIN_EMAIL='admin@example.com'
$env:ADMIN_PASSWORD='replace-this-with-a-strong-secret'
cd backend
npm start
```

Use this admin account to log in and update complaint statuses. Do not commit passwords, the local JSON database, or secrets to GitHub. Changing environment variables later will not change an already created account.

## Frontend / backend connection

When served via `http://localhost:3000`, `frontend/js/api-client.js` detects the backend and connects signup, login, logout, complaint submissions, scan history and admin status changes. If Supabase project URL and key are configured inside the app, that pre-existing integration takes precedence instead. Opening `frontend/index.html` directly uses **local browser demo mode** (not a backend).

## Waste AI

- Uses online TensorFlow.js / MobileNet libraries for **experimental** suggestions.
- MobileNet is **not** a trained waste-classification model. Manual category selection works without AI.
- A trained Teachable Machine image model URL can optionally be configured in app settings. Model names need to match the categories used by the interface.
- Images are classified in the browser and are **not uploaded to the Node backend**.

## Supabase (optional)

The existing frontend offers a Supabase connection. It requires your own project, correctly created `complaints`/`scans` tables and Row Level Security policies. Supabase configuration is not needed to run the Node backend. **Never put a Supabase service_role or secret key in frontend settings.**

## API endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | No |
| POST | `/api/auth/signup` | No |
| POST | `/api/auth/login` | No |
| POST | `/api/auth/logout` | Yes |
| GET | `/api/bootstrap` | Yes |
| GET, POST | `/api/complaints` | Yes |
| GET, POST | `/api/scans` | Yes |
| PATCH | `/api/complaints/:id/status` | Admin |

Use `Authorization: Bearer <token>` for authenticated requests.

## Upload to GitHub

1. Create an empty repository on GitHub.
2. Select **Add file → Upload files**.
3. Drag the **contents** of this folder (`frontend`, `backend`, `.gitignore`, `README.md`) into the GitHub page.
4. Commit changes. Or use `git init`, `git add .`, `git commit -m "Initial SwachhSetu project"`, and push to your remote.

A GitHub repository stores source code; it will **not** automatically run a Node backend through GitHub Pages. Run it on your machine or deploy to a Node-compatible server.

## Demo limitations and security notes

This is a **hackathon demonstration**, not a production-ready service. The backend uses scrypt password hashes, opaque session tokens, basic login throttling and a JSON file store. It does not include email verification, a shared scalable database, HTTPS termination, robust permissions auditing, password resets, or distributed-session support. Data is accessible only via local server unless you deploy it elsewhere. The app does not send real municipal complaints or award real rewards. Browser-based demo mode must not be used for sensitive information.
