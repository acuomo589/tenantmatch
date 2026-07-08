import type { ReactNode } from "react";
import "@/app/globals.css";

export const metadata = {
  title: "TenantMatch",
  description: "Sheet-driven paid workbook links",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
