# Sweety - Blood Glucose Tracker

Sweety is a full-stack blood glucose tracking application for recording readings, reviewing personal history, and monitoring trends. It combines JWT-protected, owner-scoped records with validation in the Express API and PostgreSQL, plus daily and monthly summary reports.

## Key Features

- **Authentication and data isolation:** Register and sign in with email and password. Passwords are hashed with bcrypt, and JWT-protected reading operations are scoped to the authenticated user.
- **Reading validation:** Glucose values must be integers from 40 to 600 mg/dL. The API accepts four slots: `morning_fasting`, `after_breakfast`, `after_lunch`, and `after_dinner`. Future reading dates are rejected, and a user cannot save more than one reading for the same date and slot.
- **Trend summaries:** The reports endpoint provides count, average, minimum, and maximum values for a selected day (today by default), the current month through today, and the previous calendar month. Averages are rounded to one decimal place.
- **Responsive dashboard:** The React dashboard displays report cards, a reading history table, date/month filters, and add/edit/delete controls. Glucose badges use amber for values below 70 mg/dL, green for 70–140 mg/dL, and red for values above 140 mg/dL.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, native Fetch API |
| Backend | Node.js, Express, CommonJS |
| Database | PostgreSQL, `pg` connection pool |
| Authentication | JSON Web Tokens (`jsonwebtoken`), bcrypt password hashing |

## Project Structure

Generated files such as `node_modules/` and `client/dist/` are omitted.

```text
Sweety/
├── README.md
├── client/
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       ├── components/
│       │   ├── AuthForm.jsx
│       │   └── Dashboard.jsx
│       └── services/
│           └── api.js
└── server/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── app.js
        ├── server.js
        ├── config/
        │   └── db.js
        ├── controllers/
        │   ├── authController.js
        │   └── readingController.js
        ├── middleware/
        │   └── authMiddleware.js
        ├── models/
        │   └── initDb.js
        └── routes/
            ├── authRoutes.js
            └── readingRoutes.js
```

## Local Setup and Installation

### Prerequisites

- Node.js and npm
- PostgreSQL running locally or on a reachable host

### 1. Create the PostgreSQL database

Create the database used by the example configuration. Replace `your_postgres_username` with a PostgreSQL role that can create databases. If `sweety_db` already exists, skip this command.

```powershell
createdb -U your_postgres_username sweety_db
```

### 2. Configure and initialize the backend

In PowerShell, open the server folder and install its dependencies:

```powershell
cd C:\Sweety\server
npm install
```

Create `server/.env` from the example if it does not already exist. Do not overwrite an existing `.env` containing your local settings.

```powershell
Copy-Item .env.example .env
```

Edit `server/.env` and set these exact variables to match your PostgreSQL setup:

```dotenv
PORT=5000
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sweety_db
JWT_SECRET=replace_with_a_long_random_secret
```

Keep `.env` private and do not commit real credentials or secrets. Initialize the tables and start the backend:

```powershell
npm run db:init
npm run dev
```

The database initializer creates the `users` and `glucose_readings` tables if they do not already exist. The server checks its PostgreSQL connection before listening on port `5000`.

### 3. Start the frontend

Open a second terminal:

```powershell
cd C:\Sweety\client
npm install
npm run dev
```

Open the Vite URL printed in the terminal (by default, `http://localhost:5173`). The backend allows this Vite origin, and the frontend API wrapper targets `http://localhost:5000/api`.

### Available checks

From `client/`, run `npm run build` to create a production build or `npm run lint` to run Oxlint. The server package currently has no automated test suite; its `test` script is a placeholder.

## API Endpoints

Reading endpoints require an `Authorization: Bearer <token>` header. Registration and login return a JWT token. Reading operations only return or modify records owned by that token's user.

| Method | Route | Auth required | Description |
| --- | --- | :---: | --- |
| `GET` | `/api/health` | No | Returns backend health status. |
| `POST` | `/api/auth/register` | No | Registers with `{ "email", "password" }`; returns `{ "token", "user" }`. |
| `POST` | `/api/auth/login` | No | Authenticates with `{ "email", "password" }`; returns `{ "token", "user" }`. |
| `GET` | `/api/readings` | Yes | Lists the authenticated user's readings. Supports `?date=YYYY-MM-DD` or `?month=YYYY-MM`. |
| `POST` | `/api/readings` | Yes | Creates a reading for the authenticated user. |
| `GET` | `/api/readings/reports` | Yes | Returns daily, month-to-date, and previous-month statistics. Accepts optional `?date=YYYY-MM-DD` for the daily report. |
| `PUT` | `/api/readings/:id` | Yes | Updates an owned reading. |
| `DELETE` | `/api/readings/:id` | Yes | Deletes an owned reading. |

The current list endpoint returns a JSON array of readings. The reports response contains `daily`, `monthToDate`, and `previousMonth`; each contains `count`, `average`, `min`, and `max`. Empty report periods have a count of `0` and `null` average/min/max values.
