# DevHubOne Office Calendar — UI/UX Redesign Prompt for Google Stitch

**Purpose.** This document is a ready-to-use prompt pack for **Google Stitch AI**. It
describes the DevHubOne Office Calendar's full color system and every screen that must be
designed, including what each screen contains, where each element goes, how it behaves
responsively, and how it must feel intuitive. Paste the **Global design system** section
once, then paste each **screen prompt** to generate that screen.

**Output handling.** Save each generated screen as a standalone HTML file in
`docs/design/mockups/` using the exact filename listed under each screen below. The
implementation (Sonnet) agent will read those files verbatim, so keep the filenames
unchanged.

**Non-negotiable constraints Stitch must respect.**
- Same features as today — this is a **visual + UX redesign**, not new functionality.
- **Bilingual**: every label has Bulgarian (`bg`) and English (`en`) equivalents. Design
  with a visible language switch (BG / EN) and layouts that tolerate longer Bulgarian
  strings.
- The **public calendar** must work standalone **and inside an iframe** on `devhubone.com`
  — no fixed heights, no horizontal scroll, mobile-first, content-height friendly.
- **Accessibility first**: WCAG AA contrast, keyboard focus rings, min 44px touch targets,
  clear focus order. If an exact brand color pairing fails contrast, adjust for readability.

---

## Global design system (paste this first)

> Design a modern, friendly, education-and-technology brand system for a bilingual office
> calendar web app called **DevHubOne Office Calendar**. Warm, approachable, clean — not a
> generic gray admin template.

### Color palette

| Name | Hex | Role in the UI |
|---|---|---|
| Custom Black | `#222F45` | Primary dark brand color. App header/top bar, dark hero sections, high-contrast panels, footer text-on-light. Primary body text color on light backgrounds. |
| Dark Blue | `#697D92` | Navigation bar background, dropdown menus, footer, **secondary buttons**, timeline/marker accents. |
| Dark Green (Sage) | `#82B495` | Main content cards and panels, positive/informational surfaces (e.g. "office open" cards, workshop/event cards). |
| Light Green | `#DFEBD5` | Soft page backgrounds, bento/grid card backgrounds, subtle section separation behind cards. |
| Custom White | `#EFF4EF` | Default page background, forms, light panels, readable content surfaces, text on dark bars. |
| Custom Green (Leaf) | `#67B63A` | **Bright accent** — primary CTAs, "confirmed / attending" state, highlighted actions, today marker, focus accents. Use sparingly for emphasis. |
| Light Yellow | `#E3F4C3` | Small highlight/accent — **"not sure / uncertain" attendance**, info callouts, timeline line. |
| Teal | `#58A399` | Secondary teal surface — informational cards, secondary accents. |
| Custom Grey | `#D9D9D9` | Neutral borders, separators, disabled states, muted/closed-day surfaces. |

**Homepage / dark-section pattern** (use for hero and public-calendar header band):
dark background `#222F45`, white text `#EFF4EF`, green content cards `#82B495`, light
content sections `#EFF4EF`, blue navigation & secondary buttons `#697D92`, bright green
accents `#67B63A`.

### Semantic color roles (apply consistently across all calendar screens)

- **Open / working day** → sage `#82B495` surface with a leaf `#67B63A` accent stripe or dot.
- **Closed day** → muted: custom grey `#D9D9D9` surface, reduced contrast text.
- **Changed-hours day** (date exception) → sage surface with a teal `#58A399` badge.
- **Confirmed attending** → leaf `#67B63A`.
- **Not sure / uncertain** → light yellow `#E3F4C3` chip with a dashed/outlined treatment,
  visually distinct from confirmed (never confusable).
- **Event** → dark blue `#697D92` block or leaf-outlined card, **visually more prominent**
  than attendance markers (events dominate the day cell).
- **Today** → leaf `#67B63A` ring/outline.
- **Warning** (uncovered office day, admin) → light yellow background with custom-black text
  and a clear warning icon.
- **Destructive / error** → keep a functional red for delete/validation (e.g. `#C0392B`),
  not part of the brand palette but needed for usability.

### Typography, shape, motion
- Font family **Raleway** (fallback system sans). h1 bold, h2 semibold. Generous line
  height. No secondary display typeface.
- Rounded corners: cards/panels `1rem` (16px), inputs/buttons pill or `0.5rem`, chips pill.
- **Buttons:** primary = outlined **pill** (thick 3–4px border, bold label, subtle hover
  scale) matching DevHubOne; **accent CTA** = solid leaf `#67B63A` pill for the single most
  important action per screen; secondary = dark-blue `#697D92` pill.
- Soft, subtle shadows only; transitions ~200–300ms; gentle hover scale on interactive
  cards. No heavy skeuomorphism.

### Layout & responsiveness
- Mobile-first. Breakpoints: **≤480px** (phone / narrow iframe), **481–768px** (tablet),
  **769–1024px**, **≥1025px** (desktop).
- Content max-width ~1200px, centered, comfortable padding that shrinks on mobile.
- No horizontal page scroll ever. Wide tables/grids get their own internal
  `overflow-x:auto` container.
- Public calendar must render usably at **320px** width (mobile iframe).
- Bilingual: never truncate; allow wrapping; test with the longer Bulgarian label.

### Global components (design once, reuse)
- **Language switch** (BG / EN pill toggle) — top-right, present on every screen.
- **App top bar / nav** — dark-blue `#697D92`, brand name left, nav links center,
  role badge + avatar + sign-out right. Collapses to a hamburger drawer ≤768px.
- **Card / panel**, **chip/badge**, **avatar** (with colored fallback initials),
  **modal** (centered, dimmed overlay, close button, keyboard-dismissable),
  **empty state** (friendly illustration/icon + message), **inline error/alert**,
  **loading state**.

---

## Screen prompts

Two surfaces: the **public calendar** (unauthenticated, iframe-embeddable) and the
**authenticated app** under `/admin` (shared by Members and Admins; some pages Admin-only).

---

### 1. Public Calendar — Month view · `public-calendar-month.html`

> Design the **public office calendar** landing page (works standalone and inside an
> iframe). Top: a compact dark-blue band with the DevHubOne brand, a **view switcher**
> (Month · Week · Day · Upcoming) as a segmented pill control, prev/today/next navigation,
> the current month label, and the BG/EN language switch. Below: a responsive **month grid**.
>
> **Make working days obvious at a glance** (the current design's biggest problem — users
> should NOT have to click to learn a day is a working day or who attends):
> - Each day cell shows: the date number; a clear **status band/dot** using the semantic
>   colors — open (sage/leaf), closed (grey, de-emphasized), changed-hours (teal badge);
>   the **office hours** text (e.g. "12:00–20:00") right on open cells; a compact **row of
>   attendee avatars** (confirmed) with a small "+N" overflow; a distinct **light-yellow
>   "not sure" indicator** when only uncertain attendees exist; and prominent **event
>   chips** (dark-blue, event title) that stand out above attendance.
> - Days that are not publicly open (no confirmed attendee) look clearly muted but still
>   show any events.
> - **Today** has a leaf ring. Selected/hovered day lifts subtly.
> - A small **legend** (open / closed / changed hours / event / attending / not sure) sits
>   under the grid so the color coding is self-explanatory.
>
> **Responsive:** desktop = full 7-column grid with avatars + hours inline; tablet = 7
> columns, condensed cells (avatars collapse to a count + dots); phone/narrow-iframe = the
> month collapses gracefully (either a scrollable compact grid or an auto-switch hint to
> the Upcoming list). Never overflow horizontally. Cells must scale — no clipped content,
> no fixed pixel heights that break.
>
> Clicking a day opens the **Day details modal** (screen 5). The whole page is
> keyboard-navigable.

### 2. Public Calendar — Week view · `public-calendar-week.html`

> Same header/switcher/language controls as Month. Body = a **time-grid week view**: 7 day
> columns, a vertical time axis covering office hours, with:
> - a shaded **office-open band** per day (sage) showing effective opening hours; closed
>   days visibly greyed.
> - **member attendance intervals** drawn as blocks positioned by start/end time, labeled
>   with avatar + name + hours; confirmed = leaf-tinted, not-sure = light-yellow dashed.
> - **events** as prominent dark-blue blocks spanning their duration, layered above
>   attendance, with title + time + location.
> Sticky day headers with weekday + date, today highlighted. Horizontal scroll for the 7
> columns is allowed **inside the grid container only** on narrow widths; the page itself
> never scrolls sideways. On phone, default to showing 1–3 days with swipe, or fall back to
> Day view.

### 3. Public Calendar — Day view · `public-calendar-day.html`

> A single selected date in detail. Header shows the full localized date + open/closed
> status + effective hours (with a "hours changed for this date" note when applicable).
> Below, a chronological timeline for that day: office-open band, each attendee's interval
> (avatar, name, localized qualification, contact email, hours; confirmed vs not-sure
> styled distinctly), and every event (cover thumbnail, title, time range, location,
> description in the active language) shown prominently. Clean single-column, very
> readable on mobile.

### 4. Public Calendar — Upcoming / List view · `public-calendar-upcoming.html`

> A chronological, scannable list optimized for **narrow iframe widths and mobile**.
> Group by date; each group header = localized date + open/closed + hours. Under each:
> event cards first (prominent, dark-blue/leaf, with cover thumb, title, time, location),
> then a condensed attendance summary (avatar row + "N attending, M not sure"). Friendly
> empty state when no upcoming events/open days in range. This is the safest mobile fallback
> — make it excellent.

### 5. Day details modal · `public-day-details-modal.html`

> Design the **day-details modal** (opens from any calendar view; reused by the internal
> calendar too). Centered card over a dimmed overlay, close (×) button, Esc-dismissable,
> focus-trapped. Contents, in order: localized date; **office status** (open/closed,
> effective hours, a badge if hours were changed for this date); **Events** section
> (prominent cards: cover image with graceful fallback, title, time range, location,
> description in active language); **Attendees** section split into **Attending** (leaf) and
> **Not sure** (light-yellow, clearly separate) — each person = avatar (with fallback
> initials), full name, localized qualification, contact email marked as a contact method,
> and their hours. Sensible empty states ("Office closed", "No confirmed attendees",
> "No events"). Must be fully usable inside an iframe and on a 320px screen.

### 6. Login · `admin-login.html`

> Centered, friendly login card on a light `#EFF4EF` background (optional dark
> `#222F45` brand side-panel on desktop). DevHubOne brand/logo, email + password fields
> (outlined, rounded), a solid **leaf CTA** "Sign in" pill, inline error area for invalid
> credentials / inactive account, BG/EN switch top-right. No public sign-up link (accounts
> are admin-created). Fully responsive, single column on mobile.

### 7. Change password (forced first login) · `admin-change-password.html`

> Same visual family as Login. Explains the user must set a new password after their
> temporary one. Current password, new password, confirm new password; validation hints;
> leaf CTA "Update password". Clear, reassuring, bilingual.

### 8. Dashboard · `admin-dashboard.html`

> The authenticated landing page (Members + Admins). App top-bar nav (Dashboard, Calendar,
> Attendance, Events, Profile, + Admin-only: Members, Office Settings, Audit). A friendly
> greeting with the user's name/avatar and role badge. **Prominent warning area
> (Admin-only): "Uncovered office days"** — light-yellow warning cards, each naming a date
> with no confirmed attendee, explaining why, with a quick action link to fix
> attendance/schedule. Also: quick-glance cards (next open days, upcoming events, my next
> attendance) and quick actions (New event, Edit my schedule). Members see the personal
> cards but not the admin warnings. Responsive card grid → single column on mobile.

### 9. Internal Calendar · `admin-calendar.html`

> The authenticated calendar. Same four views + day modal as the public calendar, reusing
> the identical visual language, **plus** authenticated affordances: an indicator of the
> current user's own attendance, visible **schedule-conflict** flags (e.g. attendance on a
> closed day), and (permission-gated) shortcuts to management actions. Admin-only controls
> clearly separated/badged. Same responsiveness rules as public.

### 10. Attendance — my weekly schedule + date exceptions · `admin-attendance.html`

> Design a clear, intuitive **personal attendance manager**. Two clearly separated sections:
> **(A) Weekly default schedule** — one row per weekday (Mon–Sun) with a toggle for
> "attending", plus start/end time pickers when on; a save action; explanation that this
> drives future expected attendance. **(B) Date-specific exceptions** — a way to pick a date
> and set status (**Attending / Not attending / Not sure**) with hours, overriding the weekly
> default for that one date; a list/table of existing exceptions with edit/delete. Show a
> warning when an exception falls on a closed office day. Admins get an extra **member
> selector** at top to edit any member's attendance (label clearly whose schedule is shown).
> Time inputs and toggles must be large and touch-friendly. Responsive: rows stack on mobile.

### 11. Events — list + create/edit · `admin-events.html`

> Design **event management**. Top: "New event" solid-leaf CTA + search/filter and a
> view of upcoming events as prominent cards (cover thumb with fallback, bilingual title,
> date/time, location, recurrence badge, edit/delete). The **create/edit form** (modal or
> side panel) includes: **bilingual** title (BG + EN) and description (BG + EN) shown as
> paired fields or a language tab; start & end date-time; all-day toggle; location; cover
> image upload (drag-drop, preview, fallback note, ≤10MB); **recurrence** controls (repeat
> weekly on weekday(s), end by count or date); and a clear note that **saving publishes
> immediately** (no drafts). Collaborative model: any member/admin can edit/delete any
> event. Include the **recurrence-scope dialog** (screen 12). Responsive form, single column
> on mobile.

### 12. Recurrence scope dialog · `admin-recurrence-scope-dialog.html`

> A small focused modal shown when editing/deleting a recurring event occurrence. Three
> clearly-labeled radio choices: **This occurrence only**, **This and future occurrences**,
> **Entire series** — each with a one-line explanation of the consequence. Confirm/Cancel
> buttons (confirm styled per destructive vs normal). Keyboard-accessible.

### 13. Profile · `admin-profile.html`

> The user's own profile editor. Avatar with upload/replace (fallback initials, ≤5MB),
> full name, contact email, and **bilingual qualification** (role in BG + role in EN). A
> preview of how the public profile appears. Note that name/photo/qualification/email are
> publicly visible. Save with clear success/error feedback. Responsive two-column →
> single column.

### 14. Members (Admin-only) · `admin-members.html`

> Admin member management. A responsive table/card list of members: avatar, name, email,
> role badge, active/inactive status, actions (edit, activate/deactivate). A **"Create
> member"** solid-leaf CTA opening a form: profile fields, role (Member/Admin), temporary
> password (with a note it won't be shown again), bilingual qualification. Deactivate is
> preferred over delete — make deactivate the primary lifecycle action. Inactive members
> visibly de-emphasized. Table scrolls inside its own container on mobile; consider a card
> layout on phones.

### 15. Office Settings (Admin-only) · `admin-settings.html`

> Admin office-schedule management. **(A) Default weekly office hours** — per-weekday
> open toggle + opening/closing times (initial defaults Mon/Wed/Fri 12:00–20:00, but fully
> editable; nothing hard-coded). **(B) Date-specific exceptions** — pick a date to: mark
> closed, open an otherwise-closed day, or change opening/closing hours; list existing
> exceptions with edit/delete. Explain overrides apply to that date only and public holidays
> are not auto-closed. Clear, safe, confirmation on closures. Responsive.

### 16. Audit history (Admin-only) · `admin-audit.html`

> A read-only audit log for Admins. Chronological list/table: timestamp, actor (avatar +
> name), action type, affected entity, and a compact before/after summary. Note the
> **7-day retention** clearly. Filter by action type / date. No secrets ever shown. Empty
> state when nothing in range. Table scrolls inside its container on mobile.

---

## Deliverables checklist for the designer

Generate and save (in `docs/design/mockups/`), each responsive and using the palette above:

- [ ] `public-calendar-month.html`
- [ ] `public-calendar-week.html`
- [ ] `public-calendar-day.html`
- [ ] `public-calendar-upcoming.html`
- [ ] `public-day-details-modal.html`
- [ ] `admin-login.html`
- [ ] `admin-change-password.html`
- [ ] `admin-dashboard.html`
- [ ] `admin-calendar.html`
- [ ] `admin-attendance.html`
- [ ] `admin-events.html`
- [ ] `admin-recurrence-scope-dialog.html`
- [ ] `admin-profile.html`
- [ ] `admin-members.html`
- [ ] `admin-settings.html`
- [ ] `admin-audit.html`

For each, provide **desktop and mobile** framings where the layout differs (Stitch can emit
both). Keep colors, type, radii, and component style consistent across all screens so they
read as one product.
