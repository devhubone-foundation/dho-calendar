import type { Dictionary } from "./i18n/dictionaries";

export interface NavItem {
  href: string;
  label: (dictionary: Dictionary) => string;
  adminOnly: boolean;
}

/**
 * Declarative nav slots for the authenticated shell. Later issues (#3-#5)
 * append entries here instead of editing the shell layout directly.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: (dictionary) => dictionary.nav.dashboard, adminOnly: false },
  { href: "/admin/calendar", label: (dictionary) => dictionary.nav.calendar, adminOnly: false },
  { href: "/admin/events", label: (dictionary) => dictionary.nav.events, adminOnly: false },
  { href: "/admin/attendance", label: (dictionary) => dictionary.nav.attendance, adminOnly: false },
  { href: "/admin/profile", label: (dictionary) => dictionary.nav.profile, adminOnly: false },
  { href: "/admin/members", label: (dictionary) => dictionary.nav.members, adminOnly: true },
  { href: "/admin/settings", label: (dictionary) => dictionary.nav.settings, adminOnly: true },
  { href: "/admin/audit", label: (dictionary) => dictionary.nav.audit, adminOnly: true },
];
