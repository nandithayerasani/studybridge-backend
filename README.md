# StudyBridge Backend

Node/Express API service for the StudyBridge tutoring platform. Connects to the Railway MySQL database and exposes REST endpoints for auth, users/tutors, subjects, availability, sessions, study plans, notifications, messaging, reviews, payments, AI helpers, and marketing content.

## Getting started

```bash
cd studybridge-backend
npm install
cp .env.example .env
# edit .env to point DATABASE_URL or DB_* to your Railway MySQL
npm run dev
```

The server listens on `PORT` (default `4000`) and mounts all routes under `/api`.

## Connecting to Railway MySQL

In your Railway MySQL service you will see variables like `MYSQL_URL`, `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQL_DATABASE`.

For local development, either:

- Set `DATABASE_URL` in `.env` to the exact value of `MYSQL_URL`, e.g.

```env
DATABASE_URL=mysql://root:password@host:port/railway
```

or

- Fill `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` from the corresponding Railway values.

When deployed on Railway, set `DATABASE_URL` in the backend service to reference the MySQL service's `MYSQL_URL`.

## Main endpoints (high level)

All routes are prefixed with `/api`.

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/subjects`, `GET /api/subjects/:id`
- `GET /api/tutors`, `GET /api/tutors/:id`, `GET /api/tutors/:id/availability`, `POST /api/tutors/:id/availability`
- `PATCH /api/availability/:id`, `DELETE /api/availability/:id`
- `GET /api/sessions`, `GET /api/sessions/:id`, `POST /api/sessions`, `PATCH /api/sessions/:id`
- `GET /api/sessions/:id/messages`, `POST /api/sessions/:id/messages`
- `POST /api/sessions/:id/review`
- `GET /api/study-plans/students/:studentId`, `POST /api/study-plans/students/:studentId`
- `GET /api/study-plans/:id`, `PATCH /api/study-plans/:id`
- `GET /api/study-plans/:id/tasks`, `POST /api/study-plans/:id/tasks`
- `PATCH /api/study-plans/tasks/:taskId`, `DELETE /api/study-plans/tasks/:taskId`
- `GET /api/notifications`, `PATCH /api/notifications/:id`, `POST /api/notifications/mark-all-read`
- `POST /api/payments/checkout`, `GET /api/payments/transactions`, `GET /api/payments/summary`
- `POST /api/ai/study-plan`, `POST /api/ai/session-summary`, `POST /api/ai/tutor-bot`
- `GET /api/marketing/hero`, `GET /api/marketing/testimonials`, `GET /api/marketing/partners`, `GET /api/marketing/metrics/public`

These are aligned with the higher-level requirements in `API_REQUIREMENTS.md` in the frontend repo.

## Environment variables (.env example)

For demo purposes, the backend expects a `.env` file shaped like this. **Do not commit real secrets to a public repo.** Replace the placeholder values with your own when running this in another environment.

In your **local/private copy** (or a demo you share 1:1), you can paste your actual `DB_PASSWORD`, `JWT_SECRET`, and `OPENAI_API_KEY` values into this template.
