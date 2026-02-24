import { Hono } from "hono";
import { hash, compare } from "bcryptjs";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { authRequired, type AuthUser } from "../middleware/auth";
import type { Env, Plan } from "../lib/types";
import { TIER_LIMITS } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

/** POST /api/auth/register */
app.post("/register", async (c) => {
  const body = await c.req.json<{ email: string; password: string; name?: string }>();
  if (!body.email || !body.password) {
    return c.json({ detail: "Email and password required" }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ detail: "Password must be at least 8 characters" }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);

  // Check uniqueness
  const existing = await db.select({ id: users.id })
    .from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    return c.json({ detail: "Email already registered" }, 409);
  }

  const passwordHash = await hash(body.password, 12);
  const [newUser] = await db.insert(users).values({
    id: crypto.randomUUID(),
    email: body.email.toLowerCase(),
    passwordHash,
    name: body.name ?? null,
    plan: "FREE",
    isActive: true,
    createdAt: new Date(),
  }).returning({ id: users.id, email: users.email, plan: users.plan });

  const token = await createToken(newUser.id, c.env);
  return c.json({
    access_token: token,
    token_type: "bearer",
    user: { id: newUser.id, email: newUser.email, plan: newUser.plan },
  });
});

/** POST /api/auth/login */
app.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  if (!body.email || !body.password) {
    return c.json({ detail: "Email and password required" }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  const rows = await db.select().from(users)
    .where(eq(users.email, body.email.toLowerCase())).limit(1);
  if (rows.length === 0) {
    return c.json({ detail: "Invalid email or password" }, 401);
  }

  const user = rows[0];
  if (!user.isActive) {
    return c.json({ detail: "Account disabled" }, 403);
  }

  const valid = await compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ detail: "Invalid email or password" }, 401);
  }

  const token = await createToken(user.id, c.env);
  return c.json({
    access_token: token,
    token_type: "bearer",
    user: { id: user.id, email: user.email, plan: user.plan, name: user.name },
  });
});

/** GET /api/auth/me */
app.get("/me", authRequired, async (c) => {
  const user = c.get("user") as AuthUser;
  const limits = TIER_LIMITS[user.plan as Plan];
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    tier: limits,
  });
});

async function createToken(userId: string, env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.SECRET_KEY);
  const expMinutes = parseInt(env.ACCESS_TOKEN_EXPIRE_MINUTES) || 10080;
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${expMinutes}m`)
    .sign(secret);
}

export default app;
