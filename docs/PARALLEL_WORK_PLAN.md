# Parallel Work Plan

## Objective

Two similarly experienced programmers work in parallel while minimizing merge conflicts. Each programmer owns only one active issue.

## Planned milestone shape

### Milestone 1 — Foundation

- **Issue 1 — Programmer A:** Monorepo, Docker, Prisma/PostgreSQL, shared contracts, CI, base NestJS/Next.js wiring.
- **Issue 2 — Programmer B:** Authenticated/public app shell, bilingual design system, DevHubOne visual tokens, member profiles and uploads, coordinated against Issue 1 interfaces.

Issue 1 should establish shared package and application skeletons immediately. Issue 2 may begin after the initial skeleton commit/PR is merged, or the planner may order a small foundation sub-step inside Issue 1 before both proceed. The planner must avoid pretending two branches can safely create the same root files independently.

### Milestone 2 — Core calendar

- **Issue 3 — Programmer A:** Office defaults/exceptions, personal weekly schedules, attendance exceptions, warnings.
- **Issue 4 — Programmer B:** Bilingual events, RRULE recurrence, occurrence edit/delete scopes, calendar views and day modal.

Expected ownership split:

- Issue 3 primarily owns office/attendance API modules and attendance/settings UI routes.
- Issue 4 primarily owns events API module and calendar/event UI routes.
- Shared public-calendar contracts must be coordinated explicitly.

### Milestone 3 — Integration and completion

- **Issue 5 — Programmer A:** Public aggregation, iframe behavior, WebSockets, audit history and cleanup.
- **Issue 6 — Programmer B:** Seed completeness, integration-test completion, production-like Docker/Nginx, final local acceptance and documentation fixes.

The planner may swap programmer assignments but must preserve independent vertical ownership.

## Dependency principles

- Issues are numbered in intended order.
- Parallel issues in a milestone declare which earlier issue/PR must be merged first.
- An issue must list shared files it may touch.
- The planner must identify likely conflict hotspots, especially Prisma schema, shared contracts, route navigation, Compose, and root scripts.
- Later issues must reuse established patterns rather than refactor foundations broadly.

## Fast-project constraint

The target is a small number of substantial issues, not a granular enterprise backlog. Each issue should be implementable and testable rapidly by Sonnet, while still yielding a coherent reviewable PR.
