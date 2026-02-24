/** Environment bindings for the Worker */
export interface Env {
  // Plain vars (wrangler.toml [vars])
  APP_NAME: string;
  APP_URL: string;
  LLM_PROVIDER: string;
  GROQ_MODEL: string;
  OPENAI_MODEL: string;
  ANTHROPIC_MODEL: string;
  SCRAPE_TIMEOUT_SECONDS: string;
  MAX_CONCURRENT_SCRAPES: string;
  EMAIL_FROM: string;
  WEBHOOK_TIMEOUT_SECONDS: string;
  ACCESS_TOKEN_EXPIRE_MINUTES: string;
  ALGORITHM: string;

  // Secrets (wrangler secret put)
  DATABASE_URL: string;
  SECRET_KEY: string;
  GROQ_API_KEY: string;
  RESEND_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_BUSINESS: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

/** Plan enum matching the DB */
export type Plan = "FREE" | "PRO" | "BUSINESS";
export type ChangeType = "TOS_UPDATE" | "PRIVACY_UPDATE" | "API_CHANGE" | "PRICING_CHANGE" | "DATA_POLICY";
export type Severity = "CRITICAL" | "MAJOR" | "MINOR" | "PATCH";
export type AlertChannel = "EMAIL" | "WEBHOOK" | "SLACK";
export type AlertStatus = "SENT" | "FAILED" | "PENDING";

export interface JwtPayload {
  sub: string;
  exp: number;
}

export interface TierLimits {
  maxServices: number;
  historyDays: number;
  diffAccess: boolean;
  webhookAccess: boolean;
  csvExport: boolean;
}

export const TIER_LIMITS: Record<Plan, TierLimits> = {
  FREE: {
    maxServices: 2,
    historyDays: 3,
    diffAccess: false,
    webhookAccess: false,
    csvExport: false,
  },
  PRO: {
    maxServices: 25,
    historyDays: 99999,
    diffAccess: true,
    webhookAccess: false,
    csvExport: true,
  },
  BUSINESS: {
    maxServices: 99999,
    historyDays: 99999,
    diffAccess: true,
    webhookAccess: true,
    csvExport: true,
  },
};
