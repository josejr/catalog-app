import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Small pool: this runs on a memory-constrained Pi and only ever serves a
// handful of household devices, so a large default pool wastes RAM on idle
// Postgres backend processes.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ?? postgres(process.env.DATABASE_URL!, { max: 5 });

if (process.env.NODE_ENV !== "production") {
  // Reuse the client across Next.js dev-mode hot reloads instead of opening
  // a fresh connection pool on every file change.
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
