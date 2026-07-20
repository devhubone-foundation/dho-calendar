# Testing Strategy

## Required checks

Every PR must pass the checks relevant to its scope:

- lint;
- TypeScript type checking;
- unit tests;
- backend integration tests with PostgreSQL when persistence/API behavior changes;
- production build;
- manual issue-specific verification.

## Unit-test priorities

Automated unit tests are expected for:

- schedule precedence;
- future-only default changes;
- attendance status resolution;
- no-confirmed-attendee warning logic;
- RRULE occurrence expansion and supported edit/delete scopes;
- authorization decisions;
- audit retention calculation;
- iframe message validation helpers where applicable.

## Backend integration-test priorities

Use an isolated PostgreSQL test database for:

- authentication and forced password change;
- refresh/session lifecycle;
- admin/member authorization;
- user deactivation;
- schedule and attendance persistence;
- event CRUD and recurrence exceptions;
- public calendar response filtering;
- audit creation and cleanup;
- upload metadata and replacement behavior where practical.

## UI testing policy

Small UI-only work may use manual verification. Business-critical UI flows must be covered by backend tests plus detailed manual scenarios. End-to-end browser automation is optional for Version 1 and should not delay the project unless the planner finds a high-value smoke test.

## Seed scenario

Development seed data should provide:

- one admin;
- at least two active members and one deactivated member;
- temporary credentials documented only for local development;
- Bulgarian and English qualifications;
- default office schedule Monday/Wednesday/Friday, 12:00–20:00;
- a member with a custom weekly schedule;
- confirmed, not-sure, and not-attending exceptions;
- a date with changed office hours;
- a closed date;
- a working date with no confirmed attendees;
- one-time, all-day, multi-day, and recurring events.

## Manual-test format required in issues

Each issue must list:

1. Preconditions and seed/account to use.
2. Commands to start the required services.
3. Exact navigation/actions.
4. Expected result after every meaningful action.
5. Permission checks for member/admin/public users.
6. Refresh/restart persistence checks where relevant.
7. WebSocket fallback or reconnect check where relevant.
8. A concise pass/fail checklist.

The scenario should be executable quickly and should not depend on a deployed environment.
