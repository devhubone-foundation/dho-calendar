# DevHubOne Office Calendar — System Architecture

## Document status

- **Version:** 1.0
- **Status:** Approved implementation baseline
- **Product source of truth:** `PRODUCT_BLUEPRINT.md`
- **Primary audience:** Developers, Claude planning agents, Claude implementation agents, reviewers, and testers

## 1. Purpose

This document defines how the DevHubOne Office Calendar will be structured and implemented without changing the product behavior defined in `PRODUCT_BLUEPRINT.md`.

When documents conflict:

1. `PRODUCT_BLUEPRINT.md` wins for scope and user-visible behavior.
2. `ARCHITECTURE.md` wins for technical structure and implementation boundaries.
3. `CLAUDE.md` wins for agent operating procedure, but may not override product or architecture decisions.
4. Intentional changes must update the relevant source-of-truth document before implementation.

## 2. Architecture goals

The architecture must:

- remain small enough to implement quickly with Claude Code;
- be usable as a real DHO internal tool;
- support two programmers working in parallel;
- keep `main` deployable;
- provide a local-first workflow;
- run with PostgreSQL in Docker;
- support a fully containerized production-like setup;
- permit single-server deployment later;
- avoid unnecessary distributed-system complexity;
- keep frontend and backend contracts explicit and testable.

## 3. System overview

The system is a modular monorepo containing:

- one Next.js application for the public calendar and authenticated member/admin UI;
- one modular NestJS API;
- one PostgreSQL database;
- local filesystem storage for uploaded images;
- WebSocket-based live updates for public and authenticated calendar views;
- Nginx for the production-like deployment profile.

```text
Browser / iframe
      |
      | HTTPS / WebSocket
      v
    Nginx
    /   \
   v     v
Next.js  NestJS API
             |
             +---- PostgreSQL
             |
             +---- persistent upload directory
```

The initial system is one deployable application stack, not microservices.

## 4. Monorepo layout

```text
.
├── apps/
│   ├── web/                     # Next.js application
│   └── api/                     # NestJS application
├── packages/
│   ├── contracts/               # Shared Zod schemas and API/socket contracts
│   ├── database/                # Prisma schema, migrations, seed utilities
│   ├── ui/                      # Shared UI components and design tokens
│   ├── config/                  # Environment parsing and shared runtime config
│   ├── eslint-config/           # Shared lint configuration
│   └── typescript-config/       # Shared TypeScript configurations
├── docs/
│   ├── DEVELOPMENT_WORKFLOW.md
│   ├── TESTING_STRATEGY.md
│   ├── PARALLEL_WORK_PLAN.md
│   └── PLANNER_PROMPT.md
├── docker/
│   ├── nginx/
│   └── scripts/
├── data/                        # ignored runtime data for local non-volume use
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
├── PRODUCT_BLUEPRINT.md
├── ARCHITECTURE.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

The public calendar remains inside `apps/web`; there is no separate widget app.

## 5. Technology baseline

### 5.1 Runtime and tooling

- Node.js LTS
- TypeScript with strict mode
- pnpm workspaces
- Turborepo
- Docker and Docker Compose
- GitHub Issues, Pull Requests, and Actions

Exact dependency versions are locked in the repository. Agents must not introduce alternative frameworks without an approved architecture change.

### 5.2 Frontend

- Next.js App Router
- React
- Shared components from `packages/ui`
- Zod contracts from `packages/contracts`
- A calendar library may be selected during foundation implementation, provided it supports month, week, day, list/upcoming views, localization, recurring event occurrences, and custom rendering.
- WebSocket client for live invalidation/update events

### 5.3 Backend

- NestJS modular monolith
- REST API for commands and queries
- NestJS WebSocket gateway for live update notifications
- Prisma ORM
- PostgreSQL
- NestJS scheduler for audit cleanup
- Server-side image upload handling

### 5.4 Authentication

- Application-managed email/password accounts
- JWT access token
- Refresh token in an HTTP-only cookie
- Forced password change after initial login or admin reset
- Basic login rate limiting and temporary lockout
- Two roles: `MEMBER` and `ADMIN`
- `/admin` is the shared authenticated area; admin-only functions appear based on role

## 6. Frontend route model

```text
/                         Public calendar page and iframe target
/admin/login              Login
/admin                    Dashboard
/admin/calendar           Internal calendar
/admin/attendance         Personal weekly schedule and date exceptions
/admin/events             Event management
/admin/profile            Personal profile
/admin/members            Admin-only member management
/admin/settings           Admin-only office schedule settings
/admin/audit              Admin-only audit history
```

The route names may be refined without changing the separation of responsibilities.

## 7. Backend module boundaries

```text
auth
users
profiles
office-schedule
attendance
events
public-calendar
uploads
audit
realtime
health
```

### 7.1 Auth

Owns login, token refresh, logout, password change, temporary-password enforcement, login throttling, and authorization guards.

### 7.2 Users and profiles

Own account creation, role, active status, public profile fields, admin password reset, and member deactivation. Version 1 supports deactivation only, not deletion.

### 7.3 Office schedule

Owns default weekdays/hours and date-specific opening, closing, and changed-hours exceptions.

### 7.4 Attendance

Owns personal weekly schedules, date-specific overrides, status resolution, and the three-month calculated attendance view.

### 7.5 Events

Owns bilingual event data, one-time and recurring event definitions, recurrence exceptions, occurrence expansion, editing scopes, and deletion scopes.

### 7.6 Public calendar

Returns only intentionally public data and composes office schedule, member attendance, member public profiles, and events for requested date ranges.

### 7.7 Uploads

Validates, stores, replaces, and deletes profile pictures and event covers.

### 7.8 Audit

Records relevant actions and exposes the last seven days to admins. A daily scheduled job permanently removes expired audit records.

### 7.9 Realtime

Broadcasts domain-level update notifications. Clients re-fetch authoritative data after receiving a relevant notification; the socket is not the primary data store.

## 8. API style

REST is the authoritative command/query interface. WebSockets announce changes.

Recommended REST groups:

```text
/api/auth/*
/api/me/*
/api/users/*
/api/office-schedule/*
/api/attendance/*
/api/events/*
/api/public/calendar
/api/uploads/*
/api/audit
/api/health
```

Shared request, response, query, and socket payload schemas must be defined in `packages/contracts` with Zod. Frontend and backend should infer TypeScript types from the same schemas.

API errors must use a consistent shape, for example:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Human-readable message",
  "fieldErrors": {}
}
```

## 9. WebSocket architecture

Both public and authenticated calendar clients connect to the realtime gateway.

The server emits small invalidation events such as:

```text
office-schedule.changed
attendance.changed
event.changed
profile.changed
member-status.changed
```

Payloads should identify the affected date range or entity where practical. Clients invalidate and re-fetch the relevant REST query. The system must remain correct when WebSockets are unavailable; reconnecting restores freshness through a re-fetch.

No sensitive data is placed in public socket payloads.

## 10. Core time and recurrence rules

- Store timestamps in UTC.
- Interpret office schedules and calendar dates in the configured office timezone, initially `Europe/Sofia`.
- The UI displays dates/times in the office timezone.
- Recurring events use RRULE-compatible recurrence definitions.
- API queries expand recurring events for the requested range, capped to the supported horizon.
- Version 1 supports a forward horizon of three months.
- Internal calendar initially exposes the previous month plus the next three months.
- Public views focus on the current and future calendar range appropriate to the selected view.

Recurring edit/delete scopes:

- this occurrence;
- this and future occurrences;
- entire series.

Implementation may use recurrence exception records and split series where required. Agents must not silently rewrite historical occurrences.

## 11. Schedule and attendance resolution

Precedence from lowest to highest:

1. Office default weekly schedule
2. Date-specific office exception
3. Member personal weekly schedule
4. Member date-specific attendance exception

Additional rules:

- Date-specific exceptions always win within their domain.
- Schedule changes apply only to future dates.
- Historical behavior is not recalculated by later default changes.
- Confirmed attendance counts toward office coverage.
- `NOT_SURE` appears publicly with a distinct indicator but does not satisfy confirmed coverage.
- `NOT_ATTENDING` does not appear as a present person.
- A configured working day with no confirmed attendees triggers an admin warning and is not presented publicly as a normal open day.
- Events may still appear publicly on such a date.

The implementation should calculate effective attendance instead of pre-creating a database row for every member and date.

## 12. Suggested data model

Exact names may change during implementation, but the domain must include equivalents of:

- `User`
- `RefreshToken` or refresh-session record
- `MemberProfile`
- `OfficeScheduleDefault`
- `OfficeScheduleException`
- `MemberWeeklySchedule`
- `AttendanceException`
- `EventSeries`
- `EventRecurrenceException`
- `AuditLog`
- `UploadedFile` metadata, if useful

Important constraints:

- User email is unique.
- Users are deactivated, never deleted in Version 1.
- Public profile fields are explicit.
- Bilingual event and qualification fields are stored separately.
- Audit records may contain structured before/after snapshots but must avoid password/token data.
- Database migrations are committed and reviewed.

## 13. Upload architecture

Uploads are stored on the server filesystem and persisted through a Docker volume.

```text
/uploads/profiles/
/uploads/events/
```

Rules:

- Profile images: JPEG, PNG, WebP; maximum 5 MB.
- Event covers: JPEG, PNG, WebP; maximum 10 MB.
- Validate MIME type and file content where practical.
- Generate safe unique filenames; never trust client filenames as paths.
- Store only relative paths/metadata in PostgreSQL.
- Replace operations remove the old file only after the new file is safely stored and the database update succeeds.
- Deleted event covers are removed from storage.
- Protect against path traversal.
- Docker production-like mode uses a named upload volume.

## 14. Internationalization

Both public and authenticated interfaces support Bulgarian and English.

- Public URL accepts `lang=bg|en`.
- Public URL accepts `view=attendance|events` (PRODUCT_BLUEPRINT.md §15.1; v1.1 — previously `month|week|day|list`, now selects between the two public views only). Default `attendance`.
- The authenticated calendar's internal Month/Week/Day/Upcoming view state (§15.2) is separate client state, not this query parameter.
- Invalid values fall back to documented defaults.
- State is per visit and is not persisted in cookies or browser storage.
- Event title/description and member qualification are stored in Bulgarian and English.
- Static interface translations live in the frontend codebase.
- The language query parameter is the authoritative iframe integration mechanism.

## 15. Iframe integration

The public page must work standalone and inside an iframe.

Example:

```html
<iframe
  id="dho-calendar"
  src="https://calendar.devhubone.com/?lang=bg&view=attendance"
  width="100%"
  scrolling="no"
></iframe>
```

The iframe sends height updates through `window.parent.postMessage`. Messages must use a namespaced payload, for example:

```json
{
  "source": "dho-office-calendar",
  "type": "resize",
  "height": 1240
}
```

The parent site verifies the message shape and expected iframe origin before applying height. The calendar does not restrict which domains may embed it in Version 1.

## 16. Visual system

The application must match the established DevHubOne visual identity.

During the foundation issue, the assigned developer must inspect `devhubone.com` and record approved tokens in `packages/ui`, including:

- primary and secondary colors;
- backgrounds and surfaces;
- typography choices or closest licensed/web-safe equivalents;
- borders and radii;
- button and link treatment;
- responsive spacing conventions.

The resulting tokens become the application-level source of truth. Agents must use tokens/components rather than duplicating raw colors throughout features.

## 17. Docker and local development

`compose.yml` must support separate profiles.

### 17.1 Database-only profile

For fast development:

- PostgreSQL runs in Docker.
- Developers run `apps/web` and `apps/api` locally through pnpm/Turbo.

### 17.2 Full local profile

- PostgreSQL
- NestJS API
- Next.js web
- persistent uploads volume

Useful for parity and end-to-end manual verification.

### 17.3 Production-like profile

- Nginx
- Next.js
- NestJS
- PostgreSQL
- persistent database volume
- persistent uploads volume

No automated database backup is required for Version 1. Database and uploads must survive container recreation through named volumes.

### 17.4 Render deployment (V1 public hosting target)

Version 1's public deployment target is Render's free plan (GitHub issue #6), defined in `render.yaml` at the repo root. This is additive to, not a replacement for, the local-first workflow above.

- **One Render web service** running `Dockerfile.render` — the same single deployable stack behind Nginx described in §3 and §26, not two services. `docker/nginx/nginx.conf.template` is shared unmodified between this image and the local `prod` Compose profile.
- **One free managed Postgres**, wired via `DATABASE_URL` (`fromDatabase`).
- No cloud object storage is introduced (§25 remains in force): uploads stay on the container's local filesystem, which is **ephemeral on the free plan** (no persistent Disk) — documented in `docs/RENDER_DEPLOY.md`, not worked around.
- `APP_ORIGIN`/`API_ORIGIN` are set to the assigned `*.onrender.com` URL and `NEXT_PUBLIC_API_ORIGIN`/`NEXT_PUBLIC_WS_ORIGIN` are left unset, so the deployment stays single-origin — the existing `SameSite=lax` cookie auth and single-origin CORS (§19) require no changes.
- Migrations run automatically via `preDeployCommand`; the seed is run once manually via Render Shell, never automatically.
- Additional free-tier constraints (Postgres ~30-day expiry, cold starts after idling) are documented, not engineered around.

## 18. Environment configuration

Each app must validate environment variables at startup. Commit `.env.example`, never real secrets.

Expected categories include:

```text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
ACCESS_TOKEN_TTL
REFRESH_TOKEN_TTL
APP_ORIGIN
API_ORIGIN
NEXT_PUBLIC_API_ORIGIN
NEXT_PUBLIC_WS_ORIGIN
UPLOAD_ROOT
OFFICE_TIMEZONE
LOGIN_RATE_LIMIT_*
```

Production-like secrets must not use repository defaults.

## 19. Security baseline

- Passwords hashed with a modern password hashing function.
- Temporary passwords are never logged.
- Forced password change enforced server-side.
- Refresh tokens are revocable and not stored in plaintext if persisted.
- HTTP-only refresh cookie; secure in HTTPS deployments.
- Role authorization enforced by the API, not only by hidden UI.
- Login endpoint rate limited with temporary lockout.
- Upload paths and MIME types validated.
- Public endpoints return only public profile fields.
- Audit entries exclude credentials and tokens.
- Nginx applies sensible request-size limits and forwards WebSocket upgrades.

## 20. Audit architecture

Audit all actions listed in `PRODUCT_BLUEPRINT.md`, including event, attendance, office schedule, member, and profile changes.

Each record should include:

- actor user ID;
- action type;
- target type and ID;
- timestamp;
- safe structured metadata or before/after snapshot;
- request correlation ID when available.

Retention:

- queries never return records older than seven days;
- a daily NestJS scheduled job deletes expired records permanently;
- deleted domain entities remain represented by their audit record until expiration.

## 21. Testing architecture

Mandatory project checks:

- lint;
- TypeScript type checking;
- unit tests;
- backend integration tests against PostgreSQL;
- production builds;
- issue-specific manual testing.

Small UI-only issues may use manual verification instead of component tests. Core business rules must have automated tests.

Integration tests must use an isolated PostgreSQL test database, preferably through a dedicated Docker Compose test profile or disposable database schema.

Seed data must include:

- admin and member accounts;
- forced-password-change example;
- bilingual profiles;
- default and custom weekly schedules;
- attendance statuses;
- office exceptions;
- one-time, full-day, multi-day, and recurring events;
- examples that trigger and clear the no-confirmed-attendee warning.

See `docs/TESTING_STRATEGY.md`.

## 22. CI and merge requirements

GitHub Actions must run on pull requests and `main`:

- dependency installation with lockfile enforcement;
- lint;
- typecheck;
- unit tests;
- backend integration tests with PostgreSQL service;
- production builds.

PR descriptions must include `Closes #<issue-number>` so merging automatically closes the issue.

Preferred merge strategy: squash merge.

## 23. Parallel development constraints

Work is planned as six large vertical issues across three milestones. Each programmer has at most one active issue. Parallel issues in the same milestone must minimize overlapping ownership.

Shared foundation files should be stabilized in Milestone 1. Later vertical issues should own distinct modules and UI routes. Unavoidable shared changes must be explicitly called out in the issue before implementation.

See `docs/PARALLEL_WORK_PLAN.md`.

## 24. Agent execution rules

Implementation agents must:

1. Read `PRODUCT_BLUEPRINT.md`, `ARCHITECTURE.md`, `CLAUDE.md`, the assigned issue, and relevant existing code.
2. Present an implementation plan, expected files, assumptions, and risks.
3. Wait for explicit human approval before editing.
4. Implement and test locally.
5. Stop before committing.
6. Provide a completion report and the issue’s manual test procedure.
7. Wait for the programmer to review and test.
8. Commit, push, and create the PR only after the programmer explicitly authorizes it.

## 25. Deliberate exclusions

The architecture does not include:

- microservices;
- cloud object storage;
- Redis;
- message queues;
- Kubernetes;
- external auth providers;
- automatic public-holiday imports;
- email notifications;
- production database backups;
- mobile applications;
- analytics pipelines.

## 26. Architecture acceptance criteria

The architecture is considered implemented when:

- the monorepo follows the documented boundaries;
- both local Compose workflows work;
- the production-like Compose stack starts behind Nginx;
- database and uploads persist through container recreation;
- public and authenticated calendars update through WebSockets and remain functional without them;
- shared Zod contracts are used across frontend and backend;
- authentication and role enforcement work;
- recurrence and schedule precedence rules are covered by tests;
- CI prevents merging failing code;
- the six planned issues can be assigned in parallel according to the workflow documents.
