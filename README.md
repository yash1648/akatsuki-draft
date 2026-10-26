# Akatsuki’s Draft — Backend API

> **AI-Enabled Content Sharing Platform Backend**  
> Built strictly according to the specifications in [`docs/SRS.md`](docs/SRS.md).

---

## 🚀 Features & SRS Compliance

1. **Role-Based Access Control (RBAC):**
   - Secure stateless authentication using JSON Web Tokens (JWT, HS256).
   - Strict registration role enforcement: public registration (`POST /auth/register`) enforces `role: "user"` (FR-AUTH-1, FR-AUTH-2).
   - Roles: `user` (content author) and `admin` (moderator).
   - Passwords hashed with `bcryptjs` (10 rounds) and excluded from all API output.

2. **Moderated Publishing Workflow:**
   - Post lifecycle states: `draft` ➔ `pending` ➔ `approved` / `rejected`.
   - **FR-POST-1 (Creation Status Constraint):** Standard users are restricted to `draft` or `pending`. Attempts to pass `approved` or `rejected` are blocked with `403 Forbidden`.
   - **FR-POST-2 (Edit Reset Rule):** Updating an `approved` or `rejected` post automatically resets its status to `draft` (or `pending` if explicitly requested) to prevent unreviewed edits from appearing live.
   - **FR-POST-3 (Route Ordering):** `GET /posts/my-posts` is declared **before** `GET /posts/:id` in Express routers to avoid route parameter collision.
   - **FR-ADMIN-1 (Admin Moderation):** Only posts in `pending` status can be approved or rejected. Private user drafts cannot be force-approved.

3. **AI Content Improvement (Non-Destructive Versioning):**
   - **FR-AI-1:** `POST /ai/improve/:postId` never mutates the original post.
   - **FR-AI-2:** Synthesizes an improved title, description, and content while copying category, image, author, and linking `parentPostId`, saving it as a distinct new document with `status: "draft"`.
   - **NFR-PERF-2 & NFR-SEC-3:** Explicit 30s timeout, 10 requests/hour rate limiter, and graceful `502 Bad Gateway` / `504 Gateway Timeout` error handling. Supports Gemini API with intelligent local fallback.

4. **Security & Non-Functional Requirements:**
   - **NoSQL Injection Defense (NFR-SEC-2):** Recursive stripping of `$` and `.` operators on `req.body`, `req.query`, and `req.params`.
   - **Compound Database Indexes (NFR-PERF-1):** `{ status: 1, createdAt: -1 }` and `{ createdBy: 1, createdAt: -1 }` on the `posts` collection.
   - **HTTP Protection:** Helmet headers (`x-frame-options`, `nosniff`), CORS, rate limiting.

---

## 📁 Project Structure

```
akatsuki-draft/
├── docs/
│   ├── SRS.md                                    # Software Requirements Specification
│   └── superpowers/plans/
│       └── 2026-10-26-backend-implementation.md  # Implementation Plan
├── src/
│   ├── config/
│   │   └── database.ts                           # MongoDB connection handler
│   ├── controllers/
│   │   ├── admin.controller.ts                   # Admin approval & rejection handlers
│   │   ├── ai.controller.ts                      # AI improvement handler
│   │   ├── auth.controller.ts                    # Register, login, getMe handlers
│   │   └── post.controller.ts                    # Post CRUD & query handlers
│   ├── middleware/
│   │   ├── auth.ts                               # JWT verification (authenticate & optionalAuthenticate)
│   │   ├── errorHandler.ts                       # Centralized JSON error response handler
│   │   ├── rateLimiter.ts                        # Express rate limiters (auth & AI)
│   │   ├── rbac.ts                               # Role-based authorization middleware
│   │   ├── sanitize.ts                           # NoSQL injection protection middleware
│   │   └── validate.ts                           # Zod request validator middleware
│   ├── models/
│   │   ├── Post.ts                               # Post schema & compound indexes
│   │   └── User.ts                               # User schema & bcrypt methods
│   ├── routes/
│   │   ├── admin.routes.ts                       # /admin/posts endpoints
│   │   ├── ai.routes.ts                          # /ai endpoints
│   │   ├── auth.routes.ts                        # /auth endpoints
│   │   └── post.routes.ts                        # /posts endpoints
│   ├── services/
│   │   ├── admin.service.ts
│   │   ├── ai.service.ts
│   │   ├── auth.service.ts
│   │   └── post.service.ts
│   ├── utils/
│   │   └── apiError.ts                           # Typed HTTP error classes
│   ├── app.ts                                    # Express application configuration
│   └── server.ts                                 # Application bootstrap & graceful shutdown
├── tests/
│   ├── setup.ts                                  # In-memory MongoDB lifecycle for tests
│   ├── admin.test.ts                             # Moderation module tests
│   ├── ai.test.ts                                # AI non-destructive improvement tests
│   ├── auth.test.ts                              # Authentication module tests
│   ├── models.test.ts                            # Mongoose schema, validation & index tests
│   ├── posts.test.ts                             # Post CRUD, status rules & ordering tests
│   └── security.test.ts                          # Injection, rate limit & security tests
├── .env.example                                  # Template for environment configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v20+ or v24 LTS recommended)
- MongoDB instance (local `mongod` or MongoDB Atlas URI)

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port the server listens on | `5000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/akatsuki_draft` |
| `JWT_SECRET` | Secret key used to sign JWTs | (Required in production) |
| `JWT_EXPIRES_IN` | Token expiration time | `24h` |
| `GEMINI_API_KEY` | Google Gemini API key for AI text enhancement | (Optional in dev/test) |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `AI_TIMEOUT_MS` | Upstream AI timeout in milliseconds | `30000` |

### 3. Development Server
```bash
npm run dev
```

### 4. Build & Production Run
```bash
npm run build
npm start
```

### 5. Running Tests
Tests use an embedded in-memory MongoDB server (`mongodb-memory-server`) requiring no external database or credentials:
```bash
npm test
```

---

## 📡 API Reference

### Authentication (`/auth`)
| Method | Endpoint | Access | Body / Params | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | Public | `{ name, email, password }` | Registers a new user. Strictly forces `role: "user"`. |
| `POST` | `/auth/login` | Public | `{ email, password }` | Authenticates user; returns JWT token and user info. |
| `GET` | `/auth/me` | User / Admin | Header: `Authorization: Bearer <token>` | Returns profile of authenticated user. |

### Post Management (`/posts`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/posts` | User / Admin | Creates a post. Standard users restricted to `draft` or `pending`. |
| `GET` | `/posts` | Public | Lists all `approved` posts with pagination (`?page=1&limit=10&category=...`). |
| `GET` | `/posts/my-posts` | User / Admin | Lists all posts authored by current user (`?status=draft|pending|...`). |
| `GET` | `/posts/:id` | Public / Author | Returns approved post publicly; author/admin can also access own drafts/pending. |
| `PATCH` | `/posts/:id` | Owner only | Updates post fields. Reverts `approved`/`rejected` posts to `draft` or `pending`. |
| `DELETE` | `/posts/:id` | Owner only | Deletes post. |

### Admin Moderation (`/admin/posts`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/admin/posts/pending` | Admin only | Lists all posts awaiting review (`?page=1&limit=10`). |
| `PATCH` | `/admin/posts/approve/:id` | Admin only | Approves a pending post (`status: "approved"`). 400 if not pending. |
| `PATCH` | `/admin/posts/reject/:id` | Admin only | Rejects a pending post (`status: "rejected"`) with optional `{ rejectionReason }`. |

### AI Enhancement (`/ai`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/ai/improve/:postId` | Owner only | Clones post into a new draft with AI-improved title, description, and body. Non-destructive. Rate limited (10/hr). |
