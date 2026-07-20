# Claude Code Operating Rules

## 1. Required reading order

Before planning or implementing any work, read:

1. `PRODUCT_BLUEPRINT.md`
2. `ARCHITECTURE.md`
3. This file
4. `CONTRIBUTING.md`
5. The complete assigned GitHub issue
6. Relevant existing code and tests

Do not implement from the issue title alone.

## 2. Sources of truth

- Product behavior and scope: `PRODUCT_BLUEPRINT.md`
- Technical structure: `ARCHITECTURE.md`
- Agent procedure: `CLAUDE.md`
- Current task: assigned GitHub issue

Do not silently resolve contradictions. Stop and report the conflict before changing code.

## 3. Mandatory two-stage execution

### Stage A — plan only

Before modifying files, provide:

- understanding of the requested outcome;
- acceptance criteria in your own words;
- files/modules expected to change;
- implementation steps;
- testing approach;
- assumptions;
- risks, dependencies, and likely conflicts;
- any proposed nearby refactoring.

Then stop and wait for explicit approval.

### Stage B — implementation

After approval:

- implement the issue completely;
- freely refactor nearby code when it materially improves correctness or maintainability;
- avoid unrelated cleanup;
- preserve established repository conventions;
- add automated tests where required;
- run the relevant checks;
- do not commit, push, or create a PR.

## 4. Completion checkpoint

When implementation is complete, provide:

- concise summary of behavior implemented;
- changed files grouped by purpose;
- migrations and environment changes;
- commands run;
- automated test results;
- exact manual test steps copied or reconciled with the issue;
- known limitations or follow-up risks;
- proposed squash commit message;
- proposed PR title and description including `Closes #<issue>`.

Then stop. The programmer must pull/run/review/test the work.

Only after the programmer explicitly says words equivalent to:

> Approved. Commit, push, and create the pull request.

may you commit, push, and create the PR.

## 5. Git safety

- Work only on the issue branch.
- Never commit directly to `main`.
- Never rewrite shared history.
- Never merge your own PR.
- Do not close issues manually; use `Closes #<issue>` in the PR description.
- Preferred final history is one squash commit per issue.
- Do not include secrets, `.env`, runtime uploads, or database volumes.

## 6. Scope control

You may modify additional nearby files when necessary, but explain why in the completion report.

Do not:

- add unrequested product features;
- replace the chosen stack;
- introduce microservices or infrastructure not in the architecture;
- change public business rules without updating the blueprint first;
- weaken tests to make them pass;
- leave placeholders presented as completed work.

## 7. Quality requirements

- TypeScript strictness must be preserved.
- Validate external input with shared Zod contracts where applicable.
- Enforce authorization in the API.
- Use Prisma migrations for schema changes.
- Store dates and timestamps according to the architecture time rules.
- Keep user-visible text bilingual where required.
- Use design tokens/shared UI components.
- Add unit tests for business logic and backend integration tests for persistence/API behavior.
- Small presentational UI changes may rely on detailed manual testing.

## 8. Testing truthfulness

Never claim a command or test passed unless you ran it and observed success. Clearly identify checks that could not be run and why.

## 9. Planner-agent rules

When acting as the planner:

- do not implement code;
- create exactly three milestones and approximately six large vertical issues unless a real dependency requires adjustment;
- assign each issue to Programmer A or Programmer B;
- order issues and declare dependencies;
- ensure same-milestone parallel issues minimize file conflicts;
- include programmer context, acceptance criteria, automated-test expectations, fast manual test steps, expected ownership, and a ready-to-copy Sonnet handoff prompt;
- keep all work local-first until the final deployment issue;
- ensure each PR can use `Closes #<issue>`.
