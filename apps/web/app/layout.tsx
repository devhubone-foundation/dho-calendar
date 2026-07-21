import "@dho/ui/tokens.css";
import "@dho/ui/components.css";

import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { AuthProvider } from "../lib/auth/auth-context";

export const metadata: Metadata = {
  title: "DevHubOne Office Calendar",
  description: "Bilingual office calendar for DevHubOne",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Suspense boundary required by Next.js for pages using
            useSearchParams() (our per-visit ?lang= handling). */}
        <Suspense fallback={null}>
          <AuthProvider>{children}</AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
