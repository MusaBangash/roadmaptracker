import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations use the direct (non-pooled) connection; the app uses DATABASE_URL.
  dbCredentials: { url: process.env.DIRECT_URL || process.env.DATABASE_URL! },
});
