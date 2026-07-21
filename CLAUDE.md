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


## 10. Token-efficient operation

Use the smallest amount of context and output that still preserves correctness.

### Repository reading

* Read every required document, but do not quote, reproduce, or summarize it unless a conflict or task-relevant rule must be reported.
* When a required document was already read in the current uninterrupted session and has not changed, do not read it again.
* Inspect only code, tests, schemas, and configuration relevant to the assigned issue or directly affected dependencies.
* Start with targeted searches for symbols, routes, models, contracts, and tests. Do not recursively inspect unrelated directories.
* Do not print file contents merely to demonstrate that they were read.
* Use narrow file ranges and targeted searches instead of repeatedly loading complete large files.
* Do not inspect generated files, dependency directories, build output, lockfiles, or migrations unrelated to the task unless necessary.

### Communication style

* Be concise and information-dense.
* Do not narrate routine tool calls, searches, file reads, or obvious implementation actions.
* Do not repeat the issue description, repository rules, or information already stated in the current conversation.
* Do not provide tutorials or explain standard framework concepts unless requested.
* Do not print full source files, large diffs, complete command output, or passing test logs unless requested.
* For successful commands, report only the command and a one-line result.
* For failed commands, include only the relevant error lines and diagnosis.
* Prefer compact headings and bullets over long prose.

### Stage A output budget

The Stage A plan must be complete but compact:

* Target approximately 500–900 words.
* Summarize the outcome in no more than three bullets.
* Express acceptance criteria as a concise checklist without restating the issue verbatim.
* List expected files by module or directory when exact filenames are not yet known.
* Combine implementation steps that belong to the same vertical.
* Mention only assumptions, risks, dependencies, conflicts, and refactors that could materially affect implementation.
* Do not explain routine implementation details.
* Do not include code or pseudocode.
* Ask only questions explicitly required by a listed “Decision to confirm” or a genuine blocking contradiction.

### Stage B operation

* After approval, begin implementation without restating the approved plan.
* Keep progress updates to material discoveries, blockers, changed assumptions, or failed checks.
* Batch related edits and checks where practical.
* Do not repeatedly summarize completed work during implementation.
* Do not ask for confirmation on non-blocking implementation choices that follow existing conventions.

### Completion report budget

The completion report must be concise and avoid duplication:

* Target approximately 600–1,000 words, excluding manual test steps required verbatim by the issue.
* Describe behavior as a short checklist.
* Group changed files by purpose; do not describe every minor edit.
* Report commands in a compact table or one-line list with pass/fail status.
* Do not include full successful logs.
* Include error details only for checks that failed or could not run.
* Refer to unchanged issue acceptance criteria rather than repeating them.
* Include only real limitations and meaningful follow-up risks.
* Keep the proposed commit message to one line.
* Keep the PR description concise while still including scope, testing, and `Closes #<issue>`.

### Context preservation

Before reading or outputting information, check whether it is already available in:

1. the current conversation;
2. previously read files in the current session;
3. current tool results.

Do not retrieve or restate the same information twice unless it may have changed or is needed to resolve a contradiction.

Correctness, security, testing truthfulness, and issue completeness take priority over token reduction.

## 11. Subagent policy

Do not use subagents during Stage A.

During Stage B, do not use subagents for general repository exploration,
implementation, testing, or review.

A subagent may be used only when:

- the task is narrow and independent;
- using it avoids overloading the main context;
- its scope is limited to named files, directories, or one concrete question;
- it cannot spawn additional agents;
- it uses Haiku unless stronger reasoning is necessary;
- its result is limited to 10 concise bullets.

Before starting a subagent, state why it is materially more efficient than
working in the main context. Otherwise, continue directly.