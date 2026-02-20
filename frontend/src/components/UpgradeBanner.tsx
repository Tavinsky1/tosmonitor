"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

interface UpgradeBannerProps {
  message: string;
  compact?: boolean;
}

export function UpgradeBanner({ message, compact = false }: UpgradeBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>{message}</span>
        <Link
          href="/pricing"
          className="ml-auto shrink-0 font-semibold text-amber-900 hover:underline"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-purple-50 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-100 p-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-900">{message}</p>
          <p className="mt-1 text-xs text-gray-500">
            Upgrade your plan to unlock this feature.
          </p>
        </div>
        <Link
          href="/pricing"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Upgrade <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function FreeTierNotice() {
  return (
    <UpgradeBanner
      message="You're on the Free plan. You can monitor up to 2 services with weekly digest alerts. Upgrade to Pro for real-time alerts and full history."
    />
  );
}

export function DigestOnlyNotice() {
  return (
    <UpgradeBanner
      message="Free plan receives weekly digest emails only. Upgrade to Pro ($19/mo) for instant alerts when changes are detected."
      compact
    />
  );
}
