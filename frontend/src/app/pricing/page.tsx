"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, Shield, Building2 } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individuals who want to stay informed.",
    icon: Shield,
    color: "text-zinc-400",
    cta: "Get started free",
    ctaHref: "/register",
    plan: null,
    features: [
      "Monitor up to 2 services",
      "Weekly digest email",
      "30-day change history",
      "Plain-language summaries",
    ],
    missing: ["Real-time alerts", "Unlimited services", "Priority support"],
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For teams that can't afford ToS surprises.",
    icon: Zap,
    color: "text-indigo-400",
    cta: "Start Pro",
    plan: "pro",
    highlighted: true,
    features: [
      "Monitor up to 25 services",
      "Instant email alerts",
      "Unlimited change history",
      "AI-powered summaries",
      "Severity scoring (critical/major/minor)",
      "CSV export",
    ],
    missing: ["White-label reports", "Dedicated support"],
  },
  {
    name: "Business",
    price: "$49",
    period: "/month",
    description: "For companies with compliance obligations.",
    icon: Building2,
    color: "text-emerald-400",
    cta: "Start Business",
    plan: "business",
    features: [
      "Unlimited services",
      "Instant email + webhook alerts",
      "Unlimited change history",
      "AI summaries with legal context",
      "White-label PDF reports",
      "Priority support",
      "Up to 5 team seats",
    ],
    missing: [],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: string) {
    setLoading(plan);
    setError(null);

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push(`/login?next=/pricing`);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/billing/checkout/${plan}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.detail ?? "Could not start checkout.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-display text-lg font-semibold text-white">
            ToS Monitor
          </Link>
          <div className="flex gap-4">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-20">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="headline-large mb-4 text-white">
            Simple, transparent pricing
          </h1>
          <p className="text-body mx-auto max-w-xl text-zinc-400">
            Stop being surprised by ToS changes. Pick a plan and stay ahead.
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.highlighted
                    ? "border-indigo-500/50 bg-indigo-950/30"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${plan.color}`} />
                    <span className="font-display font-semibold text-white">{plan.name}</span>
                  </div>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-sm text-zinc-500">{plan.period}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{plan.description}</p>
                </div>

                {plan.plan ? (
                  <button
                    onClick={() => handleSubscribe(plan.plan!)}
                    disabled={loading === plan.plan}
                    className={`mb-8 w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      plan.highlighted
                        ? "bg-indigo-600 text-white hover:bg-indigo-500"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {loading === plan.plan ? "Redirecting…" : plan.cta}
                  </button>
                ) : (
                  <Link
                    href={plan.ctaHref!}
                    className="mb-8 block w-full rounded-xl bg-white/10 py-3 text-center text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    {plan.cta}
                  </Link>
                )}

                <ul className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-zinc-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 text-center">
          <p className="text-sm text-zinc-500">
            All plans include a 7-day free trial. Cancel any time.{" "}
            <a href="mailto:hello@inksky.net" className="text-indigo-400 hover:underline">
              Questions? Email us.
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
