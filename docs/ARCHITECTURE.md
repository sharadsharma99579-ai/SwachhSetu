# SwachhSetu architecture

## Local Node.js mode (recommended hackathon demo)

Browser UI (`frontend/index.html` + CSS + JS) → `frontend/js/api-client.js` → same-origin Node server (`backend/server.js`) → `backend/data/database.json`.

The backend serves static files and exposes HTTP APIs; it owns authentication, users, complaints, scans, and admin-only complaint status changes. Passwords are hashed via scrypt; opaque session tokens are SHA-256 hashed in the JSON database. The browser keeps its bearer token in localStorage (a demo tradeoff).

## AI scanner

The browser downloads TensorFlow.js and MobileNet from a CDN, performs object recognition locally, and maps a limited set of labels into waste categories. This is **not a trained waste classification model** and must be treated as experimental. Manual waste selection works without AI and is saved via the Node backend after login. A custom Teachable Machine model URL can be provided through settings.

## Optional Supabase mode

Original UI has a separate Supabase integration. If configured, it takes precedence over the Node API adapter. Supabase requires correct schemas and RLS policies; this repository does not provision a Supabase instance. Use Node mode for reproducible judging.

## Deployment notes

- A Node.js hosting environment and persistent disk are required for the JSON data store.
- GitHub Pages hosts static files only and cannot run this backend.
- This demo is not a production municipality service. Use PostgreSQL or another transactional database, HTTPS, centralized sessions, audit logs, secrets management, and reviewed authorization before any real-world deployment.
