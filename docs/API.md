# REST API reference

Base URL: `http://localhost:3000/api`. Requests with a body use `Content-Type: application/json`. Protected routes use `Authorization: Bearer TOKEN`.

| Method | Route | Body / Notes |
|---|---|---|
| GET | `/health` | Public health check |
| POST | `/auth/signup` | `{ "name": "Student", "email": "student@example.com", "password": "password123" }` |
| POST | `/auth/login` | `{ "email": "student@example.com", "password": "password123" }` |
| POST | `/auth/logout` | Revokes bearer token |
| GET | `/bootstrap` | Current account and visible complaints/scans |
| GET | `/complaints` | User's complaints; admin sees all |
| POST | `/complaints` | `{ "issue": "Overflowing Bin", "description": "Garbage around bus stop", "location": "Bus stop" }` |
| GET | `/scans` | Current user's scans |
| POST | `/scans` | `{ "category": "Wet" }` (also `Dry`, `Hazardous`, `E-Waste`) |
| PATCH | `/complaints/:id/status` | Admin only: `{ "status": "Resolved" }` |

All responses are JSON, other than static UI assets. Error responses contain an `error` string.

Examples:

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Student","email":"student@example.com","password":"password123"}'
```

Do not commit real credentials or tokens.
