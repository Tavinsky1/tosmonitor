import { Hono } from "hono";
import { getDb } from "../db/client";
import { suggestions } from "../db/schema";
import type { Env } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

/** POST /api/suggestions */
app.post("/", async (c) => {
  const body = await c.req.json<{
    service_name: string;
    url: string;
    email?: string;
    notes?: string;
  }>();

  if (!body.service_name || !body.url) {
    return c.json({ detail: "service_name and url required" }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  const [s] = await db.insert(suggestions).values({
    id: crypto.randomUUID(),
    serviceName: body.service_name,
    url: body.url,
    email: body.email ?? null,
    notes: body.notes ?? null,
    status: "pending",
    createdAt: new Date(),
  }).returning({ id: suggestions.id });

  return c.json({ id: s.id, message: "Thank you! We'll review your suggestion." });
});

export default app;
