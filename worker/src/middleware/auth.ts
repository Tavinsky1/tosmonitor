import { Context, Next } from "hono";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { Env } from "../lib/types";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PRO" | "BUSINESS";
  stripeCustomerId: string | null;
  isActive: boolean;
};

/** Extract and verify JWT, attach user to context. 401 if missing/invalid. */
export async function authRequired(c: Context<{ Bindings: Env }>, next: Next) {
  const user = await extractUser(c);
  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }
  c.set("user", user);
  return next();
}

/** Extract user if present, or null. Does not 401. */
export async function authOptional(c: Context<{ Bindings: Env }>, next: Next) {
  const user = await extractUser(c);
  c.set("user", user ?? null);
  return next();
}

async function extractUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  try {
    const secret = new TextEncoder().encode(c.env.SECRET_KEY);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const userId = payload.sub as string;
    if (!userId) return null;

    const db = getDb(c.env.DATABASE_URL);
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (rows.length === 0) return null;
    const u = rows[0];
    if (!u.isActive) return null;

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      stripeCustomerId: u.stripeCustomerId,
      isActive: u.isActive,
    };
  } catch {
    return null;
  }
}
