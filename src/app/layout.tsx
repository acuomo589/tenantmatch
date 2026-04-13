import type { ReactNode } from "react";
import "@/app/globals.css";

export const metadata = {
  title: "Timpani Proto",
  description: "Lean tenant matchmaker prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
