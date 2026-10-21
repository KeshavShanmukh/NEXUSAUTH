# NexusAuth: Enterprise Authentication, RBAC Administration, & Concurrency-Safe Quota Management Engine

An enterprise-grade authentication, role-based access control (RBAC), platform analytics, and concurrency-safe usage tracking and quota management system built with Node.js, Express, and SQLite with WAL mode.

---

## 🚀 Key Highlights & Features

### 1. Dual Authenticated Experience
- **Dedicated Administrator Console**:
  - Role-Based Access Control (RBAC) separating administrative personnel from normal users.
  - Multi-administrator support with granular permissions:
    - `super_admin`: Full platform governance, plan configuration, administrator lifecycle.
    - `support_admin`: User account status management, quota overrides, privacy request fulfillment.
    - `auditor`: Read-only compliance access to platform analytics, user records, and immutable audit logs.
  - **Protection of the Last Active Super Admin**: Hardened safeguards preventing accidental deletion, suspension, or demotion of the final remaining super administrator.
  - Support for multi-factor authentication (MFA) challenges and session expiration.
  - Immutable audit logging for every administrative action.
- **Normal User Workspace**:
  - Secure registration, email verification workflow, and password recovery.
  - Personalized dashboard displaying active plan, billing period boundaries, and quota gauges.
  - **Interactive Feature Simulator**: In-browser testing for Resume Creation, AI Resume Analysis (with token and cost tracking), Job Description Matching, AI Suggestions, and PDF Exports.
  - Strict Cross-User Data Isolation: Users can never access or modify other users' resumes, documents, reports, or usage records.
  - Session management with one-click revocation, password change, and GDPR right to erasure (account deletion).

### 2. High-Performance Concurrency-Safe Quota Engine
- Eliminates race conditions through **atomic serializable transactions** (`BEGIN IMMEDIATE` in SQLite with WAL mode).
- When multiple concurrent requests compete for the final available quota unit, exactly one succeeds and all others are safely rejected with `429 Quota Exceeded`.
- Configurable limits per plan (`free`, `premium`, `enterprise`) across all platform features:
  - Resume Creation
  - Resume Analysis (with ATS scoring)
  - LinkedIn Profile Analysis
  - Job Description Matching
  - AI Content Suggestions
  - PDF & DOCX Exports
  - Interview Practice Sessions
- **Administrative Quota Overrides**: Administrators can override limits for specific users with mandatory documented reason logging in both `quota_adjustments` and `admin_audit_events`.
- **Idempotency**: Prevents double-counting via `Idempotency-Key` headers.
- **Fair Metering**: Failed operations are refunded immediately and not counted as successful usage.

### 3. Centralized Append-Only Usage & AI Analytics
- Append-only `usage_events` records:
  - Event ID, User ID, Feature Name, Status (`success`, `failed`, `aborted`), Correlation ID, Units Consumed.
  - AI Provider (OpenAI, Anthropic, Google), AI Model (`gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`).
  - Prompt tokens, completion tokens, total tokens, and estimated cost in USD.
- Platform analytics computing:
  - Daily Active Users (DAU), Weekly Active Users (WAU), Monthly Active Users (MAU).
  - Total logins and authentication failures.
  - Operation counts by feature, average processing time, and system error rate.
  - Total billable AI API expenditures.

### 4. Billing & Subscription Readiness
- Plan & entitlement abstractions allowing payment integration without refactoring the usage engine.
- Webhook processor supporting HMAC SHA-256 signature verification (`X-Webhook-Signature`).
- Idempotent webhook execution via `processed_webhooks` table.

---

## 🛠️ Technology Stack & Architecture

- **Backend Runtime**: Node.js v22+
- **HTTP Framework**: Express 5
- **Database Engine**: SQLite 3 with Write-Ahead Logging (WAL mode), foreign key constraints, and 10,000ms busy timeout.
- **Security & Cryptography**:
  - Password Hashing: `bcryptjs` (salt rounds: 10)
  - Tokens: Cryptographically secure random tokens hashed via SHA-256 for database storage
  - Sessions: JWT with HTTP-only, Secure, SameSite cookies + Bearer token support
  - Abuse Protection: `express-rate-limit` (login rate limiting and brute-force account lockout after 5 consecutive failed attempts)
- **Frontend**: Vanilla HTML5, CSS custom properties design system (dark glassmorphism, glowing accents, modern typography), and modular JavaScript.
- **Testing**: `supertest` with automated integration and concurrency test suites.

---

## 📊 Relational Database Schema

```
 ┌──────────────────────┐         ┌──────────────────────┐
 │        users         │◄───┐    │        roles         │
 ├──────────────────────┤    │    ├──────────────────────┤
 │ id (PK)              │    │    │ id (PK)              │
 │ email (UNIQUE)       │    │    │ name (UNIQUE)        │
 │ password_hash        │    │    │ description          │
 │ status               │    │    └──────────┬───────────┘
 │ failed_attempts      │    │               │
 │ locked_until         │    │    ┌──────────┴───────────┐
 └──────────┬───────────┘    └───┼┤      user_roles      │
            │                     └──────────────────────┘
            ├─────────────────────┐
            │                     │
 ┌──────────▼───────────┐  ┌──────▼───────────────┐
 │    user_sessions     │  │  user_subscriptions  │
 ├──────────────────────┤  ├──────────────────────┤
 │ token_hash (UNIQUE)  │  │ plan_id (FK)         │
 │ is_revoked           │  │ status               │
 └──────────────────────┘  └──────────────────────┘
            │
            ├─────────────────────┐
            │                     │
 ┌──────────▼───────────┐  ┌──────▼───────────────┐
 │     usage_events     │  │   usage_summaries    │
 ├──────────────────────┤  ├──────────────────────┤
 │ units_consumed       │  │ units_used           │
 │ ai_provider / model  │  │ override_limit       │
 │ prompt / comp tokens │  │ quota_period_id (FK) │
 │ estimated_cost       │  └──────────────────────┘
 └──────────────────────┘
```

---

## 🔑 Default Seed Credentials & Personas

Run `npm run seed` to initialize the database with default personas:

| Persona | Email | Password | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@platform.local` | `SuperAdmin@2026Secure!` | `super_admin` | Full platform control, user status, quota overrides, plans |
| **Support Admin**| `support@platform.local` | `SuperAdmin@2026Secure!` | `support_admin`| User management, suspension, quota modifications |
| **Compliance Auditor** | `auditor@platform.local` | `SuperAdmin@2026Secure!` | `auditor` | Read-only analytics, user lists, immutable audit logs |
| **Free User** | `freeuser@example.com` | `UserPassword123!` | `user` | Standard user with Free plan quotas (3 resumes, 5 analyses) |
| **Premium User** | `premiumuser@example.com` | `UserPassword123!` | `user` | Upgraded user with Premium quotas (50 resumes, 100 analyses) |
| **Suspended User**| `suspendeduser@example.com`| `UserPassword123!` | `user` | Suspended account (demonstrates 403 Forbidden blocking) |

---

## 📡 API Reference

All endpoints are versioned under `/api/v1`.

### 1. Authentication Endpoints
- `POST /api/v1/auth/register` - Create new user account with unverified status and verification token.
- `POST /api/v1/auth/login` - Authenticate with email/password; handles brute-force lockout, MFA, and returns JWT.
- `POST /api/v1/auth/logout` - Revoke current session in database and clear HTTP-only cookie.
- `POST /api/v1/auth/forgot-password` - Generate password reset token with 60-minute expiry.
- `POST /api/v1/auth/reset-password` - Validate token, hash new password, and revoke all existing user sessions.
- `POST /api/v1/auth/verify-email` - Verify email address using token.
- `GET  /api/v1/auth/me` - Retrieve authenticated user profile, roles, permissions, and subscription.
- `PATCH /api/v1/auth/profile` - Update profile name and details.
- `PATCH /api/v1/auth/change-password` - Verify current password and update to new password.
- `GET  /api/v1/auth/sessions` - List active sessions for the current user.
- `DELETE /api/v1/auth/sessions/:sessionId` - Revoke a specific session.
- `DELETE /api/v1/auth/delete-account` - Permanently erase account and private documents (GDPR right to erasure).

### 2. User Usage & Feature Endpoints
- `GET  /api/v1/usage/me` - Aggregated user consumption metrics, total tokens, and recent events.
- `GET  /api/v1/usage/me/quotas` - Current billing cycle limits, used units, remaining quota, and reset date.
- `GET  /api/v1/usage/me/history` - Paginated usage event history with filters.
- `GET  /api/v1/plans` - Public subscription tiers and feature entitlement limits.
- `GET  /api/v1/resumes` - List resumes owned by authenticated user.
- `POST /api/v1/resumes` - Create resume; checks & consumes `resume_creation` quota.
- `GET  /api/v1/resumes/:id` - View resume details with strict owner-only access check (403 for other users).
- `POST /api/v1/resumes/:id/export-pdf` - Checks & consumes `pdf_exports` quota.
- `POST /api/v1/resumes/:id/analyze` - Checks & consumes `resume_analysis` quota; records AI tokens & cost.
- `POST /api/v1/jobs/match` - Checks & consumes `job_matching` quota.
- `POST /api/v1/ai/suggest` - Checks & consumes `ai_suggestions` quota.
- `POST /api/v1/features/consume` - Generic simulator endpoint supporting idempotency and failure simulation.

### 3. Administration Endpoints (Admin RBAC Required)
- `GET   /api/v1/admin/dashboard` - Dashboard overview combining platform analytics, recent events, and audits.
- `GET   /api/v1/admin/users` - Search, filter by status and plan, sort, and paginate user records.
- `GET   /api/v1/admin/users/:userId` - Deep inspection of user profile, roles, quotas, and recent usage.
- `PATCH /api/v1/admin/users/:userId/status` - Update status (`active`, `suspended`, `deactivated`); logs audit event.
- `DELETE /api/v1/admin/users/:userId` - Administrative account purge and privacy deletion.
- `GET   /api/v1/admin/usage/summary` - Aggregated platform analytics (DAU/WAU/MAU, logins, AI expenditure).
- `GET   /api/v1/admin/usage/users/:userId` - Account-level usage details.
- `GET   /api/v1/admin/usage/events` - Query append-only platform usage events.
- `GET   /api/v1/admin/audit-logs` - Query immutable administrative audit trail.
- `GET   /api/v1/admin/plans` - List plans with all configurable feature entitlements.
- `PATCH /api/v1/admin/plans/:planId` - Modify plan pricing and feature monthly limits.
- `PATCH /api/v1/admin/users/:userId/quotas` - Administrative quota override with mandatory reason logging.
- `GET   /api/v1/admin/admins` - List platform administrators and their assigned roles.
- `POST  /api/v1/admin/admins` - Provision/invite new administrator with assigned role.
- `PATCH /api/v1/admin/admins/:userId/role` - Update administrator role (with last super admin protection).
- `DELETE /api/v1/admin/admins/:userId` - Revoke administrator privileges.

### 4. Billing & Webhook Endpoints
- `POST /api/v1/billing/checkout` - Create checkout session for subscription tier.
- `POST /api/v1/billing/cancel` - Schedule subscription cancellation at period end.
- `POST /api/v1/billing/webhook` - Idempotent webhook processor with HMAC signature verification.

---

## 🧪 Automated Test Suite

The test suite in `tests/runAllTests.js` executes 22 automated integration and concurrency tests covering all acceptance criteria:

```bash
npm test
```

### Verified Test Matrix:
1. `Super Admin successful login` (200 OK + JWT + RBAC)
2. `Normal user login with invalid password returns 401`
3. `Brute-force lockout triggers after repeated failed attempts` (Returns 423 Locked)
4. `Normal User successful login after lockout clear`
5. `User registration creates account with unverified email` (201 Created)
6. `Duplicate email registration returns 409 Conflict`
7. `Register second test user for isolation tests`
8. `Password reset request and execution revokes existing sessions`
9. `Unauthenticated request to admin endpoint returns 401 Unauthorized`
10. `Normal user request to admin endpoint returns 403 Forbidden`
11. `Normal user cannot escalate to admin via profile update or client manipulation`
12. `User creates private resume`
13. `Another user cannot access private resume` (Returns 403 Forbidden)
14. `Another user cannot export or analyze private resume`
15. `Concurrency Safety: Atomic checks prevent race conditions on quota exhaustion` (10 concurrent requests competing for 1 remaining unit: exactly 1 succeeds, 9 return 429)
16. `Idempotency key prevents double counting on repeated requests`
17. `Failed operations do not consume user quota and are recorded as failed`
18. `Super Admin overrides user quota with documented reason and audit record`
19. `Admin suspends user, immediately revoking active sessions and blocking API access`
20. `Protection of Last Active Super Administrator` (Prevents deletion, suspension, or demotion)
21. `Webhook checkout event updates user subscription to Premium idempotently`
22. `Account deletion purges personal user records and revokes sessions`

---

## 🏃 Running the Application Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database & Seed Data**:
   ```bash
   npm run seed
   ```

3. **Start the Web Application**:
   ```bash
   npm start
   ```

4. **Access the Web Console**:
   - Web Application & User Portal: `http://localhost:3000`
   - Dedicated Admin Console: `http://localhost:3000#admin-login`
   - User Sign In: `http://localhost:3000#login`
   - Use the **Top Persona Quick Switcher** to seamlessly test any role with a single click!


## Build and local setup

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
cp .env.example .env
# Edit .env and replace every placeholder with unique local secrets.
npm run build
npm test
npm start
```

The health endpoint is available at `http://localhost:3000/health` by default.
The SQLite database is runtime state and is intentionally excluded from version
control. The first run initializes the database and seeds initial data according
to the application configuration. Never deploy the example credentials or
placeholder secrets to a public environment.

### Environment and secret handling

- `.env` is local-only and is ignored by Git.
- `.env.example` contains placeholders only; it must not contain real credentials.
- If any credential was previously committed, rotate it at its source. Removing a
  file from the latest snapshot does not erase it from older Git history.
- Use a managed secret store for production deployments.

### Build validation

`npm run build` performs Node.js syntax validation of the server entry point.
It is a lightweight validation step, not a production bundling process.

## Continuous integration and container build

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that installs dependencies, runs the Node.js test suite, and validates the build on pushes and pull requests.

Build and run the production container with:

```bash
docker build -t nexusauth-platform .
docker run --rm -p 3000:3000 --env-file .env nexusauth-platform
```

For local test coverage using Node.js' built-in coverage instrumentation:

```bash
npm run test:coverage
```

The integration suite remains available separately as `npm run test:integration` because it exercises the seeded SQLite application through HTTP requests.

## Python application layer

NexusAuth also includes a stdlib-only Python application layer under `nexus_py/` with a CLI entry point in `main.py`. It can be run with:

```bash
python main.py health ok
```

Python unit tests can be run with:

```bash
npm run test:python
```

The JavaScript and Python layers are intentionally independent so the existing HTTP platform remains compatible while the Python domain layer can be deployed or expanded independently.

## Configuration example

Copy `example.env` to `.env` for local development. The repository intentionally does not commit a live `.env` file.

## Python application services

The `app/` package contains production service modules for identity, authentication, authorization, tenancy, integrations, workflows, observability, billing, and operational concerns.
