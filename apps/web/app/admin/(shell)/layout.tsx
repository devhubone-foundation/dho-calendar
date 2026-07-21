"use client";

import { Avatar, Badge, Button } from "@dho/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { resolveUploadUrl } from "../../../lib/auth/api-client";
import { useAuth } from "../../../lib/auth/auth-context";
import { LocaleSwitcher } from "../../../lib/i18n/LocaleSwitcher";
import { useDictionary } from "../../../lib/i18n/use-locale";
import { NAV_ITEMS } from "../../../lib/nav-config";

export default function AdminShellLayout({ children }: { children: ReactNode }) {
  const { user, profile, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const dictionary = useDictionary();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    } else if (status === "authenticated" && user?.mustChangePassword) {
      router.push("/admin/change-password");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || !user || user.mustChangePassword) {
    return <p>{dictionary.common.loading}</p>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN");

  return (
    <div className="dho-shell">
      <header className="dho-shell-header">
        <span className="dho-shell-brand">{dictionary.nav.brandName}</span>
        <nav className="dho-shell-nav" aria-label={dictionary.nav.brandName}>
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label(dictionary)}
            </Link>
          ))}
        </nav>
        <div className="dho-shell-user">
          <Badge variant={user.role === "ADMIN" ? "success" : "muted"}>{user.role}</Badge>
          <Avatar
            name={profile?.fullName ?? user.email}
            src={profile?.profileImagePath ? resolveUploadUrl(profile.profileImagePath) : null}
            size={32}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              void logout().then(() => router.push("/admin/login"));
            }}
          >
            {dictionary.common.signOut}
          </Button>
          <LocaleSwitcher />
        </div>
      </header>
      <main className="dho-shell-main">{children}</main>
    </div>
  );
}
