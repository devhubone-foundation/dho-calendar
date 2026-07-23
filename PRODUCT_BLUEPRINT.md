# DevHubOne Office Calendar — Product Blueprint

## Document status

- **Document:** Product Blueprint
- **Version:** 1.3
- **Status:** Approved product source of truth
- **Product:** DevHubOne Office Calendar
- **Primary audience:** Product owner, developers, Claude Code planning agents, implementation agents, reviewers, and testers
- **Repository role:** This file is the authoritative product-level source of truth for the project
- **Change history:**
  - v1.3 (2026-07-22) — Reverses the closed-day attendance rule per §12.8/§13: confirmed (`Attending`) attendance on a date the base office schedule marks closed now opens the Hub publicly for that date, with hours derived from confirmed attendees' entered intervals; `Not sure` still never opens a closed date. Approved by the product owner alongside Issue #20.
  - v1.2 (2026-07-22) — Version 1 scope change per §33: the Attendance view (§15.1.1) remains non-interactive at the day level, but each individual attendee's stripe/row is now a tap/click/keyboard-operable control that opens a per-attendee details modal (§16). Addresses attendance-hour labels being clipped at narrow mobile widths. Approved by the product owner alongside Issue #17/#18.
  - v1.1 (2026-07-22) — Version 1 scope change per §33: the public calendar's view model is replaced by exactly two query-param-selected views (Attendance, Events); see §15.1. The authenticated calendar's four-view model (§15.2) is unchanged. Approved by the product owner alongside Issue #12.

---

## 1. Purpose of this document

This document defines what the DevHubOne Office Calendar is, who it serves, which behaviors are required, which behaviors are excluded, and how the product should behave from a user perspective.

All architecture plans, implementation issues, pull requests, tests, and AI-agent instructions must remain consistent with this document.

When another document or implementation decision conflicts with this file:

1. This Product Blueprint wins for product behavior and scope.
2. The architecture document wins only for technical implementation details that do not alter the product behavior defined here.
3. Any intentional product change must first be reflected in a new version of this file.

This document intentionally does not prescribe the final database schema, API design, monorepo layout, library selection, or deployment topology. Those decisions belong to the architecture phase.

---

## 2. Product summary

The DevHubOne Office Calendar is a small bilingual web application for managing and publicly displaying:

- the standard working days and opening hours of the DevHubOne office;
- date-specific opening-hour changes and office closures;
- which DevHubOne members plan to be present;
- each member's expected attendance hours and attendance status;
- public DevHubOne events such as workshops;
- public member information relevant to office visitors;
- internal warnings and an administrative audit history.

The product has two main surfaces:

1. **A public calendar**, available as a standalone page and embeddable into `devhubone.com` through an iframe.
2. **A private authenticated application**, used by DevHubOne members and administrators to manage attendance, schedules, profiles, users, and events.

The product must be useful as a real internal DevHubOne tool while also serving as a controlled test project for establishing a reliable Claude Code development workflow.

---

## 3. Product goals

### 3.1 Primary goals

The product must:

- give website visitors a clear view of when the DevHubOne office is open;
- show which members are expected to be present and during which hours;
- make public DevHubOne events prominent and easy to discover;
- allow members to maintain their own weekly attendance schedule and date-specific exceptions;
- allow all authenticated members to manage public events;
- allow administrators to manage office defaults, date-specific exceptions, users, and attendance;
- support Bulgarian and English on both public and private surfaces;
- integrate into the existing DevHubOne website through an iframe;
- remain simple enough to build as a learning project without becoming disposable.

### 3.2 Workflow goal

The project must also provide a safe environment for testing a structured AI-assisted development process based on:

- a stable source-of-truth document;
- a planned and ordered issue backlog;
- issues that contain complete implementation context;
- issues designed for parallel development with minimal conflicts;
- detailed manual testing instructions inside each issue;
- implementation by Claude Sonnet agents;
- mandatory human review and local testing before commits and pull requests;
- pull-request review by the second programmer before merge.

The detailed development workflow is not defined in this document and will be specified separately.

---

## 4. Non-goals for Version 1

The following are explicitly excluded from Version 1:

- email notifications;
- password-reset emails;
- email verification;
- Google Calendar synchronization;
- external calendar synchronization;
- meeting booking;
- visitor appointment booking;
- multiple office locations;
- mobile applications;
- attendance analytics;
- attendance reports;
- event approval workflows;
- draft events;
- private or internal-only events;
- automatic public-holiday synchronization;
- automatic closure on public holidays;
- event registrations;
- event participant capacity management;
- event organizer profiles;
- event categories;
- public user registration;
- social login;
- complex role or permission systems beyond Admin and Member;
- production deployment as a requirement for initial completion.

Features in this section must not be added implicitly while implementing Version 1.

---

## 5. Users and roles

## 5.1 Public visitor

A public visitor is any unauthenticated person viewing the public calendar directly or through the iframe embedded in `devhubone.com`.

A public visitor can:

- view the calendar without logging in;
- switch between supported calendar views;
- view office opening information;
- view public events;
- view confirmed and uncertain attendees;
- inspect a day through a details modal;
- view approved public member fields;
- use the calendar in Bulgarian or English.

A public visitor cannot:

- create or edit data;
- view private administrative information;
- view audit logs;
- see inactive users;
- access account email addresses beyond those intentionally exposed as public contact emails on member profiles.

## 5.2 Member

A Member is an active DevHubOne team member with an account created manually by an administrator.

A Member can:

- log in with email and password;
- change their temporary password;
- view the internal calendar;
- view the same calendar information available publicly;
- view internal warnings relevant to their own schedule where applicable;
- edit their own profile;
- manage their own default weekly attendance schedule;
- create date-specific attendance exceptions for themselves;
- choose an attendance state;
- create public events;
- edit any public event;
- delete any public event;
- manage recurring events through supported recurrence-editing scopes.

A Member cannot:

- create other user accounts;
- deactivate users;
- change another member's attendance;
- change global office working-day defaults;
- change global office opening-hour defaults;
- create global office date exceptions;
- view the audit history;
- change another user's profile unless the Member is also an Admin.

## 5.3 Admin

An Admin is also a Member and receives all Member capabilities.

Additionally, an Admin can:

- create member accounts manually;
- assign a temporary password when creating an account;
- edit any member account;
- deactivate and reactivate members;
- edit attendance for any member;
- manage default office working weekdays;
- manage default office opening hours;
- create, edit, and remove date-specific office schedule exceptions;
- close the office on specific dates;
- view warnings when upcoming office days have no confirmed attendees;
- view the audit history;
- manage all information available to normal members.

There are exactly two roles in Version 1:

- `MEMBER`
- `ADMIN`

No other role hierarchy is required.

---

## 6. Product surfaces and routes

## 6.1 Public calendar surface

The public calendar is available at:

- `https://calendar.devhubone.com`

It must work as:

- a complete standalone public page;
- an iframe-embedded calendar inside the separate `devhubone.com` website.

The public route must not require authentication.

## 6.2 Private application surface

The authenticated application starts at:

- `https://calendar.devhubone.com/admin`

Despite the `/admin` route name, both Members and Admins use this authenticated surface.

The application must show or hide management capabilities according to the authenticated user's role.

## 6.3 Repository boundary

The calendar application is maintained in its own repository.

The existing `devhubone.com` website is maintained separately and consumes the public calendar through an iframe.

---

## 7. Language requirements

## 7.1 Supported languages

Both the public calendar and authenticated application must support:

- Bulgarian (`bg`)
- English (`en`)

All application-controlled interface text must be translatable.

## 7.2 Public iframe language

The parent DevHubOne website selects the iframe language explicitly through a query parameter.

Examples:

```html
<iframe src="https://calendar.devhubone.com/?lang=bg"></iframe>
```

```html
<iframe src="https://calendar.devhubone.com/?lang=en"></iframe>
```

Required behavior:

- `lang=bg` opens the Bulgarian public calendar.
- `lang=en` opens the English public calendar.
- unsupported or missing language values must fall back to a documented default language.
- the selected language does not need to persist across visits.

## 7.3 Bilingual content fields

The following user-managed content must have separate Bulgarian and English values:

### Member profile

- qualification or role in Bulgarian;
- qualification or role in English.

### Event

- title in Bulgarian;
- title in English;
- description in Bulgarian;
- description in English.

The application must display the correct localized field according to the active language.

## 7.4 Non-persistent visitor preferences

The application does not need to remember the public visitor's selected:

- language;
- calendar view.

These selections may reset on a new visit or page load.

---

## 8. Visual identity

The public calendar and authenticated application must visually align with the current `devhubone.com` website.

The application must reuse or closely reproduce:

- the DevHubOne color palette;
- typography style;
- spacing and layout character;
- border-radius style;
- button style;
- card and panel style;
- visual hierarchy;
- overall friendly, modern, education-and-technology-focused identity.

The application must not look like an unrelated generic administration template.

Exact design tokens, color values, fonts, reusable components, and responsive rules must be documented during the architecture/design-system phase after inspecting the live DevHubOne website. Guessed colors must not be treated as authoritative.

Accessibility and readability take priority where an exact visual copy would cause poor contrast or usability.

---

## 9. Office model

## 9.1 Location scope

Version 1 supports exactly one DevHubOne office location.

The location is a single global resource rather than a user-selectable entity.

## 9.2 Default office schedule

The initial default office working schedule is:

| Weekday | Open | Working hours |
|---|---:|---|
| Monday | Yes | 12:00–20:00 |
| Tuesday | No | — |
| Wednesday | Yes | 12:00–20:00 |
| Thursday | No | — |
| Friday | Yes | 12:00–20:00 |
| Saturday | No | — |
| Sunday | No | — |

These values are initial defaults only and must be editable by an Admin.

An Admin must be able to change:

- which weekdays are normally working days;
- the default opening time for each working weekday;
- the default closing time for each working weekday.

The product must not hard-code Monday, Wednesday, and Friday as permanent business rules.

## 9.3 Date-specific office exceptions

An Admin can override the default office schedule for a specific calendar date.

A date-specific exception can:

- mark the office as closed;
- mark an otherwise non-working day as open;
- change the opening time;
- change the closing time.

Date-specific rules override weekly defaults for that date only.

## 9.4 Public holidays

Public holidays have no automatic behavior in Version 1.

A public holiday is open or closed only according to:

- the default weekly schedule; or
- an explicit Admin-created date exception.

The system must not assume that a public holiday is closed.

## 9.5 Effective office state

For any date, the system must be able to determine:

- whether the date is scheduled as an office working day;
- the effective opening and closing times;
- whether a date-specific exception changed the default;
- whether at least one member has confirmed attendance;
- whether the date should appear publicly as an open office day.

---

## 10. Member profiles

## 10.1 Required profile fields

Every member profile contains:

- full name;
- profile picture;
- login/contact email;
- qualification or role in Bulgarian;
- qualification or role in English;
- account role;
- active/inactive state.

Qualifications are free-text fields, not predefined categories.

Examples include:

- Programmer
- Game Designer
- 3D Artist
- Programmer and Technical Co-founder

## 10.2 Public member fields

The following fields are visible in the public calendar:

- full name;
- profile picture;
- qualification or role in the selected language;
- email address for contact.

The UI must make it clear that the email is a contact method.

## 10.3 Member-managed profile fields

Members can edit their own:

- full name;
- profile picture;
- email address;
- Bulgarian qualification text;
- English qualification text.

Changing an email address may affect login credentials depending on the selected authentication architecture. The implementation must preserve account access and data consistency.

## 10.4 Inactive members

An Admin can mark a member as inactive.

An inactive member:

- cannot log in unless reactivated;
- must not receive future default attendance;
- must not appear as a future attendee;
- must not appear in public member attendance lists;
- retains historical audit information;
- may retain historical event authorship and historical attendance references internally.

Deactivation is preferred over destructive user deletion.

---

## 11. Authentication and account lifecycle

## 11.1 Authentication method

Version 1 uses application-managed email and password authentication.

The product does not require:

- public sign-up;
- email verification;
- password-reset email flows;
- social login;
- external identity providers.

## 11.2 Account creation

Only an Admin can create an account.

During creation, the Admin provides:

- required member profile fields;
- role;
- temporary password.

The temporary password must not be permanently visible after account creation.

## 11.3 First-login password change

A newly created member must be able to change the temporary password after logging in.

The architecture phase must decide whether the password change is:

- mandatory before normal application usage; or
- strongly prompted but not blocking.

The final behavior must be explicitly documented before implementation.

## 11.4 Password security

Passwords must never be stored or logged in plain text.

Detailed authentication and security requirements belong to the architecture document, but no technical decision may weaken this rule.

---

## 12. Attendance model

## 12.1 Attendance purpose

Attendance communicates when a member expects to be physically present at the DevHubOne office.

Attendance is not:

- employee time tracking;
- payroll data;
- proof of work;
- visitor booking;
- legal presence tracking.

## 12.2 Attendance statuses

Version 1 supports exactly these attendance statuses:

- **Attending** — confirmed presence;
- **Not attending** — confirmed absence;
- **Not sure** — possible presence, not confirmed.

A stored attendance entry is not automatically equivalent to confirmed attendance. Confirmation depends on its status.

## 12.3 Public display of statuses

Public behavior:

- `Attending` members appear as confirmed attendees.
- `Not sure` members appear publicly with a visually distinct uncertain indicator.
- `Not attending` members do not appear as attendees.

The uncertain indicator must not be visually confused with confirmed attendance.

## 12.4 Personal default weekly schedule

Every active member has a personal weekly attendance schedule.

On initial account creation, the member's personal schedule inherits the current office default schedule unless the Admin explicitly configures otherwise.

With the initial product defaults, a newly created member is scheduled as attending:

- Monday, 12:00–20:00;
- Wednesday, 12:00–20:00;
- Friday, 12:00–20:00.

Members can later change their own personal weekly schedule.

A personal weekly schedule can define for each weekday:

- no default attendance; or
- default attendance start and end time.

The personal schedule is independent from the office schedule, but public display must respect whether the office is effectively open.

## 12.5 Default attendance interpretation

The product should calculate expected attendance from recurring personal schedules rather than requiring administrators to manually create a permanent database row for every future date.

Implementation details may vary, but product behavior must be equivalent to:

- a member is expected to attend according to their active personal weekly schedule;
- date-specific exceptions override the recurring personal schedule;
- inactive members do not generate future expected attendance;
- office closures suppress public open-office presentation.

## 12.6 Date-specific attendance exceptions

A Member can create or update an exception for their own attendance on a specific date.

An Admin can create or update an exception for any member.

A date-specific exception may:

- change the attendance status;
- change the attendance start time;
- change the attendance end time;
- add attendance on a day not included in the personal weekly schedule;
- remove attendance from a normally scheduled day.

The exception applies only to the selected date and must not change future weekly defaults.

## 12.7 Attendance validation

The product must prevent invalid attendance intervals, including:

- missing required times for an attending state;
- end time earlier than or equal to start time;
- malformed dates or times.

If attendance falls partly or fully outside effective office opening hours, the system must handle it explicitly rather than silently corrupting data. The architecture/product-design phase must choose one of these policies before implementation:

- prevent the out-of-hours interval;
- allow it with a clear warning;
- clamp public display to office hours while retaining the entered interval.

No implementation issue may invent this behavior without documenting the decision.

## 12.8 Attendance and closed days

Members may still have a recurring personal schedule or saved exception on a date when the base office schedule is closed.

- Confirmed (`Attending`) attendance on such a date makes that date effectively open for public display: the member counts toward an open-office day, and the public calendar shows the Hub as open, with public office hours derived from confirmed attendees' entered intervals (§13).
- `Not sure` attendance never overrides a closed date — it still does not count toward opening it.
- The authenticated UI must confirm this to the member (that their confirmed attendance opens the Hub for a date the base schedule marks closed) rather than warn that the attendance won't count.

---

## 13. Public open-day rule

A date appears publicly as an open office day when either condition is true:

1. the effective office schedule marks the office as open **and** at least one active member has `Attending` status for that date; or
2. the effective office schedule marks the office as closed **and** at least one active member has `Attending` status for that date (§12.8 override) — public office hours for such a date are the confirmed attendees' entered interval(s) (the min-start/max-end span across all confirmed attendees for that date, when there is more than one).

A member with `Not sure` status does not satisfy the confirmed-attendee requirement in either case, and never opens a closed date.

Therefore:

- open office + confirmed attendee → show as an open office day;
- open office + only uncertain attendees → do not show as a normal open office day;
- open office + no attendees → do not show as a normal open office day;
- closed office + confirmed attendee → confirmed attendance overrides the closure; show as an open office day with hours derived from the confirmed attendees;
- closed office + only uncertain attendees → do not show as an open office day;
- an event on such a date may still appear publicly according to the event rules.

This distinction is essential: hiding an office working day from the public open-office presentation must not automatically hide a public event occurring on that date.

---

## 14. Events

## 14.1 Event purpose

Events represent public DevHubOne activities such as:

- workshops;
- presentations;
- community sessions;
- Game Jams;
- open days;
- other public DHO activities.

Events are visually more prominent than ordinary attendance information.

## 14.2 Event fields

Every event contains:

- title in Bulgarian;
- title in English;
- description in Bulgarian;
- description in English;
- start date and time;
- end date and time;
- optional or required cover image, as finalized in UI requirements;
- location;
- recurrence configuration when recurring.

Before implementation, the architecture or issue specification must explicitly decide whether the cover image is mandatory or optional. The product must support a cover image field either way.

## 14.3 Event durations

Events may be:

- shorter than one day;
- several hours long;
- full-day;
- multiple consecutive days;
- recurring.

The calendar must represent events correctly across date boundaries.

## 14.4 Publication model

All saved events are public immediately.

Version 1 has no:

- drafts;
- approval process;
- private events;
- unlisted events;
- delayed publication scheduling.

The event form must make the immediate-publication behavior clear.

## 14.5 Event permissions

Every active authenticated Member or Admin can:

- create events;
- edit all events, regardless of creator;
- delete all events, regardless of creator.

This is an intentional collaborative permission model.

The system must record the acting user in the audit log.

## 14.6 Event deletion

Deleting an event removes it from active calendar views.

The deletion action must remain represented in audit history for the configured retention period.

The product may use soft deletion or audited hard deletion internally, provided the required public and audit behavior is preserved.

## 14.7 Recurring events

Recurring events are required in Version 1.

The user must be able to create a recurrence rule suitable for common office event patterns.

At minimum, recurring events must support patterns needed for examples such as:

- every week on a selected weekday;
- repeated events with a defined end condition.

The precise recurrence options will be finalized in the architecture and UX specification.

## 14.8 Editing recurring events

When editing or deleting an occurrence in a recurring series, the user must be able to select one of these scopes:

- only this occurrence;
- this and future occurrences;
- the entire series.

The implementation must preserve past occurrences correctly when `this and future occurrences` is selected.

## 14.9 Events and office availability

Events are independent from ordinary office open-day visibility.

An event may appear publicly even when:

- the office is otherwise closed;
- there are no confirmed attending members;
- the date is not a default working day.

The event's location field communicates where it occurs. The product must not infer that every event takes place inside the office.

## 14.10 Event conflicts

Version 1 does not require automatic prevention of overlapping events.

Multiple events may exist at the same time.

The UI must still display them clearly.

---

## 15. Calendar views

### 15.1 Public calendar views (Version 1.1)

The public calendar (§6.1) supports exactly **two** views, selected only through the `view` query parameter. No visible view-switching control is shown on the public calendar; a visitor cannot switch views by clicking a button.

Invalid or missing `view` values fall back to `attendance`.

#### 15.1.1 Attendance view (`view=attendance`, default)

- Shows exactly the next 7 calendar days starting from today (a rolling window). It never shows past days and has no navigation controls — there is nothing to page through.
- For each of the 7 days, every member with `Attending` or `Not sure` status for that day is listed with their profile picture and a time-positioned attendance-hours indicator spanning their expected start/end time. `Not sure` members remain visually distinct from confirmed members (§12.3); this is unconditional and applies even though the view is otherwise attendance-only.
- A day with the office effectively closed shows "Office closed" (bilingual).
- A day with the office effectively open but no confirmed or uncertain attendees shows "Rest day" (EN "Rest Day", BG "Почивка") instead of an empty list.
- Date-specific changed office hours remain visually distinguished (§17).
- No events are shown in this view.
- Days themselves are not clickable and no day-details modal (§16) opens from this view — there is no per-day modal listing all of a day's attendees and events together, which remains the view's non-interactive purpose. However, each individual attendee's stripe/row is a tap/click/keyboard-operable control that opens a smaller per-attendee modal (§16) with that attendee's own details — added so mobile widths, where the shared hour axis and inline time labels are visually constrained (§17), have a reliable way to read full attendance details for one person.

#### 15.1.2 Events view (`view=events`)

- A Month calendar grid, navigated only by previous/next-month icon controls (not a view switcher).
- Shows only public events. Office open/closed state and attendance are not shown in this view.
- Clicking or activating a day opens the day-details modal (§16) for that date, showing that date's events. The modal does not include office/attendance information in this view.

### 15.2 Authenticated calendar views

The authenticated calendar (§6.2, §18) is unaffected by §15.1 and continues to support all of the following views, switched using visible controls:

- Month
- Week
- Day
- Upcoming/List

#### 15.2.1 Month view

The Month view must provide a compact overview of:

- public events;
- public open-office days;
- closed or changed days when relevant;
- attendance summaries;
- dates with uncertain attendance where appropriate.

It must remain readable inside the iframe.

#### 15.2.2 Week view

The Week view must show time-based detail for:

- office opening hours;
- member attendance intervals;
- events and their durations.

#### 15.2.3 Day view

The Day view must provide detailed chronological information for one selected date.

#### 15.2.4 Upcoming/List view

The Upcoming/List view must prioritize future public events and office availability in chronological order.

The exact grouping and range are UX decisions, but the view must be useful on narrow iframe widths.

#### 15.2.5 View state

The selected view does not need to persist across visits.

A default view must be selected during UX design and documented before implementation.

---

## 16. Day details modal

Clicking or activating a date must open a modal containing relevant information for that day. This applies to the public calendar's Events view (§15.1.2) and to the authenticated calendar (§15.2). It does not apply to the public calendar's Attendance view (§15.1.1): days there remain non-clickable and no day-level modal opens.

The modal may include:

- effective office open/closed state;
- effective opening and closing times;
- indication that working hours were changed for that date;
- confirmed attendees;
- uncertain attendees with a different indicator;
- each visible member's profile picture;
- each visible member's name;
- localized qualification;
- contact email;
- attendance start and end time;
- all events occurring on that date;
- event timing;
- event location;
- event cover image;
- event description in the active language.

The modal must be keyboard-accessible and usable within an iframe.

### 16.1 Per-attendee modal (Attendance view only)

The Attendance view (§15.1.1) does not use the day-details modal above. Instead, activating one attendee's stripe/row opens a smaller modal scoped to that one attendee for that one date, containing:

- the attendee's profile picture;
- the attendee's name;
- localized qualification;
- contact email;
- attendance start and end time for that date;
- the uncertain indicator when the attendee's status is `Not sure` (§12.3).

It never lists other attendees, office state, or events. Like the day-details modal, it must be keyboard-accessible and usable within an iframe.

---

## 17. Public calendar display rules

The public calendar must clearly distinguish:

- normal open-office days;
- days with date-specific changed working hours;
- office-closed dates when showing them is contextually useful;
- days with events;
- confirmed attendees;
- uncertain attendees;
- dates that are not publicly presented as open because nobody is confirmed.

Events must be visually prioritized over normal attendance markers.

The public calendar must not expose:

- audit history;
- administrative warnings;
- inactive members;
- password or account-management information;
- internal user identifiers;
- private system metadata.

---

## 18. Authenticated calendar

Both Members and Admins must have access to a calendar inside the authenticated application.

The internal calendar should allow users to:

- review public information;
- inspect their own attendance defaults and exceptions;
- identify schedule conflicts;
- navigate to allowed management actions;
- see information needed to keep the public calendar accurate.

Admin-only controls must be clearly separated or permission-protected.

The product must not rely only on hiding buttons. Unauthorized operations must be rejected by the backend.

---

## 19. Admin dashboard warnings

## 19.1 Required warning

The Admin dashboard must warn about an upcoming effective office working day when no active member has confirmed `Attending` status.

The following do not count as confirmed coverage:

- no attendance record;
- only `Not sure` attendees;
- only `Not attending` statuses;
- only inactive users;
- attendance on a closed date.

## 19.2 Warning behavior

The warning must:

- appear inside the authenticated Admin dashboard;
- identify the affected date;
- make the reason understandable;
- provide a useful path to inspect or fix attendance or office schedule data.

No email or external notification is required.

## 19.3 Warning time horizon

The exact number of upcoming days scanned for warnings must be defined during architecture or issue planning.

It must be configurable or easy to change and must not be buried as an unexplained magic number.

## 19.4 Public consequence

An affected date must not appear publicly as a normal open office day.

An event on that date remains publicly visible.

---

## 20. Audit history

## 20.1 Access

Only Admins can view the audit history.

## 20.2 Audited actions

The audit history must record at least:

- member account creation;
- member account editing;
- member activation or deactivation;
- member profile changes;
- role changes;
- personal weekly attendance schedule changes;
- date-specific attendance creation;
- date-specific attendance editing;
- date-specific attendance deletion or removal;
- Admin changes to another user's attendance;
- default office weekday changes;
- default office-hour changes;
- date-specific office exception creation;
- date-specific office exception editing;
- date-specific office exception deletion;
- office closure changes;
- event creation;
- event editing;
- recurring-event scope operations;
- event deletion;
- password-related administrative actions where safe to log, excluding secrets.

## 20.3 Audit entry information

An audit entry should identify:

- when the action happened;
- which authenticated user performed it;
- the type of action;
- the affected entity type;
- the affected entity reference;
- enough before/after or summary information to understand the change without storing secrets.

## 20.4 Retention

Audit records are retained for **one week**.

The retention period is seven days from the audit entry creation time.

Audit entries older than the retention period must be automatically removed by a scheduled cleanup mechanism.

The application must not promise permanent historical recovery after this retention period.

## 20.5 Deleted data and audit history

When an event or attendance record is deleted:

- it disappears from active product views;
- the deletion remains visible in the audit history until its audit entry expires;
- audit cleanup after seven days may permanently remove the final retained audit description.

Passwords, password hashes, tokens, and other secrets must never be stored in audit payloads.

---

## 21. Iframe integration

## 21.1 Basic embed

The existing DevHubOne website embeds the public calendar through an iframe.

Example:

```html
<iframe
  src="https://calendar.devhubone.com/?lang=bg"
  title="DevHubOne office calendar"
></iframe>
```

## 21.2 Automatic height resizing

The iframe must automatically resize its height to fit the embedded calendar content.

A fixed-height-only integration is not acceptable as the final Version 1 behavior.

The likely integration uses cross-window messaging between:

- the calendar iframe; and
- a small parent-page script on `devhubone.com`.

The architecture phase must define:

- message format;
- allowed origins;
- resize timing;
- handling of view changes;
- handling of modal content;
- responsive minimum and maximum sizes;
- fallback behavior when JavaScript communication is unavailable.

Security checks must prevent accepting resize or control messages from arbitrary origins.

## 21.3 Responsive behavior

The public calendar must work at common iframe widths, including mobile layouts of the parent website.

The embedded page must avoid unnecessary nested scrolling.

---

## 22. Images

The product supports:

- member profile pictures;
- event cover images.

The architecture phase must define:

- upload limits;
- accepted formats;
- maximum file size;
- resizing and compression;
- storage location;
- deletion behavior;
- fallback images;
- security validation.

From a product perspective:

- broken images must not break the calendar layout;
- a member without a valid image must receive a clear fallback avatar;
- an event without a cover, if covers are optional, must receive a visually acceptable fallback presentation.

---

## 23. Time and date behavior

The application is initially for the DevHubOne office in Sofia, Bulgaria.

All product-visible office schedules, attendance times, and event times must be interpreted consistently in the configured office timezone.

The architecture must explicitly define timezone storage and conversion behavior.

The UI must avoid ambiguous dates and times.

Overnight intervals are not required unless explicitly added later. If the architecture allows them, they must be tested carefully.

---

## 24. Core business rules

The following rules are authoritative:

1. The system supports one office location.
2. The initial office defaults are Monday, Wednesday, and Friday from 12:00 to 20:00.
3. Admins can change weekly office defaults.
4. Admins can override or close specific dates.
5. Public holidays do not automatically close the office.
6. Every active member has a personal default weekly attendance schedule.
7. A new member initially inherits the office default schedule.
8. Members can modify their own personal weekly schedule.
9. Date-specific attendance exceptions override personal weekly defaults for one date.
10. Members can edit only their own attendance.
11. Admins can edit attendance for everyone.
12. Attendance statuses are Attending, Not attending, and Not sure.
13. Not sure appears publicly with a distinct indicator.
14. Not sure does not count as confirmed office coverage.
15. A normal public open-office day requires an effective open schedule and at least one confirmed attendee.
16. A day with no confirmed attendee is warned about in the Admin dashboard.
17. A day with no confirmed attendee is not shown publicly as a normal open-office day.
18. Public events may still appear on closed or uncovered days.
19. All active Members and Admins can create, edit, and delete all events.
20. Saved events are immediately public.
21. Events support hourly, full-day, multi-day, and recurring durations.
22. Recurring event operations support one occurrence, this and future occurrences, and entire series.
23. Member qualification and event title/description are bilingual.
24. Public member information includes name, profile picture, qualification, and email.
25. Admins manually create accounts and assign temporary passwords.
26. Members can edit their own profile.
27. Admins can deactivate members.
28. Audit history is Admin-only.
29. Audit retention is seven days.
30. The public calendar is embeddable by iframe and automatically resizes.
31. The public calendar supports exactly two query-param-selected views — Attendance (rolling next-7-days, attendance-only, days non-clickable with no day-level modal, but individual attendee stripes open a per-attendee modal per §16.1) and Events (month grid, events-only, clickable) — with no view-switch buttons; the authenticated calendar supports Month, Week, Day, and Upcoming/List views with visible switch controls.
32. Clicking a date opens a details modal (except the Attendance view, whose days stay non-clickable); clicking an attendee's stripe in the Attendance view opens that attendee's own modal.
33. Events are visually more prominent than attendance information.
34. Bulgarian and English are supported on public and authenticated surfaces.

---

## 25. Main user workflows

## 25.1 Admin creates a member

1. Admin logs in.
2. Admin opens user management.
3. Admin enters the member's profile information.
4. Admin selects Member or Admin role.
5. Admin assigns a temporary password.
6. The system creates the active account.
7. The new member receives an initial personal attendance schedule based on current office defaults.
8. The action appears in audit history.
9. The Admin communicates credentials outside the application's email system.

## 25.2 Member changes their weekly schedule

1. Member logs in.
2. Member opens personal attendance defaults.
3. Member changes selected weekdays and/or hours.
4. The system validates the schedule.
5. The new defaults affect future calculated attendance.
6. Existing date-specific exceptions remain authoritative for their dates.
7. The action appears in audit history.

## 25.3 Member marks a date as unavailable

1. Member opens the internal calendar.
2. Member selects a date where they would normally attend.
3. Member selects `Not attending`.
4. The system saves a date-specific exception.
5. Future weekly defaults remain unchanged.
6. Public attendance updates accordingly.
7. If nobody remains confirmed for an open day, the Admin warning appears and the day stops appearing publicly as a normal open day.
8. The action appears in audit history.

## 25.4 Member marks uncertain attendance

1. Member selects a date.
2. Member chooses `Not sure` and provides valid hours if required by the final UX.
3. The public calendar shows the member with an uncertain indicator.
4. The member does not count as confirmed coverage.
5. The action appears in audit history.

## 25.5 Admin changes office hours for one date

1. Admin opens office schedule management.
2. Admin selects a date.
3. Admin changes opening and closing times or marks the office closed.
4. The override applies only to that date.
5. The public and internal calendars update.
6. Conflicts with member attendance are made visible internally.
7. The action appears in audit history.

## 25.6 Member creates an event

1. Member opens event creation.
2. Member provides Bulgarian and English title and description.
3. Member provides start and end information.
4. Member provides location.
5. Member uploads or selects a cover image according to final image requirements.
6. Member optionally configures recurrence.
7. The system validates the event.
8. The event becomes public immediately.
9. The action appears in audit history.

## 25.7 User edits a recurring event

1. Member or Admin selects an occurrence.
2. User edits the event.
3. The system asks for scope:
   - only this occurrence;
   - this and future occurrences;
   - entire series.
4. The system applies the selected operation.
5. Calendar instances update consistently.
6. The action and scope appear in audit history.

## 25.8 Admin responds to an uncovered office day

1. Admin dashboard shows an upcoming working day with no confirmed attendees.
2. Admin opens the affected date.
3. Admin reviews uncertain or absent members.
4. Admin may change office schedule, update attendance with proper authority, or coordinate outside the application.
5. When a confirmed attendee exists or the office is closed, the warning resolves.

## 25.9 Public visitor uses the iframe

1. Visitor opens an English or Bulgarian page on `devhubone.com`.
2. The parent page loads the iframe with the matching `lang` query parameter.
3. The calendar loads without authentication.
4. The iframe reports its required height.
5. The parent page adjusts the iframe height.
6. The visitor changes calendar views.
7. Height updates when content size changes.
8. The visitor selects a date and views the details modal.

---

## 26. Error and empty states

The product must define usable states for at least:

- no upcoming events;
- no confirmed attendees on a date;
- only uncertain attendees;
- office closed;
- no public office days in the current range;
- missing member profile image;
- missing event cover image where allowed;
- failed image upload;
- invalid login;
- inactive account login attempt;
- expired or invalid session;
- unauthorized action;
- failed data load;
- failed save;
- stale edit or concurrent update;
- invalid recurrence configuration;
- iframe resize communication failure.

Errors must be understandable in the active language and must not expose server internals.

---

## 27. Concurrency and collaborative editing expectations

Because all authenticated users can edit all events, the application must handle the possibility that two people edit the same event.

Version 1 does not require real-time collaborative editing.

However, the architecture must provide a reasonable approach to prevent silent data loss, such as:

- optimistic concurrency checks;
- updated-at conflict detection;
- clear last-write behavior with warning;
- another documented strategy.

The chosen behavior must be covered by issue-level tests.

---

## 28. Privacy and security expectations

Although this is a small project, it contains accounts and publicly displayed personal information.

The product must ensure:

- only intended profile fields are public;
- passwords and password hashes are never exposed;
- protected routes require authentication;
- backend permissions enforce role rules;
- image uploads are validated;
- audit logs exclude secrets;
- iframe messaging checks allowed origins;
- account deactivation removes access;
- public endpoints do not leak internal metadata.

Members must understand that their name, photo, qualification, and email are publicly visible.

The architecture phase must decide how this consent or expectation is communicated.

---

## 29. Version 1 success criteria

Version 1 is successful when all of the following are true:

1. The project runs locally through the documented Docker-based development setup.
2. A local PostgreSQL database can be started through Docker Compose.
3. An Admin can log in.
4. An Admin can create a Member with a temporary password.
5. The Member can log in and change the password.
6. Both roles can edit their own profiles.
7. Public profile information appears in both languages.
8. Admins can change weekly office defaults.
9. Admins can create date-specific office changes and closures.
10. Members can change personal weekly attendance defaults.
11. Members can create date-specific attendance exceptions.
12. Admins can edit any member's attendance.
13. Confirmed and uncertain attendance are displayed differently.
14. An uncovered working day produces an Admin dashboard warning.
15. An uncovered working day is not shown publicly as a normal open day.
16. Both roles can create an event.
17. Both roles can edit and delete any event.
18. Events support bilingual content.
19. Events support hourly, full-day, multi-day, and recurring cases.
20. Recurring edits support all three required scopes.
21. Events remain visible even when the office is otherwise closed.
22. The public calendar's Attendance view (`?view=attendance`, default) and Events view (`?view=events`) both work; the authenticated calendar's Month, Week, Day, and Upcoming/List views work.
23. Date selection opens the required modal.
24. The iframe receives the selected language.
25. The iframe automatically resizes.
26. The application visually matches the established DevHubOne identity.
27. Audit history captures required actions.
28. Audit data older than seven days is removed automatically.
29. Unauthorized actions are rejected by the backend.
30. The product passes the issue-level manual test scenarios defined during planning.

---

## 30. Product acceptance scenarios

These scenarios are high-level product acceptance requirements. Detailed test cases will be added to implementation issues.

### Scenario A — Default member attendance

Given the office defaults are Monday, Wednesday, and Friday from 12:00 to 20:00, when an Admin creates a new active member, then that member is treated as attending during those hours unless their personal schedule or a date exception changes the result.

### Scenario B — Personal schedule change

Given a member changes their Wednesday default to 14:00–18:00, then future Wednesdays use 14:00–18:00 for that member, while Monday and Friday remain unchanged.

### Scenario C — Date-specific absence

Given a member normally attends Friday, when they mark one Friday as Not attending, then only that Friday is changed.

### Scenario D — Uncertain attendance

Given a member is marked Not sure, then they appear publicly with an uncertain indicator but do not count as confirmed office coverage.

### Scenario E — No confirmed attendees

Given the office is scheduled open on a date but nobody is confirmed, then the Admin sees a warning and the public calendar does not show that date as a normal open office day.

### Scenario F — Event on uncovered day

Given no member is confirmed and the office day is hidden as a normal open day, when a public event exists on that date, then the event remains visible publicly.

### Scenario G — Date-specific closure

Given a normal Wednesday working day, when an Admin closes that specific date, then the public calendar shows no normal office opening for that date, without changing future Wednesdays.

### Scenario H — Event permissions

Given two different Members, when Member A creates an event, then Member B can edit or delete it, and the action is audited under Member B.

### Scenario I — Recurring event edit

Given a weekly recurring workshop, when a user edits one occurrence and selects `this and future`, then earlier occurrences remain unchanged and the selected occurrence plus future occurrences receive the change.

### Scenario J — Bilingual iframe

Given the iframe URL contains `lang=bg`, then Bulgarian interface and Bulgarian event/profile content are shown. Given `lang=en`, English content is shown.

### Scenario K — Automatic iframe resizing

Given the visitor changes from Month to Upcoming view or opens content that changes page height, then the parent page receives a valid resize message and updates the iframe height without unnecessary nested scrolling.

### Scenario L — Audit expiration

Given an audit entry is older than seven days, when cleanup runs, then the entry is no longer available in the Admin audit history.

---

## 31. Open decisions for the architecture and UX phase

The following are intentionally unresolved and must be decided before their related implementation issues are created:

1. Next.js-only backend versus separate NestJS backend.
2. Authentication library and session mechanism.
3. Whether first-login password change is mandatory or strongly prompted.
4. Database schema and migration tooling.
5. Image storage mechanism.
6. Whether event cover images are required or optional.
7. Exact event recurrence options and recurrence representation.
8. Attendance behavior when entered times fall outside office hours.
9. ~~Default public calendar view.~~ Resolved in v1.1 (§15.1): the public calendar has exactly two views (`attendance`, `events`); default is `attendance`.
10. Admin warning look-ahead period.
11. Exact audit cleanup scheduling mechanism.
12. Concurrency-control behavior for collaborative event editing.
13. Exact DevHubOne design tokens and component rules.
14. Iframe parent-child messaging protocol and origin policy.
15. Application timezone storage strategy.
16. Whether users may change their login email directly or require a confirmation step.
17. Whether profile-picture and event-image deletion removes files immediately or through cleanup.
18. Exact distinction between full-day and timed events in the UI.
19. Whether uncertain attendance requires start/end hours.
20. Whether past attendance and events remain editable.

These are not missing product requirements. They are explicit decisions delegated to the next phase.

---

## 32. Guidance for Claude agents

Every Claude agent working in this repository must:

1. Read this entire file before planning or implementing work.
2. Treat it as authoritative for Version 1 behavior.
3. Avoid adding excluded features.
4. Avoid silently deciding an item listed as unresolved.
5. Identify the exact product requirements affected by its issue.
6. Preserve bilingual behavior.
7. Preserve role and permission rules.
8. Preserve public-versus-private data boundaries.
9. Include tests for relevant business rules.
10. Stop before committing or opening a pull request unless explicitly instructed by the programmer after human review and testing.

Issue-specific agent prompts will provide narrower context, but they must not override this blueprint without an approved product-document update.

---

## 33. Change control

Any proposed change to product behavior must be classified as one of:

- clarification;
- bug correction;
- Version 1 scope change;
- future-version feature.

For a Version 1 scope change:

1. Update this blueprint.
2. Increment the document version.
3. Record the changed rules.
4. Review architecture impact.
5. Update affected issues and acceptance tests.

Implementation code must not become the only place where a new product rule exists.

---

## 34. Final authoritative statement

The DevHubOne Office Calendar Version 1 is a bilingual, single-office calendar platform with:

- a public iframe-compatible calendar;
- Month, Week, Day, and Upcoming views;
- public events;
- member attendance and availability;
- configurable office schedules;
- two authenticated roles;
- manually created accounts;
- collaborative event management;
- date-specific and recurring behavior;
- public member contact information;
- Admin warnings;
- seven-day audit retention;
- DevHubOne-aligned visual identity;
- Docker-oriented local and future deployment requirements.

All later architecture and implementation planning must preserve this definition.
