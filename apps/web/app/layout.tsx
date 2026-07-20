import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "../lib/auth/auth-context";

export const metadata: Metadata = {
  title: "DevHubOne Office Calendar",
  description: "Bilingual office calendar for DevHubOne",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
