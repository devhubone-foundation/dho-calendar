# Contributing

## Branching

- `main` must remain deployable.
- One active issue per programmer.
- Create branches from an updated `main`.
- Recommended branch name: `issue-<number>/<short-kebab-name>`.

## Issue execution

1. Assign the issue to one programmer.
2. Copy the issue's Sonnet handoff prompt into a fresh Claude Code session.
3. Ask Sonnet to plan first.
4. Review and approve the plan.
5. Let Sonnet implement and run automated checks.
6. Sonnet stops before commit.
7. Programmer follows the issue's manual test scenario.
8. Programmer reviews the diff.
9. After approval, instruct Sonnet to commit, push, and open a PR.
10. PR description includes `Closes #<issue-number>`.
11. Prefer review by the other programmer.
12. Squash merge after CI passes.

## Required PR quality

Every PR must include:

- linked issue;
- implementation summary;
- testing performed;
- manual test result;
- screenshots for meaningful UI changes;
- migrations/configuration notes;
- risks or limitations.

## Shared-file coordination

Before editing shared files such as root configuration, Prisma schema, shared contracts, design tokens, Compose, or CI:

- confirm the issue owns the change;
- check the parallel issue for overlap;
- keep changes minimal;
- communicate any unavoidable overlap before both branches diverge further.

## Merge strategy

Use squash merging. The squash commit should describe the completed issue, not individual implementation steps.
