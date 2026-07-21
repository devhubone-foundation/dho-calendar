# DevHubOne design tokens

Source of truth for every color/typography/radius/button/input/card value below:
the **live** `https://devhubone.com/` homepage and its compiled stylesheet
(`/_next/static/css/*.css`) and the contact form at `https://devhubone.com/en/contact`,
fetched and inspected directly (`curl` against the real HTML/CSS, not a
screenshot guess) on **2026-07-20**.

No value in the "Sourced" tables below was invented; each was read verbatim
from DevHubOne's own compiled Tailwind theme (custom color classes named
`custom-black`, `custom-white`, `dark-blue`, `dark-green`, `dark-grey`,
`custom-green`) or from real rendered markup (button/input class lists).

## Colors (sourced)

| Token | Hex | DevHubOne's own class name | Observed usage |
|---|---|---|---|
| `--dho-color-ink` | `#222F45` | `custom-black` | body text on light sections, button border/text, hero image overlay |
| `--dho-color-paper` | `#EFF4EF` | `custom-white` | page/section background, text on dark header/footer, input background |
| `--dho-color-navy` | `#697D92` | `dark-blue` | header + footer bar background |
| `--dho-color-sage` | `#82B495` | `dark-green` | feature-card background |
| `--dho-color-teal` | `#58A399` | `dark-grey` (site's own name; the color itself reads as teal) | secondary accent |
| `--dho-color-leaf` | `#67B63A` | `custom-green` | brand accent color, defined in the theme |

## Typography (sourced)

- Body font: **Raleway**, loaded via `next/font`, stacked as
  `Raleway, ui-sans-serif, system-ui, sans-serif, ...`.
- Headings use existing weight utilities observed in markup: `font-bold`
  (h1) / `font-semibold` (h2), no separate display typeface.

## Radii (sourced)

| Token | Value | Tailwind class it mirrors |
|---|---|---|
| `--dho-radius-sm` | `0.5rem` | `rounded-lg` (site's `--radius` base) |
| `--dho-radius-md` | `0.75rem` | `rounded-xl` |
| `--dho-radius-lg` | `1rem` | `rounded-2xl` |
| `--dho-radius-pill` | `9999px` | `rounded-full` |

## Buttons and inputs (sourced from real rendered markup)

Primary CTA button, taken verbatim from the rendered class list on
`/en/contact`:

```
shadow-inner px-10 py-2 border-4 border-custom-black text-custom-black
font-bold rounded-full transition duration-300 hover:scale-105
disabled:opacity-50 disabled:cursor-not-allowed
```

i.e. an **outlined pill** button (thick border, no fill, bold label, subtle
hover scale) rather than a solid filled button. `packages/ui`'s `Button`
component's `primary` variant reproduces this treatment.

Text input, taken verbatim from the same page:

```
border-2 bg-custom-white border-black p-2 rounded-lg w-full
```

## Not sourced (derived, documented as such)

The following are not literal DevHubOne values (the homepage doesn't expose
a spacing scale or a validation/error color) but are reasonable, minimal
additions needed to build usable UI:

- `--dho-space-*`: a 4px-based spacing scale, chosen to match the general
  "friendly, breathing" spacing character of the site rather than any
  specific measured value.
- `--dho-color-danger` (`#C0392B`) and `--dho-color-danger-bg` (`#FBEAEA`):
  a functional error/validation color, since DevHubOne's own marketing site
  has no form-error state to copy. Chosen for adequate contrast against
  `--dho-color-paper`.

Agents implementing later issues must reuse these tokens/components rather
than hard-coding new colors. If DevHubOne's real site changes, update this
file's source citation and the corresponding CSS variables together.
