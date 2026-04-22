import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __timpani_prisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__timpani_prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__timpani_prisma__ = prisma;
}
