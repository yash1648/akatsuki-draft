# Akatsuki's Draft — Backend Implementation Plan

> **Specification Reference:** `docs/SRS.md`  
> **Date:** 2026-10-26  
> **Architecture:** Node.js (TypeScript) + Express + MongoDB/Mongoose + JWT/BCrypt + AI LLM Enhancement + Vitest + MongoMemoryServer

---

## 1. Objectives & Scope
Implement the complete backend API according to `docs/SRS.md`:
1. **User Schema & Role-Based Access Control (RBAC):** `users` collection with `name`, `email`, `password` (bcrypt hashed, never returned), `role` (`user` vs `admin`).
2. **Post Schema & Moderation Lifecycle:** `posts` collection with `title`, `description`, `content`, `image`, `category`, `createdBy`, `status` (`draft`, `pending`, `approved`, `rejected`), `createdAt`, `updatedAt`, `parentPostId`, and `rejectionReason`.
3. **Compound Indexes:** `{ status: 1, createdAt: -1 }` and `{ createdBy: 1, createdAt: -1 }`.
4. **Authentication Module:**
   - `POST /auth/register` (forced `role: "user"`, 409 on existing email, 400 validation).
   - `POST /auth/login` (stateless JWT token + user summary, 401 invalid credentials).
   - `GET /auth/me` (requires Bearer token, returns current profile sans password).
5. **Post Management Module:**
   - `POST /posts` (authenticated, standard user restricted to `draft`/`pending`, 403 on disallowed status).
   - `GET /posts` (public, approved posts only, with pagination `?page=&limit=` and `?category=`).
   - `GET /posts/my-posts` (authenticated, returns author's posts with optional `?status=`, strictly declared before `GET /posts/:id`).
   - `GET /posts/:id` (public for approved; author/admin can also access own drafts/pending/rejected; 404 otherwise).
   - `PATCH /posts/:id` (owner only, disallowed status prevented, automatic revert to `draft`/`pending` if previously `approved`/`rejected`).
   - `DELETE /posts/:id` (owner only, removes post).
6. **Admin Moderation Module:**
   - `GET /admin/posts/pending` (admin only, lists all pending posts with pagination).
   - `PATCH /admin/posts/approve/:id` (admin only, strictly enforces post was in `pending` state, transitions to `approved`).
   - `PATCH /admin/posts/reject/:id` (admin only, strictly enforces `pending` state, records optional `rejectionReason`, transitions to `rejected`).
7. **AI Content Improvement Module:**
   - `POST /ai/improve/:postId` (owner only, strictly non-destructive; generates new draft post with cloned `image`, `category`, `createdBy`, linked `parentPostId`, and AI-improved `title`/`description`/`content`).
   - Resilient AI service with configurable timeout (30s), rate limiting (10 req/user/hour), and graceful 502/504 fallback handling.
8. **Non-Functional & Security Requirements:**
   - JWT expiration (24h/7d) with HS256.
   - Input validation (Zod schema validation on all inputs).
   - NoSQL injection protection (sanitizing `$` and `.` operators).
   - Rate limiting on `/auth/*` and `/ai/improve/*`.
   - Helmet and CORS security headers.
   - 100% comprehensive test coverage with Vitest + MongoMemoryServer + Supertest.

---

## 2. Directory Structure

```
akatsuki-draft/
├── docs/
│   ├── SRS.md
│   └── superpowers/plans/2026-10-26-backend-implementation.md
├── src/
│   ├── config/
│   │   ├── env.ts             # Validated environment configuration (zod)
│   │   └── database.ts        # Mongoose connection & index configuration
│   ├── models/
│   │   ├── User.ts            # Mongoose User model
│   │   └── Post.ts            # Mongoose Post model with compound indexes
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication & optionalAuth middleware
│   │   ├── rbac.ts            # Role-based authorization middleware
│   │   ├── rateLimiter.ts     # Rate limiting middleware
│   │   ├── sanitize.ts        # NoSQL injection stripping middleware
│   │   ├── validate.ts        # Zod validation middleware
│   │   └── errorHandler.ts    # Centralized JSON error handling
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── post.controller.ts
│   │   ├── admin.controller.ts
│   │   └── ai.controller.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── post.routes.ts
│   │   ├── admin.routes.ts
│   │   └── ai.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── post.service.ts
│   │   ├── admin.service.ts
│   │   └── ai.service.ts
│   ├── utils/
│   │   ├── apiError.ts        # Custom HTTP errors
│   │   └── logger.ts
│   ├── app.ts                 # Express application builder
│   └── server.ts              # Production startup entrypoint
├── tests/
│   ├── setup.ts               # MongoMemoryServer lifecycle & DB cleanup
│   ├── auth.test.ts           # /auth/* tests
│   ├── posts.test.ts          # /posts/* tests
│   ├── admin.test.ts          # /admin/* tests
│   ├── ai.test.ts             # /ai/* tests
│   └── security.test.ts       # Rate limiting, NoSQL injection, route ordering tests
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 3. Step-by-Step Implementation Sequence (TDD)

### Phase 1: Project Setup & Tooling Configuration
- Initialize `package.json` with dependencies: `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `cors`, `helmet`, `express-rate-limit`, `zod`, `dotenv`.
- Dev dependencies: `typescript`, `@types/express`, `@types/node`, `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/cors`, `@types/supertest`, `supertest`, `vitest`, `mongodb-memory-server`, `tsx`.
- Configure `tsconfig.json` and `vitest.config.ts`.
- Set up test environment with `MongoMemoryServer` in `tests/setup.ts`.

### Phase 2: Core Models & Schemas (TDD)
- **User Model**: Write unit tests for email validation, password hashing, unique constraint, exclusion in JSON output. Implement `src/models/User.ts`.
- **Post Model**: Write unit tests for constraints (title max 150, description max 300, valid status enum, createdBy ref, compound indexes). Implement `src/models/Post.ts`.

### Phase 3: Auth Module (TDD)
- Test failing cases for registration (missing fields, short password, duplicate email, attempt to pass `role: "admin"`).
- Test failing cases for login (wrong password, unknown email).
- Test failing cases for `/auth/me` (missing token, invalid token).
- Implement `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`, and `auth.ts` middleware.
- Verify all tests pass (GREEN).

### Phase 4: Post Management Module (TDD)
- Test failing cases for `POST /posts` (user attempting `status: "approved"` -> 403, missing required fields -> 400).
- Test public `GET /posts` (only approved posts returned, pagination & category filter).
- Test `GET /posts/my-posts` (author's own posts across all statuses, filtered by `?status=`).
- Verify route ordering: `GET /posts/my-posts` does not trigger `GET /posts/:id`.
- Test `GET /posts/:id` (public gets 404 for unapproved; author/admin can see draft/pending).
- Test `PATCH /posts/:id` (owner check -> 403 for non-owner; automatic revert to `draft`/`pending` if previously approved or rejected).
- Test `DELETE /posts/:id` (owner check -> 403 for non-owner).
- Implement `post.service.ts`, `post.controller.ts`, `post.routes.ts`.
- Verify all tests pass (GREEN).

### Phase 5: Admin Moderation Module (TDD)
- Test RBAC gate: non-admin gets 403 Forbidden on all `/admin/*` routes.
- Test `GET /admin/posts/pending`: returns all pending posts.
- Test `PATCH /admin/posts/approve/:id`:
  - 400 Bad Request if post is `draft`, `approved`, or `rejected` (must be `pending`).
  - 200 OK and status updated to `approved` when `pending`.
- Test `PATCH /admin/posts/reject/:id`:
  - 400 Bad Request if not `pending`.
  - 200 OK and status updated to `rejected`, stores `rejectionReason`.
- Implement `admin.service.ts`, `admin.controller.ts`, `admin.routes.ts`.
- Verify all tests pass (GREEN).

### Phase 6: AI Content Improvement Module (TDD)
- Test ownership verification: non-owner gets 403; non-existent post gets 404.
- Test non-destructive cloning (FR-AI-1 & FR-AI-2):
  - Original post is completely unchanged (same title, content, status, updatedAt).
  - New post document is created with different `_id`, `status: "draft"`, `createdBy: req.user.id`, `parentPostId: original._id`.
  - Content, title, description are improved.
- Test AI provider failure & timeout handling: returns 502/504 cleanly.
- Implement `ai.service.ts`, `ai.controller.ts`, `ai.routes.ts`.
- Verify all tests pass (GREEN).

### Phase 7: Security & Non-Functional Verification
- Rate limiter tests (`/auth/*` and `/ai/improve/*`).
- NoSQL injection sanitizer tests (verifying `$` and `.` operators in body/query/params are stripped).
- Security headers (Helmet) and CORS.
- Database index verification (`Post.collection.getIndexes()`).
- Full test suite run (`npm test`).

### Phase 8: Documentation & Environment Config
- Create `.env.example` with clear documentation.
- Add npm scripts: `dev`, `build`, `start`, `test`.
- Create `README.md` detailing architecture, endpoints, setup, and verification evidence.
