# Development Workflow

## Roles

- **Programmer A / Programmer B:** owns one active issue, reviews/tests agent output, and optionally reviews the other programmer's PR.
- **Planner Opus:** creates milestones and complete GitHub issues; does not implement.
- **Implementation Sonnet:** plans and implements one issue; does not commit until human approval.

## End-to-end issue lifecycle

1. Pull latest `main`.
2. Assign the next unblocked issue.
3. Create the issue branch.
4. Start a new Sonnet session from the repository root.
5. Paste the ready-to-copy prompt from the issue.
6. Sonnet reads sources of truth and presents a plan.
7. Programmer approves or corrects the plan.
8. Sonnet implements, tests, and reports completion without committing.
9. Programmer follows the manual test scenario exactly.
10. Programmer inspects changed files and local behavior.
11. Programmer requests fixes until accepted.
12. Programmer gives explicit authorization to commit/push/create PR.
13. Sonnet opens a PR with `Closes #N`.
14. CI runs.
15. Other programmer reviews when practical.
16. Squash merge.
17. Pull `main` before beginning the next dependent issue.

## Approval phrases

Implementation approval may be expressed as:

> The plan is approved. Implement the issue, run the tests, and stop before committing.

Commit/PR approval must be explicit:

> Approved. Commit the changes, push the issue branch, and create the pull request with `Closes #N`.

## Local-first rule

All implementation and testing is local until the final production-like deployment issue. Do not spend issue time configuring a real server or DNS.

## Failed manual test

When a manual step fails:

- do not authorize a commit;
- provide Sonnet the exact failing step, observed behavior, expected behavior, logs, and screenshot if relevant;
- ask it to diagnose, fix, rerun automated tests, and return to the completion checkpoint.

## PR conflict rule

If one parallel PR modifies a shared file needed by the other:

- merge the completed PR first;
- rebase or merge updated `main` into the second branch;
- ask Sonnet to resolve carefully and rerun all relevant checks;
- do not resolve by discarding either issue's required behavior.
